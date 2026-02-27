import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { file_url, file_type, clinic_id } = body;

    if (!file_url || !clinic_id) {
      return new Response(JSON.stringify({ error: "Missing file_url or clinic_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("extract-intake called with file_url:", file_url, "type:", file_type);

    // Download the file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }

    const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
    // Chunk the base64 encoding to avoid stack overflow on large files
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < fileBytes.length; i += chunkSize) {
      const chunk = fileBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64File = btoa(binary);

    // Determine MIME type
    const mimeType = file_type || "application/octet-stream";
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    // Use Gemini to extract structured data from the file
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const extractionPrompt = `You are extracting data from an Animal Health Certificate intake form or related veterinary document. 
Extract ALL available information and return it as a JSON object with this exact structure (use empty strings for missing fields):

{
  "owner": {
    "firstName": "",
    "lastName": "",
    "houseNameNumber": "",
    "street": "",
    "townCity": "",
    "postalCode": "",
    "country": "",
    "phone": "",
    "email": ""
  },
  "transport": {
    "transportedBy": "",
    "carrierName": ""
  },
  "authorisedPerson": {
    "firstName": "",
    "lastName": "",
    "houseNameNumber": "",
    "street": "",
    "townCity": "",
    "postalCode": "",
    "phone": "",
    "email": ""
  },
  "pet": {
    "name": "",
    "species": "",
    "breed": "",
    "breedOther": "",
    "dateOfBirth": "",
    "colour": "",
    "sex": "",
    "neutered": "",
    "microchipNumber": "",
    "microchipDate": "",
    "routineVaccines": ""
  },
  "travel": {
    "meansOfTravel": "",
    "dateOfEntry": "",
    "firstCountry": "",
    "finalCountry": "",
    "tapewormRequired": "",
    "returningWithinFiveDays": "",
    "returningWithin120Days": ""
  },
  "rabies": {
    "vaccinationDate": "",
    "vaccineName": "",
    "manufacturer": "",
    "batchNumber": "",
    "validFrom": "",
    "validTo": ""
  }
}

For transportedBy use one of: "owner", "authorised", "carrier"
For species use one of: "dog", "cat", "ferret"
For sex use one of: "Male", "Female"
For neutered use one of: "Yes", "No"
For dates use YYYY-MM-DD format
For tapewormRequired, returningWithinFiveDays, returningWithin120Days use "yes" or "no"

Return ONLY the JSON object, no other text.`;

    const parts: any[] = [
      { type: "text", text: extractionPrompt },
    ];

    if (isImage) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64File}` },
      });
    } else if (isPdf) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${base64File}` },
      });
    } else {
      // For other file types, try as image anyway (Gemini handles many formats)
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64File}` },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: parts,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawText = aiResult.choices?.[0]?.message?.content || "{}";
    console.log("AI raw response length:", rawText.length);

    // Parse JSON from response (handle markdown code blocks)
    let extractedData: any;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      extractedData = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawText.substring(0, 500));
      extractedData = {};
    }

    // Create submission with extracted data
    const ownerName = extractedData.owner?.firstName
      ? `${extractedData.owner.firstName} ${extractedData.owner.lastName || ""}`.trim()
      : null;

    const insertData: Record<string, unknown> = {
      clinic_id: clinic_id,
      status: "Draft",
      data_json: extractedData,
      source: "import_upload",
      owner_name: ownerName,
      owner_email: extractedData.owner?.email || null,
      first_country_of_entry: extractedData.travel?.firstCountry || null,
      final_destination: extractedData.travel?.finalCountry || null,
      entry_date: extractedData.travel?.dateOfEntry || null,
      intake_pdf_url: file_url,
    };

    const { data: submission, error: insertError } = await supabase
      .from("submissions")
      .insert(insertData)
      .select("id, public_token")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to create submission: ${insertError.message}`);
    }

    await supabase.from("audit_log").insert({
      submission_id: submission.id,
      action: "created" as any,
      details_json: { source: "import_upload", extracted_fields: Object.keys(extractedData) },
    });

    console.log("Created submission:", submission.id, "with extracted data");

    return new Response(JSON.stringify({
      success: true,
      submission_id: submission.id,
      public_token: submission.public_token,
      extracted_data: extractedData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("extract-intake error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

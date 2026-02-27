import "jsr:@supabase/functions-js@2.4.1/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const rawToken = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;
  // Validate token format: must be a UUID to prevent path traversal or injection
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const token = rawToken && UUID_RE.test(rawToken) ? rawToken : (rawToken ? null : rawToken);

  if (rawToken && !UUID_RE.test(rawToken)) {
    return new Response(JSON.stringify({ error: "Invalid token format" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Limit request body size (reject payloads > 1MB)
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 1_048_576) {
      return new Response(JSON.stringify({ error: "Request body too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST without token: Create new submission
    if (req.method === "POST" && !token) {
      const body = await req.json();
      const clinicId = body.clinic_id;
      if (!clinicId || typeof clinicId !== "string") {
        return new Response(JSON.stringify({ error: "Missing clinic_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const insertData: Record<string, unknown> = {
        clinic_id: clinicId,
        status: "Draft",
        data_json: body.data_json || {},
        source: body.source || "link",
      };
      if (body.intake_upload_path) insertData.intake_upload_path = body.intake_upload_path;
      if (body.intake_pdf_url) insertData.intake_pdf_url = body.intake_pdf_url;

      const { data, error } = await supabase
        .from("submissions")
        .insert(insertData)
        .select("id, public_token")
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Load submission by token
    if (req.method === "GET" && token) {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, public_token, status, data_json, correction_message, correction_fields")
        .eq("public_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Submission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Auto-save draft changes
    if (req.method === "PUT" && token) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {
        data_json: body.data_json,
        updated_at: new Date().toISOString(),
      };

      // Extract key fields for dashboard display
      if (body.data_json?.owner) {
        const o = body.data_json.owner;
        updateData.owner_name = o.firstName ? `${o.firstName} ${o.lastName || ""}`.trim() : null;
        updateData.owner_email = o.email || null;
      }
      if (body.data_json?.travel) {
        const t = body.data_json.travel;
        updateData.entry_date = t.dateOfEntry || null;
        updateData.first_country_of_entry = t.firstCountry || null;
        updateData.final_destination = t.finalCountry || null;
      }
      if (body.data_json?.pet) {
        updateData.pets_count = 1;
      }

      const { error } = await supabase
        .from("submissions")
        .update(updateData)
        .eq("public_token", token);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Final submission
    if (req.method === "POST" && token) {
      const body = await req.json();

      const updateData: Record<string, unknown> = {
        status: "Submitted",
        submitted_at: new Date().toISOString(),
        data_json: body.data_json,
        correction_message: null,
        correction_fields: null,
      };

      if (body.data_json?.owner) {
        const o = body.data_json.owner;
        updateData.owner_name = o.firstName ? `${o.firstName} ${o.lastName || ""}`.trim() : null;
        updateData.owner_email = o.email || null;
      }
      if (body.data_json?.travel) {
        const t = body.data_json.travel;
        updateData.entry_date = t.dateOfEntry || null;
        updateData.first_country_of_entry = t.firstCountry || null;
        updateData.final_destination = t.finalCountry || null;
      }
      if (body.data_json?.pet) {
        updateData.pets_count = 1;
      }

      const { data: sub } = await supabase
        .from("submissions")
        .select("id, clinic_id")
        .eq("public_token", token)
        .single();

      if (!sub) {
        return new Response(JSON.stringify({ error: "Submission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("submissions")
        .update(updateData)
        .eq("public_token", token);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("audit_log").insert({
        submission_id: sub.id,
        action: "submitted",
        details_json: { source: "client_intake" },
      });

      // Auto-select template by first country of entry
      if (body.data_json?.travel?.firstCountry) {
        const { data: tmpl } = await supabase
          .from("document_templates")
          .select("id")
          .eq("first_country_of_entry", body.data_json.travel.firstCountry)
          .eq("active", true)
          .limit(1)
          .single();

        if (tmpl) {
          await supabase
            .from("submissions")
            .update({ selected_template_id: tmpl.id })
            .eq("id", sub.id);

          await supabase.from("audit_log").insert({
            submission_id: sub.id,
            action: "template_selected",
            details_json: { template_id: tmpl.id, auto_selected: true },
          });
        }
      }

      // Generate intake PDF asynchronously
      try {
        const pdfResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-pdfs`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              submission_id: sub.id,
              type: "intake",
            }),
          }
        );

        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          if (pdfData.intake_pdf_url) {
            await supabase
              .from("submissions")
              .update({ intake_pdf_url: pdfData.intake_pdf_url })
              .eq("id", sub.id);
          }
        }
      } catch (pdfError) {
        console.error("Failed to generate intake PDF:", pdfError);
      }

      return new Response(JSON.stringify({ success: true, submission_id: sub.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

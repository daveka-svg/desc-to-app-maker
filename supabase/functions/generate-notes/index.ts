import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, peData, templatePrompt } = await req.json();
    const INCEPTIONLABS_API_KEY =
      Deno.env.get("INCEPTIONLABS_API_KEY") || Deno.env.get("INCEPTION_API_KEY");

    if (!INCEPTIONLABS_API_KEY) {
      throw new Error("INCEPTIONLABS_API_KEY must be configured");
    }

    const systemPrompt = templatePrompt || `You are a veterinary clinical note generator. Generate structured clinical notes from the consultation transcript. Include:
- Chief complaint (C/O)
- Clinical examination findings (CE)
- Assessment/differential diagnoses (Adv DDx)
- Plan

Keep the language concise and professional. Use standard veterinary abbreviations.`;

    const peContext = peData ? `\n\nPhysical Examination Data:\n${JSON.stringify(peData, null, 2)}` : '';
    const userPrompt = `Generate clinical notes from the following consultation transcript:${peContext}\n\nTranscript:\n${transcript}`;

    const model = Deno.env.get("INCEPTION_MODEL") || "mercury-2";
    const reasoningEffort = Deno.env.get("INCEPTION_REASONING_EFFORT") || "instant";

    const response = await fetch("https://api.inceptionlabs.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INCEPTIONLABS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        reasoning_effort: reasoningEffort,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Inception API error:", response.status, errorText);
      throw new Error(`Inception API error [${response.status}]`);
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
      ? rawContent.map((part: { text?: string } | null) => part?.text || "").join("").trim()
      : "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

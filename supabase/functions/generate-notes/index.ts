import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, peData, templatePrompt } = await req.json();
    const INCEPTION_API_KEY = Deno.env.get("INCEPTION_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!INCEPTION_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("INCEPTION_API_KEY (preferred) or LOVABLE_API_KEY must be configured");
    }

    const systemPrompt = templatePrompt || `You are a veterinary clinical note generator. Generate structured clinical notes from the consultation transcript. Include:
- Chief complaint (C/O)
- Clinical examination findings (CE)
- Assessment/differential diagnoses (Adv DDx)
- Plan

Keep the language concise and professional. Use standard veterinary abbreviations.`;

    const peContext = peData ? `\n\nPhysical Examination Data:\n${JSON.stringify(peData, null, 2)}` : '';
    const userPrompt = `Generate clinical notes from the following consultation transcript:${peContext}\n\nTranscript:\n${transcript}`;

    // Preferred provider: Inception (OpenAI-compatible endpoint)
    if (INCEPTION_API_KEY) {
      const model = Deno.env.get("INCEPTION_MODEL") || "mercury-2";
      const reasoningEffort = Deno.env.get("INCEPTION_REASONING_EFFORT") || "instant";

      const inceptionResponse = await fetch("https://api.inceptionlabs.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INCEPTION_API_KEY}`,
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

      if (!inceptionResponse.ok) {
        const errorText = await inceptionResponse.text();
        console.error("Inception API error:", inceptionResponse.status, errorText);
        throw new Error(`Inception API error [${inceptionResponse.status}]`);
      }

      const data = await inceptionResponse.json();
      const content = data?.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy fallback provider
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

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

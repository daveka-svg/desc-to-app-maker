import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const parseResponseText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if (part.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
      if (part.type === "text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  if (chunks.length > 0) return chunks.join("").trim();

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice && typeof firstChoice.message === "object"
    ? firstChoice.message as Record<string, unknown>
    : null;
  if (message && typeof message.content === "string") {
    return message.content.trim();
  }

  return "";
};

const callOpenAI = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
  reasoningEffort: string | null,
) => {
  const body: Record<string, unknown> = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    max_output_tokens: maxOutputTokens,
  };

  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const errorMessage = typeof (parsed as any)?.error?.message === "string"
      ? (parsed as any).error.message
      : text;
    throw new Error(`OpenAI API error [${response.status}] (${model}): ${errorMessage}`);
  }

  const content = parseResponseText(parsed);
  if (!content) {
    throw new Error(`OpenAI API returned empty content (${model})`);
  }

  return content;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, peData, templatePrompt } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = templatePrompt || `You are a veterinary clinical note generator. Generate structured clinical notes from the consultation transcript. Include:
- Chief complaint (C/O)
- Clinical examination findings (CE)
- Assessment/differential diagnoses (Adv DDx)
- Plan

Keep the language concise and professional. Use standard veterinary abbreviations.`;

    const peContext = peData ? `\n\nPhysical Examination Data:\n${JSON.stringify(peData, null, 2)}` : '';
    const userPrompt = `Generate clinical notes from the following consultation transcript:${peContext}\n\nTranscript:\n${transcript}`;

    const primaryModel = Deno.env.get("OPENAI_MODEL") || "gpt-5.4";
    const fallbackRaw = Deno.env.get("OPENAI_MODEL_FALLBACKS") || "gpt-5,gpt-5-mini";
    const modelCandidates = Array.from(
      new Set([primaryModel, ...fallbackRaw.split(",").map((item) => item.trim()).filter(Boolean)])
    );
    const reasoningEffort = Deno.env.get("OPENAI_REASONING_EFFORT") || "low";
    const maxOutputTokens = Number(Deno.env.get("OPENAI_MAX_OUTPUT_TOKENS") || "2000");

    let content = "";
    let modelUsed = modelCandidates[0] || primaryModel;
    let lastError: Error | null = null;
    for (const model of modelCandidates) {
      try {
        content = await callOpenAI(
          OPENAI_API_KEY,
          model,
          systemPrompt,
          userPrompt,
          Number.isFinite(maxOutputTokens) ? maxOutputTokens : 2000,
          reasoningEffort,
        );
        modelUsed = model;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error("OpenAI generation attempt failed:", model, lastError.message);
      }
    }

    if (!content.trim()) {
      throw lastError || new Error("OpenAI generation failed for all candidate models");
    }

    return new Response(JSON.stringify({ content, provider: "openai", model: modelUsed }), {
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

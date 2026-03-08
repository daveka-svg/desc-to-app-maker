import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  filterGroundedGeneralConsultPayload,
  parseGeneralConsultGroundingPayload,
  renderGeneralConsultFromGroundedPayload,
} from "./grounding.ts";
import {
  buildGeneralConsultExtractionUserPrompt,
  DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT,
  GENERAL_CONSULT_PROMPT_WINNER,
} from "./general-consult.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const extractProviderContent = (payload: Record<string, unknown>): string => {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice && typeof firstChoice.message === "object"
    ? firstChoice.message as Record<string, unknown>
    : null;
  const content = message?.content;

  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const chunks = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const row = part as Record<string, unknown>;
        if (typeof row.text === "string") return row.text;
        return "";
      })
      .filter(Boolean);
    if (chunks.length > 0) return chunks.join("").trim();
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const parts = Array.isArray(row.content)
      ? row.content as Array<Record<string, unknown>>
      : [];
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("").trim();
};

type LlmProvider = "inception" | "openai";

const callInception = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) => {
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    max_tokens: maxOutputTokens,
    temperature: 0,
  };

  const response = await fetch("https://api.inceptionlabs.ai/v1/chat/completions", {
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
    throw new Error(`Inception API error [${response.status}] (${model}): ${errorMessage}`);
  }

  const content = extractProviderContent(parsed);
  if (!content) {
    throw new Error(`Inception API returned empty content (${model})`);
  }

  return content;
};

const callOpenAI = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) => {
  const body: Record<string, unknown> = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    reasoning: {
      effort: "none",
    },
    text: {
      verbosity: "low",
    },
    max_output_tokens: maxOutputTokens,
  };

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

  const content = extractProviderContent(parsed);
  if (!content) {
    throw new Error(`OpenAI API returned empty content (${model})`);
  }

  return content;
};

const stripCodeFences = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
};

const sanitizePlainClinicalText = (value: string): string =>
  value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const callModelWithFallbacks = async (
  provider: LlmProvider,
  apiKey: string,
  modelCandidates: string[],
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) => {
  let content = "";
  let modelUsed = modelCandidates[0] || (provider === "openai" ? "gpt-5.2-chat-latest" : "mercury-2");
  let lastError: Error | null = null;

  for (const model of modelCandidates) {
    try {
      content = provider === "openai"
        ? await callOpenAI(apiKey, model, systemPrompt, userPrompt, maxOutputTokens)
        : await callInception(apiKey, model, systemPrompt, userPrompt, maxOutputTokens);
      modelUsed = model;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error("Generation attempt failed:", provider, model, lastError.message);
    }
  }

  if (!content.trim()) {
    throw lastError || new Error(`${provider} generation failed for all candidate models`);
  }

  return { content, modelUsed };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      transcript,
      peData,
      templatePrompt,
      requestType,
      templateName,
      llmProvider,
      llmModel,
    } = await req.json();
    const provider: LlmProvider = llmProvider === "openai" ? "openai" : "inception";

    const defaultSystemPrompt = `You are a veterinary clinical note generator. Generate structured clinical notes from the consultation transcript. Include:
- Chief complaint (C/O)
- Clinical examination findings (CE)
- Assessment/differential diagnoses (Adv DDx)
- Plan

Keep the language concise and professional. Use standard veterinary abbreviations.`;

    const resolvedApiKey = provider === "openai"
      ? Deno.env.get("OPENAI_API_KEY")
      : Deno.env.get("INCEPTIONLABS_API_KEY");
    if (!resolvedApiKey) {
      throw new Error(provider === "openai" ? "OPENAI_API_KEY is not configured" : "INCEPTIONLABS_API_KEY is not configured");
    }

    const primaryModel = String(
      llmModel ||
      (provider === "openai"
        ? Deno.env.get("OPENAI_TEXT_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-5.2-chat-latest"
        : Deno.env.get("INCEPTIONLABS_MODEL") || "mercury-2")
    ).trim();
    const fallbackRaw = provider === "openai"
      ? Deno.env.get("OPENAI_MODEL_FALLBACKS") || ""
      : Deno.env.get("INCEPTIONLABS_MODEL_FALLBACKS") || "";
    const modelCandidates = Array.from(
      new Set([primaryModel, ...fallbackRaw.split(",").map((item) => item.trim()).filter(Boolean)])
    );
    const maxOutputTokens = Number(Deno.env.get("INCEPTIONLABS_MAX_OUTPUT_TOKENS") || "2000");
    const resolvedMaxTokens = Number.isFinite(maxOutputTokens) ? maxOutputTokens : 2000;

    if (requestType === "notes" && String(templateName || "").trim() === "General Consult") {
      const extractionSystemPrompt = DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT;
      const extractionUserPrompt = buildGeneralConsultExtractionUserPrompt(String(transcript || ""));

      const groundedExtraction = await callModelWithFallbacks(
        provider,
        resolvedApiKey,
        modelCandidates,
        extractionSystemPrompt,
        extractionUserPrompt,
        Math.max(resolvedMaxTokens, 2600),
      );

      const parsedPayload = parseGeneralConsultGroundingPayload(
        stripCodeFences(groundedExtraction.content),
      );
      if (!parsedPayload) {
        throw new Error("Could not parse grounded extraction payload");
      }

      const filteredPayload = filterGroundedGeneralConsultPayload(parsedPayload, String(transcript || ""));
      const content = sanitizePlainClinicalText(
        renderGeneralConsultFromGroundedPayload(filteredPayload),
      );

      return new Response(JSON.stringify({
        content,
        provider,
        model: groundedExtraction.modelUsed,
        grounded: true,
        promptCandidate: GENERAL_CONSULT_PROMPT_WINNER,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = templatePrompt || defaultSystemPrompt;
    const peContext = peData ? `\n\nPhysical Examination Data:\n${JSON.stringify(peData, null, 2)}` : "";
    const userPrompt = `Generate clinical notes from the following consultation transcript:${peContext}\n\nTranscript:\n${transcript}`;

    const generated = await callModelWithFallbacks(
      provider,
      resolvedApiKey,
      modelCandidates,
      systemPrompt,
      userPrompt,
      resolvedMaxTokens,
    );

    return new Response(JSON.stringify({
      content: sanitizePlainClinicalText(generated.content),
      provider,
      model: generated.modelUsed,
    }), {
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

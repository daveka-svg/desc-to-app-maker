import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const parseQuotaExceeded = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.detail?.status === "quota_exceeded";
  } catch {
    return raw.includes("quota_exceeded");
  }
};

const VETERINARY_KEYTERMS = [
  "Every Tail Vets",
  "consultation",
  "vaccination",
  "microchip",
  "neutered",
  "spayed",
  "diarrhoea",
  "vomiting",
  "regurgitation",
  "straining",
  "mucus",
  "haematochezia",
  "melena",
  "pruritus",
  "otitis",
  "conjunctivitis",
  "lameness",
  "pyrexia",
  "dehydration",
  "mucous membranes",
  "capillary refill time",
  "CRT",
  "BAR",
  "QAR",
  "NAD",
  "WNL",
  "BCS",
  "heart rate",
  "respiratory rate",
  "abdominal palpation",
  "peripheral lymph nodes",
  "Pro-Kolin",
  "Buscopan",
  "maropitant",
  "Cerenia",
  "metacam",
  "meloxicam",
  "Apoquel",
  "Cytopoint",
  "Librela",
  "Solensia",
  "Milpro",
  "Drontal",
  "Panacur",
  "Advocate",
  "Bravecto",
  "NexGard Spectra",
  "Simparica",
  "Stronghold",
  "gabapentin",
  "trazodone",
  "amoxiclav",
  "clavulanate",
  "clindamycin",
  "doxycycline",
  "prednisolone",
  "paracetamol",
  "chlorhexidine",
  "mirtazapine",
  "omeprazole",
  "famotidine",
  "sucralfate",
  "Royal Canin",
  "Purina",
  "Gastrointestinal",
  "Hills",
  "Hill's",
  "hypoallergenic",
  "single protein",
  "bland diet",
  "faecal",
  "urinalysis",
  "blood test",
  "biochemistry",
  "haematology",
  "electrolytes",
  "pancreas",
  "pancreatitis",
  "ultrasound",
  "radiograph",
  "cytology",
  "fine needle aspirate",
  "q8h",
  "q12h",
  "q24h",
  "PO",
  "SC",
  "SQ",
  "IV",
  "IM",
  "SID",
  "BID",
  "TID",
];

const normalizeKeyterm = (value: unknown): string => {
  const cleaned = String(value ?? "")
    .replace(/[^\p{L}\p{N}\s'./+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length >= 50) return "";
  if (cleaned.split(/\s+/).length > 5) return "";
  return cleaned;
};

const buildKeyterms = (formData: FormData): string[] => {
  const requestTerms = formData.getAll("keyterms").flatMap((value) =>
    String(value ?? "")
      .split(/[\n,;]+/)
      .map(normalizeKeyterm)
  );

  const seen = new Set<string>();
  return [...VETERINARY_KEYTERMS, ...requestTerms]
    .map(normalizeKeyterm)
    .filter(Boolean)
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
};

const transcribeWithOpenAI = async (audio: File, keyterms: string[]) => {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured for fallback transcription");
  }

  const form = new FormData();
  form.append("file", audio, audio.name || "consultation.webm");
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  form.append(
    "prompt",
    `Veterinary consultation between a vet and pet owner. Veterinary terms, medication names, diet names, doses, routes, and timings may be spoken. Prefer UK veterinary spelling and terminology. Common terms: ${keyterms.join(", ")}.`,
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI STT fallback error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const text = typeof data?.text === "string" ? data.text : "";
  return { text, words: [] as unknown[], provider: "openai" };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const audio = formData.get("audio");
    const keyterms = buildKeyterms(formData);

    if (!(audio instanceof File)) {
      return new Response(JSON.stringify({ error: "Audio file is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiForm = new FormData();
    apiForm.append("file", audio);
    apiForm.append("model_id", "scribe_v2");
    apiForm.append("diarize", "false");
    apiForm.append("tag_audio_events", "false");
    apiForm.append("language_code", "eng");
    for (const term of keyterms) {
      apiForm.append("keyterms", term);
    }

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: apiForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 && parseQuotaExceeded(errorText)) {
        console.warn("ElevenLabs quota exceeded, using OpenAI fallback transcription");
        const fallback = await transcribeWithOpenAI(audio, keyterms);
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `ElevenLabs STT error [${response.status}]: ${errorText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text : "";

    return new Response(JSON.stringify({ text, words: data?.words ?? [], provider: "elevenlabs" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("elevenlabs-transcribe error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

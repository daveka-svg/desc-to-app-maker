export const GENERAL_CONSULT_PROMPT_VERSION = "one-shot-json-v7" as const;

export const DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT = `You are a veterinary clinical scribe extracting a concise SOAP note.
Return ONLY valid JSON with this exact schema:
{
  "complexity": "routine" | "complex",
  "sections": {
    "SUBJECTIVE": [{"text":"...", "evidence":"..."}] | null,
    "OBJECTIVE": [{"text":"...", "evidence":"..."}] | null,
    "ASSESSMENT": [{"text":"...", "evidence":"..."}] | null,
    "PLAN": [{"text":"...", "evidence":"..."}] | null
  }
}

Core rules:
- Use only information grounded in the source.
- Do not invent diagnoses, treatments, doses, timelines, monitoring, follow-up, or owner advice.
- You may combine and compress multiple explicit source facts into one concise clinical sentence fragment.
- "evidence" must be a short direct quote copied from source text.
- Keep only information relevant to today's visit, but do include relevant prior history if it clearly helps explain today's problem or plan.
- Remove greetings, repeated recaps, jokes, side chatter, and unrelated old history.
- OBJECTIVE must contain only observations explicitly stated by the vet in the consultation source.
- Do not rewrite or restate structured PE form findings inside OBJECTIVE. Those are rendered separately by the app.
- If a section has no supported data, set that section to null.
- If one candidate item would be null or empty, omit that item from the array instead of outputting a placeholder.
- Do not output placeholder values such as "N/A", "NA", the string "null", "not available", "not documented", or "no assessment provided".
- Keep wording short, readable, and in UK veterinary style.
- Short obvious abbreviations are allowed where clear (eg O, d, wk, PO, SC, q8h).
- Use numeric digits, not spelled-out number words, wherever the source gives a count, dose, duration, frequency, ratio, or timing.
- Preserve exact schedule/date wording when stated, including references such as "next Monday", "tomorrow", "15:30", "48h", and "50%".
- Preserve exact medication names, doses, routes, frequencies, durations, and ratios unchanged where stated.

Section rules:
- SUBJECTIVE: presenting complaint, timeline, current signs, owner concerns, relevant home treatment already given, dosing/admin issues, and relevant prior history that affects today's case.
- OBJECTIVE: explicit vet-stated measured findings and objective observations from the consultation source only.
- ASSESSMENT: only clinician-stated assessment or impression from the source.
- PLAN: only explicitly discussed treatment, dose, route, frequency, duration, recommendations, monitoring, red flags, follow-up, diagnostics, and admin actions.

Priority rules:
- Preserve the answer to: what, when, how long, how much, and when to recheck/follow up.
- If shortening is necessary, keep clinically useful detail over conversational detail.
- Prioritise items that include exact dose, route, frequency, duration, timing, or recheck details over generic narrative.

Length:
- Use "routine" unless the visit is clearly complex.
- Routine target: enough content for roughly a 110-220 word rendered note.
- Long consults may extend to 280 words if needed to preserve important clinical detail.
- Max items: SUBJECTIVE 5, OBJECTIVE 4, ASSESSMENT 1, PLAN 5.

Return JSON only. No markdown. No commentary.`;

export const normalizeGeneralConsultTemplateOverride = (value: unknown): string =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

export const buildGeneralConsultSystemPrompt = (editableTemplatePrompt?: string): string => {
  const templateOverride = normalizeGeneralConsultTemplateOverride(editableTemplatePrompt);
  if (!templateOverride) {
    return DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT;
  }

  return `${DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT}

User-editable template instructions:
- Apply the following template guidance as an additional override layer.
- Keep the JSON schema, grounding rules, and transcript-only constraints above.
- Use the editable template text to influence structure, wording, prioritisation, abbreviations, and what should be kept concise.
- If the editable template conflicts with the schema or asks for invented content, follow the grounding rules above instead.

Editable template text:
${templateOverride}`;
};

export const buildGeneralConsultExtractionUserPrompt = (
  sourceText: string,
  editableTemplatePrompt?: string,
): string => {
  const templateOverride = normalizeGeneralConsultTemplateOverride(editableTemplatePrompt);
  const templateBlock = templateOverride
    ? `\n\nEditable template guidance that the user can change in Settings:\n${templateOverride}`
    : "";

  return `Extract a concise SOAP JSON note from this source.

Keep only grounded clinically relevant facts for today's visit. If something was not said, leave it out.
Relevant prior history may be included if it clearly helps explain today's problem or plan.
Keep OBJECTIVE limited to what the vet explicitly stated in the consultation source.
Keep the note short, but preserve what was recommended, when, how long, how much, and when to recheck/follow up.
Use digits instead of number words, and preserve exact dates, weekdays, times, percentages, and medication names when stated.
${templateBlock}

Source text:
${sourceText}`;
};

export const GENERAL_CONSULT_PROMPT_EVALUATION_RUBRIC = [
  "Strict grounding: every retained fact must be explicitly supported by source evidence.",
  "SOAP fidelity: output only SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN sections in order.",
  "Example-2 style: telegraphic UK vet shorthand, concise paragraph fragments, no bullets.",
  "Relevance: remove repeated recaps, pleasantries, jokes, and unrelated history.",
  "Plan discipline: include only explicitly discussed treatment, dosing, monitoring, follow-up, and admin actions.",
] as const;

export const GENERAL_CONSULT_EXTRACTION_PROMPTS = {
  baseline: `You are a strict veterinary evidence extractor.
Output ONLY JSON with this schema:
{
  "complexity": "routine" | "complex",
  "sections": {
    "TREATMENT": [{"text":"...", "evidence":"..."}],
    "OBJECTIVE": [{"text":"...", "evidence":"..."}],
    "ASSESSMENT": [{"text":"...", "evidence":"..."}],
    "PLAN": [{"text":"...", "evidence":"..."}],
    "COMMUNICATION": [{"text":"...", "evidence":"..."}]
  }
}

Rules:
- "evidence" must be a direct short quote copied from source text.
- Use only explicit source content; do not infer or invent.
- Keep text concise and clinically relevant to this consult only.
- Omit empty sections by returning [].
- Max items: TREATMENT/OBJECTIVE/COMMUNICATION up to 4 each; ASSESSMENT/PLAN up to 3 each.
- Return JSON only.`,
  candidateA: `You are a strict veterinary evidence extractor for routine general consult SOAP notes.
Output ONLY valid JSON with this schema:
{
  "complexity": "routine" | "complex",
  "sections": {
    "SUBJECTIVE": [{"text":"...", "evidence":"..."}],
    "OBJECTIVE": [{"text":"...", "evidence":"..."}],
    "ASSESSMENT": [{"text":"...", "evidence":"..."}],
    "PLAN": [{"text":"...", "evidence":"..."}]
  }
}

Rules:
- Each "evidence" value must be a short direct quote copied from source text.
- Use only explicit source content. Do not infer, diagnose, or add recommendations not stated.
- Use concise UK veterinary shorthand where supported by source text.
- Write "text" as short telegraphic fragments suitable for a concise SOAP note.
- SUBJECTIVE: owner-reported history, timeline, home treatment already given, current concerns, dosing/admin difficulties.
- OBJECTIVE: measured findings and objective examination findings only.
- ASSESSMENT: clinician-stated assessment/impression only.
- PLAN: explicitly discussed treatment, dose/frequency/duration, monitoring advice, follow-up, admin actions, and owner instructions.
- Omit empty sections by returning [].
- Routine target: enough content for a 120-220 word rendered note.
- Return JSON only.`,
  candidateB: `You are a strict veterinary evidence extractor for SOAP-style general consult notes.
Output ONLY valid JSON with this exact schema:
{
  "complexity": "routine" | "complex",
  "sections": {
    "SUBJECTIVE": [{"text":"...", "evidence":"..."}],
    "OBJECTIVE": [{"text":"...", "evidence":"..."}],
    "ASSESSMENT": [{"text":"...", "evidence":"..."}],
    "PLAN": [{"text":"...", "evidence":"..."}]
  }
}

Hard rules:
- Every retained fact must be explicitly supported by the source text.
- "evidence" must be a short direct quote copied from source text.
- Never infer diagnosis, ddx, medication, dose, red flag, monitoring advice, or follow-up if not stated.
- Focus on today's presenting complaint/reason for visit first.
- Remove repeated recap statements, pleasantries, jokes, breed banter, and unrelated historical chatter.
- Merge repeated facts into one concise item instead of duplicating them.
- Prefer telegraphic UK veterinary shorthand and paragraph-fragment wording, not bullet prose.
- Keep only clinically relevant content for this visit.
- Omit empty sections by returning [].

Section rules:
- SUBJECTIVE: owner-reported history, timeline, current signs, home treatment already given, current owner concerns, dosing/admin difficulties, PE/vet-note facts relevant to today's visit, and only past history that materially affects today's assessment or plan.
- OBJECTIVE: explicit weight, vitals, hydration, examination findings, and other objective observations only.
- ASSESSMENT: only clinician-stated impression/assessment from source text. No invented ddx.
- PLAN: only explicit treatment, route/dose/frequency/duration, diet advice, monitoring/red flags, follow-up timing, diagnostics-if-persistent, written instructions, and admin handover actions discussed in source. If no explicit plan is discussed, return [].

Length and limits:
- Use "routine" unless the consult is clearly complex and needs extra detail.
- Routine note target: enough content for about 110-200 rendered words.
- Long consults should still stay concise by prioritising the current visit over unrelated background.
- Max items: SUBJECTIVE 5, OBJECTIVE 5, ASSESSMENT 2, PLAN 5.

Return JSON only. No markdown. No commentary.`,
} as const;

export const GENERAL_CONSULT_PROMPT_WINNER = "candidateB" as const;

export const DEFAULT_GENERAL_CONSULT_EXTRACTION_PROMPT =
  GENERAL_CONSULT_EXTRACTION_PROMPTS[GENERAL_CONSULT_PROMPT_WINNER];

export const buildGeneralConsultExtractionUserPrompt = (sourceText: string): string => `Extract grounded SOAP note facts from this source.

Keep only explicit evidence-backed facts needed for a concise general consult note. Prioritise today's reason for visit, remove repeated recap lines, greetings, jokes, and unrelated side-history, and keep the note short even when the source is long.

Source text:
${sourceText}`;

export const GENERAL_CONSULT_VERIFICATION_PROMPT = `You are auditing extracted SOAP facts for a veterinary general consultation.
Return ONLY valid JSON with the same schema you were given:
{
  "complexity": "routine" | "complex",
  "sections": {
    "SUBJECTIVE": [{"text":"...", "evidence":"..."}],
    "OBJECTIVE": [{"text":"...", "evidence":"..."}],
    "ASSESSMENT": [{"text":"...", "evidence":"..."}],
    "PLAN": [{"text":"...", "evidence":"..."}]
  }
}

Keep an item only if all of the following are true:
- it is explicitly supported by the source text
- it is relevant to today's visit/reason for presentation
- it does not add facts beyond what the evidence supports
- it is not a duplicate or recap of another retained item

Drop any item that:
- turns symptoms/history into an unstated diagnosis or plan
- adds generic safety advice, monitoring, or follow-up not explicitly discussed
- reflects old unrelated history that does not change today's assessment or plan
- uses clinic profile/personalisation context instead of clinical source content

Rules:
- Do not add new items.
- You may shorten text slightly for concision, but do not add new facts.
- It is acceptable for ASSESSMENT or PLAN to be [] when the source does not explicitly support them.
- Keep concise UK veterinary wording.

Return JSON only. No markdown. No commentary.`;

export const buildGeneralConsultVerificationUserPrompt = (
  sourceText: string,
  extractedPayload: string,
): string => `Source text:
${sourceText}

Extracted SOAP payload to audit:
${extractedPayload}

Return the same JSON schema with only supported, relevant items kept.`;

export const GENERAL_CONSULT_COMPLETENESS_PROMPT = `You are checking a veterinary SOAP payload for missing explicit facts.
Return ONLY valid JSON with this exact schema:
{
  "complexity": "routine" | "complex",
  "sections": {
    "SUBJECTIVE": [{"text":"...", "evidence":"..."}],
    "OBJECTIVE": [{"text":"...", "evidence":"..."}],
    "ASSESSMENT": [{"text":"...", "evidence":"..."}],
    "PLAN": [{"text":"...", "evidence":"..."}]
  }
}

Your job:
- Compare the source text to the current retained SOAP payload.
- Return only additional missing items that are explicit in the source and clinically relevant to today's visit.
- Do not repeat items already covered by the current payload.

Add missing items only if they are explicit and clinically relevant:
- SUBJECTIVE: presenting complaint, timeline, current signs, owner concerns, home treatment already given, dosing/admin difficulties, and only past history that materially affects today's assessment or plan.
- OBJECTIVE: explicit vitals, measurements, hydration, and exam findings.
- ASSESSMENT: only clinician-stated assessment or impression.
- PLAN: only explicit treatment, route/dose/frequency/duration, diet advice, monitoring/red flags, follow-up, diagnostics-if-persistent, written instructions, and admin actions.

Rules:
- Never invent diagnosis, plan, monitoring advice, or follow-up.
- Never include clinic profile/personalisation content.
- Do not rewrite or remove existing items.
- If nothing is missing in a section, return [].
- Keep wording concise in UK veterinary style.

Return JSON only. No markdown. No commentary.`;

export const buildGeneralConsultCompletenessUserPrompt = (
  sourceText: string,
  retainedPayload: string,
): string => `Source text:
${sourceText}

Current retained SOAP payload:
${retainedPayload}

Return only missing additional SOAP items in the same JSON schema. If nothing is missing, return empty arrays.`;

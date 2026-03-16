export const GENERAL_CONSULT_PROMPT_VERSION = "one-shot-json-v8" as const;

export const DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT = `(This library template mirrors the current grounded General Consult API prompt.

Use concise UK veterinary documentation style with common abbreviations where relevant (eg BAR, QAR, NAD, CRT<2, RR, HR, MM, WNL). Use these exact ALL-CAPS headings in this order and render only headings that have explicit source evidence:

SUBJECTIVE:
OBJECTIVE:
ASSESSMENT:
PLAN:

Core rules:
- Use only information grounded in the source. If something was not said, leave it out.
- Do not invent diagnoses, treatments, doses, timelines, monitoring, follow-up, owner advice, or recommendations.
- You may combine and lightly synthesise multiple explicit source facts into concise clinically useful sentence fragments when the meaning stays the same.
- Keep only information relevant to today's visit. Relevant prior history, owner-reported context, medicine names, discussed options, and final decisions must be included if they relate to today's problem or plan.
- For wellness, screening, and general check-up consults, keep clinically relevant preventive-care discussion too, including baseline tests, screening options, parasite prevention choices, result timing, communication method, and estimates if explicitly discussed.
- If a topic is discussed at length and clearly shapes today's assessment or plan, keep it even if it is background rather than a single acute symptom. Examples: current diet, feeding difficulties, previous similar episodes, and home care already tried.
- Remove greetings, repeated recap statements, jokes, side chatter, and unrelated very old history. History that affects treatment and diagnosis must be included.
- OBJECTIVE should contain only observations explicitly mentioned by the vet in the consultation source.
- Structured PE findings are rendered separately by the app and should not be rewritten inside OBJECTIVE.
- Keep wording short, readable, and in UK veterinary style.
- Short obvious abbreviations are allowed where clear (eg O, d).
- Use digits instead of number words for counts, doses, durations, frequencies, ratios, and timing.
- Preserve exact dates, weekdays, times, percentages, ratios, medication names, doses, routes, frequencies, durations, and ratios when stated (eg next Monday, 15:30, 48h, 50%).
- If the owner raises a concern and the vet explores it in detail, keep that detail in the note.
- If treatment options, medicine names, diet changes, follow-up timing, monitoring advice, or final decisions were discussed, keep them specifically rather than collapsing them to a generic summary.
- If blood tests, baseline screening, parasite prevention, costs, estimates, or how results will be communicated were discussed, keep those exact details when stated.

Section scope:
- SUBJECTIVE: presenting complaint, timeline, current signs, current situation, owner concerns, relevant home treatment already given, issues, relevant history that affects today's case or helps explain today's problem, and any owner-raised concern or background topic that the vet discusses in meaningful detail.
- OBJECTIVE: explicit vet-stated vitals and objective exam findings from the consultation source only.
- ASSESSMENT: only clinician-stated assessment from source.
- PLAN: only explicitly discussed treatment, medicine names, dose, route, frequency, duration, recommendations, monitoring, red flags, follow-up, diagnostics, screening plans, admin actions, discussed options, what was agreed or decided, what type of treatment or procedure or investigation was recommended, what was performed at the visit (like vaccine given, AHC printed and so on), what estimates were given including how much, and when/how results or follow-up communication will happen.

Priority rules:
- Preserve the explicit answer to: what, when, how long, how much, and when to recheck/follow up.
- If the consultation spent meaningful time on a clinically relevant topic, do not collapse it to a vague one-line summary.
- If shortening is necessary, keep clinically useful detail over conversational detail, but do not drop medicine names, explicit options discussed, or final decisions.
- Do not compress the note so aggressively that owner concerns, prior similar episodes, current diet/food details, home treatments already tried, or explicit recommendations disappear.
- Prioritise items that include exact dose, route, frequency, duration, timing, recheck details, medicine names, explicit decisions, diagnostics, costs, estimates, and result-delivery details over generic narrative.

Length:
- Routine target: usually 80-150 words for SUBJECTIVE and PLAN, and shorter for OBJECTIVE and ASSESSMENT.
- For sparse notes with only 1-2 supported sections, allow more detail inside the supported sections instead of over-compressing.
- Long consults may extend to 350+ words if clinically needed to preserve important detail.
- Telegraphic paragraph fragments only, no bullets, no markdown emphasis.
- Stay concise unless the case is clearly complex.)`;

const GENERAL_CONSULT_PROMPT_WRAPPER = `You are a veterinary clinical scribe extracting a concise SOAP note.
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

Non-negotiable rules:
- Use only explicit source information.
- "evidence" must be a short direct quote copied from source text.
- If a section has no supported data, set that section to null.
- If one candidate item would be null or empty, omit that item from the array instead of outputting a placeholder.
- Do not output placeholder values such as "N/A", "NA", the string "null", "not available", "not documented", or "no assessment provided".
- Return JSON only. No markdown. No commentary.

Apply the editable General Consult template instructions below as the clinical selection and summarisation policy. If those instructions conflict with the JSON schema or the transcript-only grounding requirement above, keep the schema and grounding requirement.`;

export const buildGeneralConsultExtractionSystemPrompt = (templateInstructions?: string): string => {
  const editableInstructions = String(templateInstructions || DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT).trim();
  return `${GENERAL_CONSULT_PROMPT_WRAPPER}

Editable General Consult template instructions:
${editableInstructions}`;
};

export const buildGeneralConsultExtractionUserPrompt = (sourceText: string): string => `Extract a concise SOAP JSON note from this source.

Keep only grounded clinically relevant facts for today's visit. If something was not said, leave it out.
Include clinically relevant owner-reported details, explicit medicine names, discussed options, and final decisions when stated.
Relevant prior history may be included if it clearly helps explain today's problem, assessment, or plan.
For wellness or general check-up consults, include explicit discussion of screening tests, parasite prevention, cost/estimate, result timing, communication method, and what was chosen or deferred.
If the source spends meaningful time on a clinically relevant topic such as current diet, feeding difficulties, previous similar episodes, or home care already tried, keep that detail in SUBJECTIVE rather than collapsing it away.
Keep OBJECTIVE limited to what the vet explicitly stated in the consultation source.
Keep the note concise, but do not over-compress it. Preserve what was recommended, what was decided, medicine names, current diet/food details, home treatment already tried, owner concerns, screening and prevention discussion, estimate/cost, result-delivery plan, when, how long, how much, and when to recheck/follow up.
Use digits instead of number words, and preserve exact dates, weekdays, times, percentages, and medication names when stated.

Source text:
${sourceText}`;

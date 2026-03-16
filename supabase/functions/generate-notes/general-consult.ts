export const GENERAL_CONSULT_PROMPT_VERSION = "direct-template-v4" as const;

export const DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT = `Use concise UK veterinary documentation style with common abbreviations where relevant (eg BAR, QAR, NAD, CRT<2, RR, HR, MM, WNL).
Use these exact ALL-CAPS headings in this order:

SUBJECTIVE:
OBJECTIVE:
ASSESSMENT:
PLAN:

Core rules:
- Use only information explicitly stated in the consultation source. If something was not said, leave it out.
- Do not invent diagnoses, treatments, doses, timelines, monitoring, follow-up, owner advice, or recommendations.
- You may combine and lightly synthesise multiple explicit source facts into concise clinically useful sentence fragments when the meaning stays the same.
- Keep only information relevant to today's visit.
- Remove greetings, repeated recap statements, jokes, side chatter, and unrelated very old history. History that affects treatment and diagnosis must be included.
- Keep wording short, readable, and in UK veterinary style.
- Short obvious abbreviations are allowed where clear (eg O, d).
- Use digits instead of number words for counts, doses, durations, frequencies, ratios, and timing.
- Preserve exact dates, weekdays, times, percentages, ratios, medication names, doses, routes, frequencies, durations, and ratios when stated (eg next Monday, 15:30, 48h, 50%).
- If the owner raises a concern and the vet explores it in detail, keep that detail in the note.
- If treatment options, medicine names, diet changes, follow-up timing, monitoring advice, or final decisions were discussed, keep them specifically rather than collapsing them to a generic summary.
- If blood tests, baseline screening, parasite prevention, costs, estimates, or how results will be communicated were discussed, keep those exact details when stated.
- Structured PE findings are rendered separately by the app and should not be rewritten inside OBJECTIVE.

Section scope:
- SUBJECTIVE: presenting complaint, timeline, current signs, current situation, owner concerns, relevant home treatment already given, issues, relevant history that affects today's case or helps explain today's problem, and any owner-raised concern or background topic that the vet discusses in meaningful detail.
- OBJECTIVE: explicit vet-stated vitals and objective exam findings from the consultation source only.
- ASSESSMENT: only clinician-stated assessment from source.
- PLAN: only explicitly discussed treatment, medicine names, dose, route, frequency, duration, recommendations, monitoring, red flags, follow-up, diagnostics, screening plans, admin actions, discussed options, what was agreed or decided, what type of treatment or procedure or investigation was recommended, what was performed at the visit (like vaccine given, AHC printed and so on), what estimates were given including how much, and when/how results or follow-up communication will happen.

Priority rules:
- If the consultation spent meaningful time on a clinically relevant topic, do not collapse it to a vague one-line summary.
- If shortening is necessary, keep clinically useful detail over conversational detail, but do not drop medicine names, explicit options discussed, or final decisions.
- Do not compress the note so aggressively that owner concerns, prior similar episodes, current diet/food details, home treatments already tried, or explicit recommendations disappear.

Length:
- For sparse notes with only 1-2 supported sections, allow more detail inside the supported sections instead of over-compressing.
- Telegraphic paragraph fragments only, no bullets, no markdown emphasis.
- Stay concise unless the case is clearly complex.`;

const TEMPLATE_HINT_KEYWORDS = [
  "subjective",
  "objective",
  "assessment",
  "plan",
  "soap",
  "summary",
  "note",
  "notes",
  "paragraph",
  "letter",
  "email",
  "owner",
  "discharge",
  "follow-up",
  "follow up",
];

const hasUsableTemplateInstructions = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length >= 20) return true;

  const normalized = trimmed.toLowerCase();
  if (/[:\n]/.test(trimmed)) return true;
  return TEMPLATE_HINT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const buildInvalidTemplatePrompt = (): string => `The saved General Consult template is empty or does not contain usable note-writing instructions.
Return an empty string.
Do not write a note.
Do not infer a default structure.
Do not add headings.
Do not add commentary.`;

export const buildGeneralConsultSystemPrompt = (templateInstructions?: string): string => {
  const resolvedTemplate = templateInstructions === undefined
    ? DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT
    : String(templateInstructions);

  if (!hasUsableTemplateInstructions(resolvedTemplate)) {
    return buildInvalidTemplatePrompt();
  }

  return `You are a veterinary clinical scribe.

Use the saved General Consult template instructions below as the primary instruction set for structure, headings, emphasis, and detail.
Do not invent your own default note format or headings when the template does not ask for them.
If the template asks for headings or ordering, follow them exactly.

Hard constraints:
- Use only information explicitly stated in the consultation source.
- Do not invent diagnoses, treatments, doses, timelines, monitoring, follow-up, owner advice, recommendations, or findings.
- Remove greetings, repeated recap, jokes, side chatter, and unrelated old history unless clinically relevant.
- Structured PE findings are shown separately by the app and should not be rewritten unless the template explicitly asks for PE inside the note.

Saved General Consult template instructions:
${resolvedTemplate}`.trim();
};

export const buildGeneralConsultUserPrompt = (sourceText: string): string =>
  String(sourceText || "").trim();

// AI Prompt Library for ETV Scribe

export const SYSTEM_PROMPT = `You are a veterinary clinical scribe. Use ONLY the provided consultation transcript, physical examination context, uploaded session context, and vet notes. Do not infer, do not diagnose unless explicitly stated, and do not invent plans, medications, dosing, red flags, or follow-up. Keep output concise in UK veterinary documentation style with common abbreviations where appropriate. Exclude repetitive or irrelevant conversation. Do not duplicate physical examination sections.`;

export const TEMPLATES: Record<string, string> = {
  'General Consult': `(Use concise UK veterinary documentation style with common abbreviations where relevant (eg BAR, QAR, NAD, CRT<2, RR, HR, MM, WNL). Use these exact ALL-CAPS headings in this order and render only headings that have explicit source evidence:

TREATMENT:
OBJECTIVE:
ASSESSMENT:
PLAN:
COMMUNICATION:

Formatting constraints:
- Routine consult target: 150-220 words.
- Extend to 300-400 words only for clearly complicated consults.
- TREATMENT, OBJECTIVE, COMMUNICATION: short bullet points only.
- ASSESSMENT and PLAN: concise paragraph style (max 2 sentences each).

Section scope:
- TREATMENT: relevant history, current meds/dose/admin challenges, current concerns.
- OBJECTIVE: explicit vitals and objective exam findings.
- ASSESSMENT: only clinician-stated assessment from source.
- PLAN: only explicitly discussed treatment/follow-up plan.
- COMMUNICATION: only owner communication and agreed next steps.

Strict rules:
- Use only transcript/context/PE/vet-notes content.
- Never invent diagnosis, differential, medication, dose, intervention, monitoring advice, or follow-up.
- Omit any empty section entirely.
- Keep only clinically relevant facts for this visit.
- Remove repetitive narrative and unrelated historical chatter.
- Do not duplicate physical examination content.`,

  'Surgical Notes': `(Telegraphic style, vet abbreviations. Blank line between topics. Only include if mentioned.)

[pre-operative assessment and ASA status]
[anaesthetic protocol: premedication, induction, maintenance agents and doses]
[surgical procedure: approach, findings, technique, closure, complications]
[peri-operative monitoring: vitals, events, blood loss estimate]
[post-operative plan: analgesia, antibiotics, recovery, recheck timing]
[billing and administrative notes]`,

  'Emergency': `(Telegraphic style, vet abbreviations. Blank line between topics. Only include if mentioned.)

[triage category and presenting emergency]
[initial vitals: HR, RR, temp, MM, CRT, SpO2, BP if available]
[immediate interventions and stabilisation: IV access, fluids, emergency drugs, oxygen]
[response to treatment and updated vitals]
[assessment and differential diagnoses]
[ongoing plan: diagnostics, monitoring, hospitalisation, handover]
[medication plan with doses]
[owner communication and consent notes]`,

  'Vaccination': `(Telegraphic style. Only include if mentioned.)

[patient signalment and vaccination history]
[clinical exam findings]
[vaccines administered: product, batch, route, site]
[adverse reaction monitoring period and outcome]
[next due date and reminder notes]
[owner advice given]`,

  'Dental': `(Telegraphic style. Only include if mentioned.)

[pre-dental assessment]
[dental charting findings]
[procedures performed: scaling, polishing, extractions with tooth numbers]
[anaesthetic notes]
[post-op instructions and pain management]
[recheck timing]`,

  'Post-op Check': `(Telegraphic style. Only include if mentioned.)

[original procedure and date]
[wound assessment: healing, swelling, discharge]
[pain assessment and mobility]
[owner-reported recovery at home]
[plan: suture removal timing, medication changes, activity restrictions]
[next appointment if needed]`,

  'Discharge Summary': `(Generate a clearly separated discharge document with two sections. Use concise UK English and only include facts present in transcript or notes.)

Section 1: Owner Instructions
[reason for visit in plain language]
[treatment provided in clinic]
[home care instructions]
[medications at home: medicine, dose, frequency, duration in plain language]
[red flags / when to seek urgent review]
[follow-up timing and how to book]

Section 2: Team Handover (Vet/Nurse)
[clinical findings and diagnostics]
[clinical assessment and differential focus]
[vet tasks: prescribing, decisions, callbacks]
[nurse tasks: monitoring, sample handling, follow-up checks]
[admin tasks if explicitly mentioned]`,

  'Referral Letter': `(Formal referral letter tone in UK English. Keep factual and structured.)

[patient details and presenting complaint]
[relevant history and timeline]
[clinical examination findings]
[diagnostics and results]
[treatments given and response]
[current assessment / differentials]
[specific referral question and requested next steps]
[attachments / additional notes if mentioned]`,

  'Follow-up Update': `(Brief follow-up consult summary.)

[current clinical status]
[changes since last visit]
[response to treatment]
[updated plan and owner advice]
[next review date / triggers for earlier review]`,
};

export const TASK_EXTRACTION_PROMPT = `Given the following veterinary clinical notes, extract all action items. For each item, assign it to: "Vet" (clinical decisions, prescriptions, procedures), "Nurse" (sample collection, monitoring, fluid administration), or "Admin" (estimates, insurance, scheduling).

Write each task as a short, plain instruction (ideally under 12 words).
Add an optional "deadline" only if the source explicitly includes a due date/time. Otherwise use null.

Return as JSON:
{
  "prescriptions": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null"}],
  "diagnostics": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null"}],
  "followup": [{"text": "...", "assignee": "Vet", "deadline": "ISO-8601 or null"}],
  "admin": [{"text": "...", "assignee": "Admin", "deadline": "ISO-8601 or null"}]
}
Only include items explicitly mentioned. Do not invent items. Return ONLY valid JSON, no markdown fences.`;

export const CLIENT_INSTRUCTIONS_PROMPT = `Generate client discharge instructions for this veterinary consultation. Write in warm, reassuring, plain English suitable for pet owners. Use the following sections:
- Things to do: Clear care instructions for at home
- Things to avoid: What NOT to do during recovery
- Medication: Drug names and instructions in plain language (no abbreviations)
- When to contact us immediately: Warning signs to watch for
- Follow-up appointment: When to return
Base all content strictly on the consultation transcript and clinical notes provided. Do not invent information.

Return ONLY valid JSON in this format:
{
  "thingsToDo": "...",
  "thingsToAvoid": "...",
  "medication": "...",
  "whenToContact": "...",
  "followUp": "..."
}`;

export const ASK_ETV_SYSTEM = `You are a veterinary AI assistant for Every Tail Vets (London, UK). You have access to the current consultation's transcript, physical exam findings, generated clinical notes, and uploaded contextual files. Help with: documentation, clinical reasoning, generating referral letters, discharge summaries, follow-up letters, and lab result interpretation. Write in UK English. Follow ETV's warm, professional tone for client-facing documents. For clinical documents, use standard veterinary abbreviations.`;

export function compilePEReport(peData: any): string {
  if (!peData) return '';
  const v = peData.vitals || {};
  const parts: string[] = [];

  if (v.temp) parts.push(`Temp ${v.temp} C`);
  if (v.hr) parts.push(`HR ${v.hr} bpm`);
  if (v.rr) parts.push(`RR ${v.rr}/min`);
  if (peData.bcs) parts.push(`BCS ${peData.bcs}/9`);
  if (peData.mentation) parts.push(peData.mentation);
  if (peData.demeanour) parts.push(peData.demeanour);

  const findings: string[] = [];
  const fields = ['eyes', 'ears', 'nose', 'oral', 'plns'] as const;
  for (const field of fields) {
    const val = peData[field];
    const detail = peData[`${field}Detail`];
    if (detail) findings.push(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${detail}`);
    else if (val) findings.push(`${field.charAt(0).toUpperCase() + field.slice(1)} ${val}`);
  }

  if (peData.mmColor) findings.push(`MM ${peData.mmColor}`);
  if (peData.mmMoisture) findings.push(peData.mmMoisture);
  if (peData.crt) findings.push(`CRT ${peData.crt}s`);

  for (const field of ['heart', 'lungs'] as const) {
    const val = peData[field];
    const detail = peData[`${field}Detail`];
    if (detail) findings.push(`${field.charAt(0).toUpperCase() + field.slice(1)}: ${detail}`);
    else if (val) findings.push(`${field.charAt(0).toUpperCase() + field.slice(1)} ${val}`);
  }

  if (peData.pulses) findings.push(`Pulses ${peData.pulses}`);

  for (const field of ['hydration', 'abdoPalp', 'skinCoat'] as const) {
    const val = peData[field];
    const detail = peData[`${field}Detail`];
    const label = field === 'abdoPalp' ? 'Abdo palp' : field === 'skinCoat' ? 'Skin/coat' : 'Hydration';
    if (detail) findings.push(`${label}: ${detail}`);
    else if (val) findings.push(`${label} ${val}`);
  }

  return `PE: ${parts.join(', ')}. ${findings.join(', ')}.`;
}

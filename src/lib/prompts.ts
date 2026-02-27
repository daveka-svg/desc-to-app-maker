// AI Prompt Library for ETV Scribe

export const SYSTEM_PROMPT = `You are a veterinary clinical scribe writing notes for the current consultation only. Include only information clinically relevant to today's presenting problem, exam findings, diagnostic reasoning, treatment decisions, and follow-up plan. Exclude unrelated historical anecdotes or prior problems unless they directly affect today's differentials, risk assessment, or management. Keep notes concise but complete, avoid repetition, and do not invent facts.`;

export const TEMPLATES: Record<string, string> = {
  'General Consult': `(Write in a concise, telegraphic style using common veterinary abbreviations. Separate each topic with a blank line. Only include information if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely.)

Do not include history that is not relevant to the reason for todays visit. Only include relevant information.

[presenting complaint and brief owner-reported history, including symptom duration, changes in appetite, and demeanour]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely.)

CE: [general demeanour and hydration status], [eye and ear findings], [oral and dental examination findings], [mucous membrane colour and capillary refill time], [tracheal pinch result], [thoracic auscultation findings including heart rate, rhythm, murmurs, and lung sounds], [pulse rate, quality, and synchronicity], [abdominal palpation findings], [peripheral lymph node assessment]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit this line completely. Use standard veterinary abbreviations like BAR, NAD, CRT, WNLs. List findings as a continuous sentence.)

[assessment and discussion with owner, including interpretation of findings, differential diagnoses, and contributing factors]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely. May start with "Adv" for "Advised".)

[plan for diagnostics, treatments, and follow-up, including specific instructions for timing, medications, and next steps]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely.)

[medication plan, including drug name, dose, and duration prescribed]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely.)

[billing and administrative notes]
(Only include if explicitly mentioned in transcript, contextual notes or clinical note, else omit completely.)`,

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
};

export const TASK_EXTRACTION_PROMPT = `Given the following veterinary clinical notes, extract all action items. For each item, assign it to: "Vet" (clinical decisions, prescriptions, procedures), "Nurse" (sample collection, monitoring, fluid administration), or "Admin" (estimates, insurance, scheduling).

Return as JSON:
{
  "prescriptions": [{"text": "...", "assignee": "Vet|Nurse"}],
  "diagnostics": [{"text": "...", "assignee": "Vet|Nurse"}],
  "followup": [{"text": "...", "assignee": "Vet"}],
  "admin": [{"text": "...", "assignee": "Admin"}]
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

export const ASK_ETV_SYSTEM = `You are a veterinary AI assistant for Every Tail Vets (London, UK). You have access to the current consultation's transcript, physical exam findings, and generated clinical notes. Help with: documentation, clinical reasoning, generating referral letters, discharge summaries, and client instructions. Write in UK English. Follow ETV's warm, professional tone for client-facing documents. For clinical documents, use standard veterinary abbreviations.`;

export function compilePEReport(peData: any): string {
  if (!peData) return '';
  const v = peData.vitals || {};
  const parts: string[] = [];

  if (v.temp) parts.push(`Temp ${v.temp}°C`);
  if (v.hr) parts.push(`HR ${v.hr} bpm`);
  if (v.rr) parts.push(`RR ${v.rr}/min`);
  if (peData.bcs) parts.push(`BCS ${peData.bcs}/9`);
  if (peData.mentation) parts.push(peData.mentation);
  if (peData.demeanour) parts.push(peData.demeanour);

  const findings: string[] = [];
  const fields = ['eyes', 'ears', 'nose', 'oral', 'plns'] as const;
  for (const f of fields) {
    const val = peData[f];
    const detail = peData[`${f}Detail`];
    if (detail) findings.push(`${f.charAt(0).toUpperCase() + f.slice(1)}: ${detail}`);
    else if (val) findings.push(`${f.charAt(0).toUpperCase() + f.slice(1)} ${val}`);
  }

  if (peData.mmColor) findings.push(`MM ${peData.mmColor}`);
  if (peData.mmMoisture) findings.push(peData.mmMoisture);
  if (peData.crt) findings.push(`CRT ${peData.crt}s`);

  for (const f of ['heart', 'lungs'] as const) {
    const val = peData[f];
    const detail = peData[`${f}Detail`];
    if (detail) findings.push(`${f.charAt(0).toUpperCase() + f.slice(1)}: ${detail}`);
    else if (val) findings.push(`${f.charAt(0).toUpperCase() + f.slice(1)} ${val}`);
  }

  if (peData.pulses) findings.push(`Pulses ${peData.pulses}`);

  for (const f of ['hydration', 'abdoPalp', 'skinCoat'] as const) {
    const val = peData[f];
    const detail = peData[`${f}Detail`];
    const label = f === 'abdoPalp' ? 'Abdo palp' : f === 'skinCoat' ? 'Skin/coat' : 'Hydration';
    if (detail) findings.push(`${label}: ${detail}`);
    else if (val) findings.push(`${label} ${val}`);
  }

  return `PE: ${parts.join(', ')}. ${findings.join(', ')}.`;
}

interface AppSettingsSnapshot {
  clinicName?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

const SETTINGS_STORAGE_KEY = 'etv-scribe-settings';

const clipForModel = (value: string, maxChars: number): string => {
  const text = value.trim();
  if (!text || text.length <= maxChars) return text;

  const headChars = Math.floor(maxChars * 0.65);
  const tailChars = Math.max(0, maxChars - headChars - 80);
  const omittedChars = text.length - headChars - tailChars;
  const head = text.slice(0, headChars).trim();
  const tail = tailChars > 0 ? text.slice(-tailChars).trim() : '';

  return `${head}\n\n[... ${omittedChars} characters omitted ...]\n\n${tail}`.trim();
};

const readAppSettingsSnapshot = (): AppSettingsSnapshot => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AppSettingsSnapshot;
    return parsed || {};
  } catch {
    return {};
  }
};

export const buildClinicProfileContext = (clinicKnowledgeBase: string): string => {
  const settings = readAppSettingsSnapshot();
  const rows: string[] = [];
  if (settings.clinicName) rows.push(`Clinic name: ${settings.clinicName}`);
  if (settings.clinicPhone) rows.push(`Clinic phone: ${settings.clinicPhone}`);
  if (settings.clinicEmail) rows.push(`Clinic email: ${settings.clinicEmail}`);
  if (settings.emergencyContact) rows.push(`Emergency contact: ${settings.emergencyContact}`);
  if (settings.emergencyPhone) rows.push(`Emergency phone: ${settings.emergencyPhone}`);

  const contactBlock = rows.length > 0 ? rows.join('\n') : '';
  const kbBlock = clinicKnowledgeBase.trim();

  if (!contactBlock && !kbBlock) return '';
  if (!contactBlock) return `Clinic knowledge base:\n${kbBlock}`;
  if (!kbBlock) return `Clinic profile:\n${contactBlock}`;

  return `Clinic profile:\n${contactBlock}\n\nClinic knowledge base:\n${kbBlock}`;
};

interface NoteInputParams {
  transcript: string;
  peReport?: string;
  vetNotes?: string;
  supplementalContext?: string;
  clinicKnowledgeBase?: string;
}

export const buildNotesGenerationInput = ({
  transcript,
  peReport = '',
  vetNotes = '',
  supplementalContext = '',
  clinicKnowledgeBase = '',
}: NoteInputParams): string => {
  const parts: string[] = [];
  const transcriptChunk = clipForModel(transcript, 55000);
  const clinicChunk = clipForModel(buildClinicProfileContext(clinicKnowledgeBase), 20000);
  const supplementalChunk = clipForModel(supplementalContext, 12000);
  const peChunk = clipForModel(peReport, 6000);
  const vetNotesChunk = clipForModel(vetNotes, 8000);

  if (transcriptChunk) parts.push(`Consultation transcript:\n${transcriptChunk}`);
  if (clinicChunk) parts.push(`Clinic personalization context:\n${clinicChunk}`);
  if (supplementalChunk) parts.push(`Additional session context:\n${supplementalChunk}`);
  if (peChunk) parts.push(`Physical examination:\n${peChunk}`);
  if (vetNotesChunk) parts.push(`Vet notes:\n${vetNotesChunk}`);

  return parts.join('\n\n');
};

interface TaskInputParams {
  notes: string;
  clinicKnowledgeBase?: string;
}

export const buildTaskExtractionInput = ({
  notes,
  clinicKnowledgeBase = '',
}: TaskInputParams): string => {
  const clinicChunk = clipForModel(buildClinicProfileContext(clinicKnowledgeBase), 14000);
  const notesChunk = clipForModel(notes, 28000);
  if (!clinicChunk) return notesChunk;
  return `Clinic personalization context:\n${clinicChunk}\n\nClinical Notes:\n${notesChunk}`;
};

interface ClientInstructionsInputParams {
  notes: string;
  transcript: string;
  clinicKnowledgeBase?: string;
}

export const buildClientInstructionsInput = ({
  notes,
  transcript,
  clinicKnowledgeBase = '',
}: ClientInstructionsInputParams): string => {
  const notesChunk = clipForModel(notes, 24000);
  const transcriptChunk = clipForModel(transcript, 42000);
  const clinicChunk = clipForModel(buildClinicProfileContext(clinicKnowledgeBase), 18000);

  const parts: string[] = [];
  if (clinicChunk) parts.push(`Clinic personalization context:\n${clinicChunk}`);
  if (notesChunk) parts.push(`Clinical notes:\n${notesChunk}`);
  if (transcriptChunk) parts.push(`Consultation transcript:\n${transcriptChunk}`);

  return parts.join('\n\n');
};

interface ChatInputParams {
  patientName: string;
  transcript: string;
  notes: string;
  peReport?: string;
  supplementalContext?: string;
  clinicKnowledgeBase?: string;
  userRequest: string;
}

export const buildChatInput = ({
  patientName,
  transcript,
  notes,
  peReport = '',
  supplementalContext = '',
  clinicKnowledgeBase = '',
  userRequest,
}: ChatInputParams): string => {
  const parts: string[] = [];
  if (patientName.trim()) {
    parts.push(`Patient:\n${patientName.trim()}`);
  }

  const transcriptChunk = clipForModel(transcript, 30000);
  const notesChunk = clipForModel(notes, 16000);
  const peChunk = clipForModel(peReport, 5000);
  const supplementalChunk = clipForModel(supplementalContext, 10000);
  const clinicChunk = clipForModel(buildClinicProfileContext(clinicKnowledgeBase), 20000);
  const requestChunk = clipForModel(userRequest, 4000);

  if (transcriptChunk) parts.push(`Consultation transcript:\n${transcriptChunk}`);
  if (notesChunk) parts.push(`Clinical notes:\n${notesChunk}`);
  if (peChunk) parts.push(`PE findings:\n${peChunk}`);
  if (supplementalChunk) parts.push(`Additional context:\n${supplementalChunk}`);
  if (clinicChunk) parts.push(`Clinic personalization context:\n${clinicChunk}`);

  parts.push(`User request:\n${requestChunk}`);
  return `Current consultation context:\n\n${parts.join('\n\n')}`;
};

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { TEMPLATES } from '@/lib/prompts';
import { DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE } from '@/lib/defaultClinicKnowledgeBase';

export type TabId = 'context' | 'transcript' | 'notes' | 'tasks' | 'chat';
export type EncounterStatus = 'idle' | 'recording' | 'processing' | 'reviewing';
export type TranscriptionConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type ProcessingStepStatus = 'pending' | 'active' | 'done' | 'error';
export type ProcessingStepId =
  | 'stopping-recording'
  | 'finalizing-live-transcript'
  | 'generating-audio-transcription'
  | 'merging-transcript-tail'
  | 'generating-consultation-notes'
  | 'extracting-tasks'
  | 'saving-session';

export interface ProcessingStep {
  id: ProcessingStepId;
  label: string;
  status: ProcessingStepStatus;
}

export interface PEData {
  vitals: { temp: string; hr: string; rr: string; weight: string };
  mentation: string;
  demeanour: string;
  bcs: number;
  eyes: string; eyesDetail: string;
  ears: string; earsDetail: string;
  nose: string; noseDetail: string;
  oral: string; oralDetail: string;
  plns: string; plnsDetail: string;
  mmColor: string;
  mmMoisture: string;
  crt: string;
  heart: string; heartDetail: string;
  lungs: string; lungsDetail: string;
  pulses: string;
  hydration: string; hydrationDetail: string;
  abdoPalp: string; abdoPalpDetail: string;
  skinCoat: string; skinCoatDetail: string;
}

export interface Task {
  id: string;
  text: string;
  category: 'prescriptions' | 'diagnostics' | 'followup' | 'admin';
  assignee: 'Vet' | 'Nurse' | 'Admin';
  done: boolean;
  orderIndex?: number | null;
  deadlineAt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ClientInstructions {
  thingsToDo: string;
  thingsToAvoid: string;
  medication: string;
  whenToContact: string;
  followUp: string;
}

export interface SavedSession {
  id: string;
  title?: string | null;
  patientName: string;
  consultType: string;
  createdAt: number;
  duration: number;
  transcript: string;
  notes: string;
  vetNotes: string;
  peData: PEData;
  peEnabled: boolean;
  tasks: Task[];
  clientInstructions: ClientInstructions | null;
}

export interface RecordingArtifact {
  id: string;
  sessionId: string | null;
  fileName: string;
  objectUrl: string;
  createdAt: number;
  durationSeconds: number;
  sizeBytes: number;
}

interface SessionStore {
  // Encounter workflow
  encounterStatus: EncounterStatus;
  setEncounterStatus: (s: EncounterStatus) => void;

  // UI state
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedTemplate: string;
  setSelectedTemplate: (t: string) => void;
  availableTemplates: string[];
  setAvailableTemplates: (templates: string[]) => void;
  peEnabled: boolean;
  togglePE: () => void;
  peIncludeInNotes: boolean;
  togglePEInNotes: () => void;
  tasksOpen: boolean;
  toggleTasks: () => void;

  // PE data
  peData: PEData;
  setPEField: (field: string, value: any) => void;
  applyNormalPE: () => void;

  // Transcript
  transcript: string;
  interimTranscript: string;
  setTranscript: (t: string) => void;
  setInterimTranscript: (t: string) => void;
  appendTranscript: (t: string) => void;
  supplementalContext: string;
  setSupplementalContext: (context: string) => void;
  appendSupplementalContext: (context: string) => void;
  vetNotes: string;
  setVetNotes: (notes: string) => void;
  transcriptMergeWarning: string | null;
  setTranscriptMergeWarning: (warning: string | null) => void;
  transcriptionConnectionState: TranscriptionConnectionState;
  setTranscriptionConnectionState: (state: TranscriptionConnectionState) => void;
  processingSteps: ProcessingStep[];
  setProcessingSteps: (steps: ProcessingStep[]) => void;
  setProcessingStepStatus: (id: ProcessingStepId, status: ProcessingStepStatus) => void;
  resetProcessingSteps: () => void;

  // Notes
  notes: string;
  setNotes: (n: string) => void;
  isGeneratingNotes: boolean;
  setIsGeneratingNotes: (v: boolean) => void;

  // Tasks
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  tasksNeedReview: boolean;
  setTasksNeedReview: (value: boolean) => void;
  persistSessionTasks: (tasksOverride?: Task[]) => Promise<void>;
  toggleTask: (id: string) => void;
  deleteAllTasks: () => Promise<void>;
  addTask: (task: Omit<Task, 'id'>) => void;
  isExtractingTasks: boolean;
  setIsExtractingTasks: (v: boolean) => void;

  // Client Instructions
  clientInstructions: ClientInstructions | null;
  setClientInstructions: (ci: ClientInstructions | null) => void;
  isGeneratingCI: boolean;
  setIsGeneratingCI: (v: boolean) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (content: string) => void;
  isChatStreaming: boolean;
  setIsChatStreaming: (v: boolean) => void;

  // Patient
  patientName: string;
  setPatientName: (n: string) => void;
  clinicKnowledgeBase: string;
  setClinicKnowledgeBase: (value: string) => void;
  peAppliedAt: number | null;
  peAppliedSummary: string;
  setPEAppliedSnapshot: (summary: string, appliedAt?: number) => void;
  clearPEAppliedSnapshot: () => void;
  recordingArtifacts: RecordingArtifact[];
  addRecordingArtifact: (blob: Blob, sessionId: string | null, durationSeconds: number) => void;
  clearRecordingArtifacts: () => void;
  sessionTitle: string;
  setSessionTitle: (title: string) => void;
  sessionDurationSeconds: number;
  setSessionDurationSeconds: (seconds: number) => void;

  // Session management
  sessions: SavedSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  newSession: () => void;
  saveCurrentSession: () => void;
  loadSession: (id: string) => void;

  // Recording
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
}

const defaultPE: PEData = {
  vitals: { temp: '', hr: '', rr: '', weight: '' },
  mentation: '', demeanour: '', bcs: 0,
  eyes: '', eyesDetail: '',
  ears: '', earsDetail: '',
  nose: '', noseDetail: '',
  oral: '', oralDetail: '',
  plns: '', plnsDetail: '',
  mmColor: '', mmMoisture: '', crt: '',
  heart: '', heartDetail: '',
  lungs: '', lungsDetail: '',
  pulses: '',
  hydration: '', hydrationDetail: '',
  abdoPalp: '', abdoPalpDetail: '',
  skinCoat: '', skinCoatDetail: '',
};

const normalPE: Partial<PEData> = {
  mentation: 'BAR', demeanour: 'calm', bcs: 5,
  eyes: 'NAD', ears: 'NAD', nose: 'NAD', oral: 'NAD', plns: 'WNL',
  mmColor: 'pink', mmMoisture: 'moist', crt: '<2',
  heart: 'N', lungs: 'clr', pulses: 'strong',
  hydration: 'eu', abdoPalp: 'NAD', skinCoat: 'NAD',
};

const genId = () => crypto.randomUUID();
const DEFAULT_TEMPLATE_OPTIONS = Object.keys(TEMPLATES);

const formatDurationLabel = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const generateSessionTitle = (
  patientName: string,
  sessionType: string,
  durationSeconds: number,
  createdAt = new Date()
): string => {
  const date = createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const prefix = patientName.trim() || sessionType || 'Consultation';
  return `${prefix} - ${date} ${time} - ${formatDurationLabel(durationSeconds)}`;
};

const createDefaultProcessingSteps = (): ProcessingStep[] => [
  { id: 'stopping-recording', label: 'Stopping recording', status: 'pending' },
  { id: 'finalizing-live-transcript', label: 'Finalizing live transcript', status: 'pending' },
  { id: 'generating-audio-transcription', label: 'Generating audio transcription', status: 'pending' },
  { id: 'merging-transcript-tail', label: 'Merging transcript tail', status: 'pending' },
  { id: 'generating-consultation-notes', label: 'Generating consultation notes', status: 'pending' },
  { id: 'extracting-tasks', label: 'Extracting tasks', status: 'pending' },
  { id: 'saving-session', label: 'Saving session', status: 'pending' },
];

const buildRecordingFileName = (now = new Date()): string => {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `consultation-${stamp}.webm`;
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Encounter workflow
  encounterStatus: 'idle',
  setEncounterStatus: (s) => set({ encounterStatus: s }),

  // UI state
  activeTab: 'context',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedTemplate: 'General Consult',
  setSelectedTemplate: (t) => set({ selectedTemplate: t }),
  availableTemplates: [...DEFAULT_TEMPLATE_OPTIONS],
  setAvailableTemplates: (templates) => {
    const uniqueTemplates = Array.from(new Set(templates.filter(Boolean)));
    set((state) => ({
      availableTemplates: uniqueTemplates.length > 0 ? uniqueTemplates : [...DEFAULT_TEMPLATE_OPTIONS],
      selectedTemplate: uniqueTemplates.includes(state.selectedTemplate)
        ? state.selectedTemplate
        : uniqueTemplates[0] || 'General Consult',
    }));
  },
  peEnabled: true,
  togglePE: () => set((s) => ({ peEnabled: !s.peEnabled })),
  peIncludeInNotes: true,
  togglePEInNotes: () => set((s) => ({ peIncludeInNotes: !s.peIncludeInNotes })),
  tasksOpen: true,
  toggleTasks: () => set((s) => ({ tasksOpen: !s.tasksOpen })),

  // PE data
  peData: { ...defaultPE },
  setPEField: (field, value) => set((s) => ({
    peData: { ...s.peData, [field]: value },
  })),
  applyNormalPE: () => set((s) => ({
    peData: {
      ...s.peData, ...normalPE,
      vitals: s.peData.vitals,
      eyesDetail: '', earsDetail: '', noseDetail: '', oralDetail: '', plnsDetail: '',
      heartDetail: '', lungsDetail: '', hydrationDetail: '', abdoPalpDetail: '', skinCoatDetail: '',
    },
  })),

  // Transcript
  transcript: '',
  interimTranscript: '',
  setTranscript: (t) => set({ transcript: t }),
  setInterimTranscript: (t) => set({ interimTranscript: t }),
  appendTranscript: (t) => set((s) => ({ transcript: s.transcript + t })),
  supplementalContext: '',
  setSupplementalContext: (context) => set({ supplementalContext: context }),
  appendSupplementalContext: (context) => set((state) => ({
    supplementalContext: state.supplementalContext.trim()
      ? `${state.supplementalContext.trim()}\n\n${context.trim()}`
      : context.trim(),
  })),
  vetNotes: '',
  setVetNotes: (notes) => set({ vetNotes: notes }),
  transcriptMergeWarning: null,
  setTranscriptMergeWarning: (warning) => set({ transcriptMergeWarning: warning }),
  transcriptionConnectionState: 'disconnected',
  setTranscriptionConnectionState: (state) => set({ transcriptionConnectionState: state }),
  processingSteps: createDefaultProcessingSteps(),
  setProcessingSteps: (steps) => set({ processingSteps: steps }),
  setProcessingStepStatus: (id, status) => set((state) => ({
    processingSteps: state.processingSteps.map((step) =>
      step.id === id ? { ...step, status } : step
    ),
  })),
  resetProcessingSteps: () => set({ processingSteps: createDefaultProcessingSteps() }),
  // Notes
  notes: '',
  setNotes: (n) => set({ notes: n }),
  isGeneratingNotes: false,
  setIsGeneratingNotes: (v) => set({ isGeneratingNotes: v }),

  // Tasks
  tasks: [],
  setTasks: (t) => set({ tasks: t }),
  tasksNeedReview: false,
  setTasksNeedReview: (value) => set({ tasksNeedReview: value }),
  persistSessionTasks: async (tasksOverride) => {
    let s = get();
    if (!s.activeSessionId) {
      await s.saveCurrentSession();
      s = get();
    }
    const sessionId = s.activeSessionId;
    if (!sessionId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const tasksToPersist = tasksOverride ?? s.tasks;

    await supabase.from('tasks').delete().eq('session_id', sessionId).eq('user_id', user.id);
    if (tasksToPersist.length === 0) return;

    await supabase.from('tasks').insert(
      tasksToPersist.map((task, index) => ({
        id: task.id,
        user_id: user.id,
        session_id: sessionId,
        text: task.text,
        category: task.category,
        assignee: task.assignee,
        done: task.done,
        order_index: task.orderIndex ?? index + 1,
        deadline_at: task.deadlineAt || null,
      }))
    );
    set({ tasks: tasksToPersist, tasksNeedReview: false });
  },
  toggleTask: (id) => {
    const currentTask = get().tasks.find((task) => task.id === id);
    if (!currentTask) return;
    const nextDone = !currentTask.done;

    set((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? { ...t, done: nextDone } : t),
    }));

    void (async () => {
      const s = get();
      if (!s.activeSessionId) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('tasks')
        .update({ done: nextDone })
        .eq('id', id)
        .eq('session_id', s.activeSessionId)
        .eq('user_id', user.id);
      window.dispatchEvent(new Event('session-saved'));
    })();
  },
  deleteAllTasks: async () => {
    const s = get();
    if (!s.activeSessionId) {
      set({ tasks: [], tasksNeedReview: false });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ tasks: [], tasksNeedReview: false });
      return;
    }

    await supabase
      .from('tasks')
      .delete()
      .eq('session_id', s.activeSessionId)
      .eq('user_id', user.id);

    set({ tasks: [], tasksNeedReview: false });
    window.dispatchEvent(new Event('session-saved'));
  },
  addTask: (task) => set((s) => ({
    tasks: [
      ...s.tasks,
      {
        ...task,
        id: genId(),
        deadlineAt: task.deadlineAt || null,
        orderIndex:
          task.orderIndex ??
          (s.tasks.length > 0
            ? Math.max(...s.tasks.map((t, index) => t.orderIndex ?? index + 1)) + 1
            : 1),
      },
    ],
  })),
  isExtractingTasks: false,
  setIsExtractingTasks: (v) => set({ isExtractingTasks: v }),

  // Client Instructions
  clientInstructions: null,
  setClientInstructions: (ci) => set({ clientInstructions: ci }),
  isGeneratingCI: false,
  setIsGeneratingCI: (v) => set({ isGeneratingCI: v }),

  // Chat
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({
    chatMessages: [...s.chatMessages, { ...msg, id: genId(), timestamp: Date.now() }],
  })),
  updateLastAssistantMessage: (content) => set((s) => {
    const msgs = [...s.chatMessages];
    const lastIdx = msgs.length - 1;
    if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
      msgs[lastIdx] = { ...msgs[lastIdx], content };
    }
    return { chatMessages: msgs };
  }),
  isChatStreaming: false,
  setIsChatStreaming: (v) => set({ isChatStreaming: v }),

  // Patient
  patientName: '',
  setPatientName: (n) => set({ patientName: n }),
  clinicKnowledgeBase: DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE,
  setClinicKnowledgeBase: (value) => set({ clinicKnowledgeBase: value }),
  peAppliedAt: null,
  peAppliedSummary: '',
  setPEAppliedSnapshot: (summary, appliedAt = Date.now()) => set({
    peAppliedSummary: summary.trim(),
    peAppliedAt: summary.trim() ? appliedAt : null,
  }),
  clearPEAppliedSnapshot: () => set({ peAppliedSummary: '', peAppliedAt: null }),
  recordingArtifacts: [],
  addRecordingArtifact: (blob, sessionId, durationSeconds) =>
    set((state) => {
      const now = Date.now();
      const artifact: RecordingArtifact = {
        id: genId(),
        sessionId,
        fileName: buildRecordingFileName(new Date(now)),
        objectUrl: URL.createObjectURL(blob),
        createdAt: now,
        durationSeconds: Math.max(0, durationSeconds),
        sizeBytes: blob.size,
      };

      const maxArtifacts = 20;
      const nextArtifacts = [artifact, ...state.recordingArtifacts];
      const removedArtifacts = nextArtifacts.slice(maxArtifacts);
      removedArtifacts.forEach((item) => {
        try {
          URL.revokeObjectURL(item.objectUrl);
        } catch {
          // ignore revoke failures
        }
      });

      return { recordingArtifacts: nextArtifacts.slice(0, maxArtifacts) };
    }),
  clearRecordingArtifacts: () =>
    set((state) => {
      state.recordingArtifacts.forEach((item) => {
        try {
          URL.revokeObjectURL(item.objectUrl);
        } catch {
          // ignore revoke failures
        }
      });
      return { recordingArtifacts: [] };
    }),
  sessionTitle: '',
  setSessionTitle: (title) => set({ sessionTitle: title }),
  sessionDurationSeconds: 0,
  setSessionDurationSeconds: (seconds) => set({ sessionDurationSeconds: Math.max(0, seconds) }),

  // Session management
  sessions: [],
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  newSession: () => {
    set({
      encounterStatus: 'idle',
      activeSessionId: null,
      patientName: '',
      sessionTitle: '',
      sessionDurationSeconds: 0,
      transcript: '',
      interimTranscript: '',
      supplementalContext: '',
      vetNotes: '',
      transcriptMergeWarning: null,
      peAppliedAt: null,
      peAppliedSummary: '',
      notes: '',
      peEnabled: true,
      peIncludeInNotes: true,
      tasks: [],
      tasksNeedReview: false,
      clientInstructions: null,
      chatMessages: [],
      activeTab: 'context',
      selectedTemplate: 'General Consult',
      isRecording: false,
      transcriptionConnectionState: 'disconnected',
      processingSteps: createDefaultProcessingSteps(),
    });
  },

  saveCurrentSession: async () => {
    const s = get();
    if (!s.transcript.trim() && !s.notes.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let sessionId = s.activeSessionId;
    const generatedTitle = generateSessionTitle(
      s.patientName,
      s.selectedTemplate,
      s.sessionDurationSeconds
    );
    const currentTitle = s.sessionTitle.trim();
    const titleLooksLikeDraft = /\b0m$/i.test(currentTitle);
    const titleToSave = !currentTitle || titleLooksLikeDraft ? generatedTitle : currentTitle;

    if (!sessionId) {
      const { data: createdSession, error: createError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          patient_name: s.patientName || null,
          title: titleToSave,
          session_type: s.selectedTemplate,
          pe_data: s.peEnabled ? (s.peData as any) : null,
          pe_enabled: s.peEnabled,
          duration_seconds: s.sessionDurationSeconds,
          status: 'completed',
        })
        .select('id')
        .single();

      if (createError || !createdSession) {
        console.error('Failed to create session:', createError);
        return;
      }
      sessionId = createdSession.id;
      set({ activeSessionId: sessionId, sessionTitle: titleToSave });
    } else {
      await supabase
        .from('sessions')
        .update({
          patient_name: s.patientName || null,
          title: titleToSave,
          session_type: s.selectedTemplate,
          pe_data: s.peEnabled ? (s.peData as any) : null,
          pe_enabled: s.peEnabled,
          duration_seconds: s.sessionDurationSeconds,
          status: 'completed',
        })
        .eq('id', sessionId)
        .eq('user_id', user.id);
      set({ sessionTitle: titleToSave });
    }

    await supabase.from('notes').delete().eq('session_id', sessionId).eq('user_id', user.id);
    await supabase.from('notes').insert({
      user_id: user.id,
      session_id: sessionId,
      content: s.notes,
      transcript: s.transcript,
      supplemental_context: s.supplementalContext || null,
      vet_notes: s.vetNotes || null,
    });

    if (!s.tasksNeedReview) {
      await supabase.from('tasks').delete().eq('session_id', sessionId).eq('user_id', user.id);
      if (s.tasks.length > 0) {
        await supabase.from('tasks').insert(
          s.tasks.map((t, index) => ({
            id: t.id,
            user_id: user.id,
            session_id: sessionId!,
            text: t.text,
            category: t.category,
            assignee: t.assignee,
            done: t.done,
            order_index: t.orderIndex ?? index + 1,
            deadline_at: t.deadlineAt || null,
          }))
        );
      }
    }
  },

  loadSession: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    set({
      encounterStatus: 'reviewing',
      activeSessionId: session.id,
      sessionTitle: session.title || '',
      sessionDurationSeconds: session.duration,
      patientName: session.patientName,
      selectedTemplate: session.consultType,
      transcript: session.transcript,
      interimTranscript: '',
      supplementalContext: '',
      vetNotes: session.vetNotes || '',
      notes: session.notes,
      peEnabled: session.peEnabled,
      tasks: session.tasks,
      tasksNeedReview: false,
      clientInstructions: session.clientInstructions,
      chatMessages: [],
      activeTab: 'notes',
    });
  },

  // Recording
  isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),
}));

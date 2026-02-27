import { create } from 'zustand';

export type TabId = 'context' | 'transcript' | 'notes' | 'client';

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
  patientName: string;
  consultType: string;
  createdAt: number;
  duration: number;
  transcript: string;
  notes: string;
  peData: PEData;
  peEnabled: boolean;
  tasks: Task[];
  clientInstructions: ClientInstructions | null;
}

interface SessionStore {
  // UI state
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedTemplate: string;
  setSelectedTemplate: (t: string) => void;
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
  setTranscript: (t: string) => void;
  appendTranscript: (t: string) => void;

  // Notes
  notes: string;
  setNotes: (n: string) => void;
  isGeneratingNotes: boolean;
  setIsGeneratingNotes: (v: boolean) => void;

  // Tasks
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  toggleTask: (id: string) => void;
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

  // Session management
  sessions: SavedSession[];
  activeSessionId: string | null;
  newSession: () => void;
  saveCurrentSession: () => void;
  loadSession: (id: string) => void;

  // Recording
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
}

const defaultPE: PEData = {
  vitals: { temp: '', hr: '', rr: '', weight: '' },
  mentation: '', demeanour: '', bcs: 5,
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

const loadSessions = (): SavedSession[] => {
  try {
    const stored = localStorage.getItem('etv-scribe-sessions');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  // UI state
  activeTab: 'context',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedTemplate: 'General Consult',
  setSelectedTemplate: (t) => set({ selectedTemplate: t }),
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
      vitals: s.peData.vitals, // Keep vitals as entered
      eyesDetail: '', earsDetail: '', noseDetail: '', oralDetail: '', plnsDetail: '',
      heartDetail: '', lungsDetail: '', hydrationDetail: '', abdoPalpDetail: '', skinCoatDetail: '',
    },
  })),

  // Transcript
  transcript: '',
  setTranscript: (t) => set({ transcript: t }),
  appendTranscript: (t) => set((s) => ({ transcript: s.transcript + t })),

  // Notes
  notes: '',
  setNotes: (n) => set({ notes: n }),
  isGeneratingNotes: false,
  setIsGeneratingNotes: (v) => set({ isGeneratingNotes: v }),

  // Tasks
  tasks: [],
  setTasks: (t) => set({ tasks: t }),
  toggleTask: (id) => set((s) => ({
    tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t),
  })),
  addTask: (task) => set((s) => ({
    tasks: [...s.tasks, { ...task, id: genId() }],
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

  // Session management
  sessions: loadSessions(),
  activeSessionId: null,

  newSession: () => {
    const state = get();
    if (state.transcript || state.notes) {
      state.saveCurrentSession();
    }
    set({
      activeSessionId: genId(),
      patientName: '',
      transcript: '',
      notes: '',
      peData: { ...defaultPE },
      peEnabled: true,
      peIncludeInNotes: true,
      tasks: [],
      clientInstructions: null,
      chatMessages: [],
      activeTab: 'context',
      selectedTemplate: 'General Consult',
      isRecording: false,
    });
  },

  saveCurrentSession: () => {
    const s = get();
    if (!s.transcript && !s.notes) return;
    const session: SavedSession = {
      id: s.activeSessionId || genId(),
      patientName: s.patientName,
      consultType: s.selectedTemplate,
      createdAt: Date.now(),
      duration: 0,
      transcript: s.transcript,
      notes: s.notes,
      peData: s.peData,
      peEnabled: s.peEnabled,
      tasks: s.tasks,
      clientInstructions: s.clientInstructions,
    };
    const sessions = [...s.sessions.filter((ss) => ss.id !== session.id), session]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    localStorage.setItem('etv-scribe-sessions', JSON.stringify(sessions));
    set({ sessions, activeSessionId: session.id });
  },

  loadSession: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (!session) return;
    set({
      activeSessionId: session.id,
      patientName: session.patientName,
      selectedTemplate: session.consultType,
      transcript: session.transcript,
      notes: session.notes,
      peData: session.peData,
      peEnabled: session.peEnabled,
      tasks: session.tasks,
      clientInstructions: session.clientInstructions,
      chatMessages: [],
      activeTab: 'notes',
    });
  },

  // Recording
  isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),
}));

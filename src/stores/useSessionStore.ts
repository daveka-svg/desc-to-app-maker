import { create } from 'zustand';

export type TabId = 'context' | 'transcript' | 'notes' | 'client';

interface PEData {
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

interface SessionStore {
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
  isRecording: boolean;
  timerSeconds: number;
  peData: PEData;
  setPEField: (field: string, value: any) => void;
}

const defaultPE: PEData = {
  vitals: { temp: '39.5', hr: '120', rr: '30', weight: '28.5' },
  mentation: 'QAR', demeanour: '', bcs: 5,
  eyes: 'NAD', eyesDetail: '',
  ears: 'NAD', earsDetail: '',
  nose: 'NAD', noseDetail: '',
  oral: 'NAD', oralDetail: '',
  plns: 'WNL', plnsDetail: '',
  mmColor: 'pink', mmMoisture: '', crt: '<2',
  heart: 'N', heartDetail: '',
  lungs: 'clr', lungsDetail: '',
  pulses: 'strong',
  hydration: '', hydrationDetail: '',
  abdoPalp: '', abdoPalpDetail: '',
  skinCoat: 'NAD', skinCoatDetail: '',
};

export const useSessionStore = create<SessionStore>((set) => ({
  activeTab: 'notes',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedTemplate: 'General Consult',
  setSelectedTemplate: (t) => set({ selectedTemplate: t }),
  peEnabled: true,
  togglePE: () => set((s) => ({ peEnabled: !s.peEnabled })),
  peIncludeInNotes: true,
  togglePEInNotes: () => set((s) => ({ peIncludeInNotes: !s.peIncludeInNotes })),
  tasksOpen: true,
  toggleTasks: () => set((s) => ({ tasksOpen: !s.tasksOpen })),
  isRecording: true,
  timerSeconds: 272,
  peData: defaultPE,
  setPEField: (field, value) => set((s) => ({
    peData: { ...s.peData, [field]: value },
  })),
}));

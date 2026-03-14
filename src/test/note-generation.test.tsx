import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  },
}));

const resetStore = () => {
  useSessionStore.setState({
    transcript: 'Owner reports diarrhoea for 3 days.',
    peEnabled: true,
    peIncludeInNotes: true,
    peData: {
      vitals: { temp: '38.5', hr: '110', rr: '', weight: '' },
      mentation: '',
      demeanour: '',
      bcs: 0,
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
    },
    selectedTemplate: 'General Consult',
    vetNotes: '',
    clinicKnowledgeBase: '',
    notes: '',
    isGeneratingNotes: false,
    peAppliedSummary: '',
    peAppliedAt: null,
  });
};

describe('useNoteGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { content: 'SUBJECTIVE:\nOwner reports diarrhoea for 3 days.' },
      error: null,
    } as never);
  });

  it('preserves the existing PE snapshot when regenerating without PE included', async () => {
    useSessionStore.setState({
      peIncludeInNotes: false,
      peAppliedSummary: 'PE: Temp 38.5 C, HR 110 bpm.',
      peAppliedAt: 123456789,
    });

    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    const state = useSessionStore.getState();
    expect(state.peAppliedSummary).toBe('PE: Temp 38.5 C, HR 110 bpm.');
    expect(state.peAppliedAt).toBe(123456789);
  });

  it('refreshes the PE snapshot when regenerating with PE included', async () => {
    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    const state = useSessionStore.getState();
    expect(state.peAppliedSummary).toContain('Temp 38.5 C');
    expect(state.peAppliedAt).not.toBeNull();
  });
});

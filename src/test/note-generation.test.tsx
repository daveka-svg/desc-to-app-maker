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

  it('passes the editable template body for General Consult generation', async () => {
    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledWith(
      'generate-notes',
      expect.objectContaining({
        body: expect.objectContaining({
          templateName: 'General Consult',
          templatePromptBody: expect.stringMatching(/SUBJECTIVE:[\s\S]*PLAN:/),
        }),
      })
    );
  });

  it('uses the saved PE snapshot when raw PE data is missing', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { content: 'SUBJECTIVE:\nOwner reports diarrhoea for 3 days.\n\nOBJECTIVE:\nQuiet but responsive.' },
      error: null,
    } as never);

    useSessionStore.setState({
      peData: {
        vitals: { temp: '', hr: '', rr: '', weight: '' },
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
      peAppliedSummary: 'PE: Temp 38.5 C, HR 110 bpm.',
      peAppliedAt: 123456789,
      vetNotes: 'Abdomen soft.',
    });

    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledWith(
      'generate-notes',
      expect.objectContaining({
        body: expect.objectContaining({
          transcript: expect.not.stringContaining('Physical examination:'),
        }),
      })
    );
    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledWith(
      'generate-notes',
      expect.objectContaining({
        body: expect.objectContaining({
          transcript: expect.stringContaining('Vet notes:\nAbdomen soft.'),
        }),
      })
    );

    expect(useSessionStore.getState().notes).toContain('OBJECTIVE:\nQuiet but responsive.');
    expect(useSessionStore.getState().notes).toContain('PE:\nTemp 38.5 C, HR 110 bpm.');
  });

  it('does not clear raw PE data or vet notes during regenerate', async () => {
    useSessionStore.setState({
      peData: {
        vitals: { temp: '38.9', hr: '120', rr: '28', weight: '12.4' },
        mentation: 'BAR',
        demeanour: 'calm',
        bcs: 5,
        eyes: 'NAD', eyesDetail: '',
        ears: '', earsDetail: '',
        nose: '', noseDetail: '',
        oral: '', oralDetail: '',
        plns: '', plnsDetail: '',
        mmColor: 'pink', mmMoisture: 'moist', crt: '<2',
        heart: '', heartDetail: '',
        lungs: '', lungsDetail: '',
        pulses: 'strong',
        hydration: '', hydrationDetail: '',
        abdoPalp: 'abn', abdoPalpDetail: 'mild cranial discomfort',
        skinCoat: '', skinCoatDetail: '',
      },
      vetNotes: 'Owner declined bloods today.',
    });

    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    const state = useSessionStore.getState();
    expect(state.peData.vitals.temp).toBe('38.9');
    expect(state.peData.abdoPalpDetail).toBe('mild cranial discomfort');
    expect(state.vetNotes).toBe('Owner declined bloods today.');
  });

  it('appends a separate PE section when general consult output omits it', async () => {
    useSessionStore.setState({
      peData: {
        vitals: { temp: '38.5', hr: '110', rr: '', weight: '' },
        mentation: 'BAR',
        demeanour: '',
        bcs: 5,
        eyes: 'NAD', eyesDetail: '',
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
      vetNotes: 'Owner declined bloods today.',
    });

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { content: 'SUBJECTIVE:\nVomiting for 2 days.' },
      error: null,
    } as never);

    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    const state = useSessionStore.getState();
    expect(state.notes).toContain('PE:\nTemp 38.5 C, HR 110 bpm, BCS 5/9, BAR.');
    expect(state.notes).not.toContain('VET NOTES:');
  });

  it('does not duplicate PE section when already present', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        content:
          'SUBJECTIVE:\nVomiting.\n\nPE:\nTemp 38.5 C, HR 110 bpm.',
      },
      error: null,
    } as never);

    const { result } = renderHook(() => useNoteGeneration());

    await act(async () => {
      await result.current.generateNote();
    });

    const state = useSessionStore.getState();
    expect((state.notes.match(/\n\nPE:\n/g) || []).length).toBeLessThanOrEqual(1);
    expect(state.notes).not.toContain('VET NOTES:');
  });
});

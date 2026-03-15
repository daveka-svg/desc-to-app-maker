import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAskETV } from '@/hooks/useAskETV';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/lib/appSettings', () => ({
  getAiGenerationConfig: () => ({
    provider: 'inception',
    model: 'mercury-2',
  }),
}));

const resetStore = () => {
  useSessionStore.setState({
    patientName: 'Milo',
    transcript: 'Owner reports diarrhoea for 3 days.',
    notes: 'SUBJECTIVE:\nDiarrhoea for 3d.',
    peEnabled: true,
    peData: {
      vitals: { temp: '38.5', hr: '110', rr: '', weight: '' },
      mentation: 'BAR',
      demeanour: '',
      bcs: 5,
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
    supplementalContext: 'Lab result: faecal PCR pending.',
    clinicKnowledgeBase: 'Clinic style guide.',
    chatMessages: [],
    isChatStreaming: false,
  });
};

describe('useAskETV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { content: 'Drafted follow-up email.' },
      error: null,
    } as never);
  });

  it('routes consultation chat through the chat request path with consultation context', async () => {
    const { result } = renderHook(() => useAskETV());

    await act(async () => {
      await result.current.sendMessage('Generate follow-up email for this consultation.');
    });

    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledWith(
      'generate-notes',
      expect.objectContaining({
        body: expect.objectContaining({
          requestType: 'chat',
          templatePrompt: expect.stringContaining('veterinary AI assistant'),
          transcript: expect.stringContaining('Consultation transcript:\nOwner reports diarrhoea for 3 days.'),
        }),
      }),
    );

    expect(vi.mocked(supabase.functions.invoke)).toHaveBeenCalledWith(
      'generate-notes',
      expect.objectContaining({
        body: expect.objectContaining({
          transcript: expect.stringContaining('User request:\nGenerate follow-up email for this consultation.'),
        }),
      }),
    );

    expect(useSessionStore.getState().chatMessages.at(-1)?.content).toBe('Drafted follow-up email.');
  });
});

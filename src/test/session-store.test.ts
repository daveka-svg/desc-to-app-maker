import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/stores/useSessionStore';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      single: vi.fn(),
    })),
  },
}));

const makePEData = () => ({
  vitals: { temp: '38.7', hr: '108', rr: '28', weight: '28.4' },
  mentation: 'BAR',
  demeanour: 'friendly',
  bcs: 5,
  eyes: '', eyesDetail: '',
  ears: '', earsDetail: '',
  nose: '', noseDetail: '',
  oral: '', oralDetail: '',
  plns: '', plnsDetail: '',
  mmColor: 'pink',
  mmMoisture: 'moist',
  crt: '<2',
  heart: '', heartDetail: '',
  lungs: '', lungsDetail: '',
  pulses: 'good',
  hydration: 'mildly reduced', hydrationDetail: '',
  abdoPalp: '', abdoPalpDetail: 'mild cranial discomfort',
  skinCoat: '', skinCoatDetail: '',
});

describe('useSessionStore PE persistence', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      peEnabled: true,
      peIncludeInNotes: true,
      peData: makePEData(),
      peAppliedSummary: 'PE: Temp 38.7 C.',
      peAppliedAt: 123456789,
      transcript: '',
      notes: '',
      vetNotes: '',
    });
  });

  it('resets PE data when starting a new session', () => {
    useSessionStore.getState().newSession();

    const state = useSessionStore.getState();
    expect(state.peData.vitals.temp).toBe('');
    expect(state.peData.abdoPalpDetail).toBe('');
    expect(state.peAppliedSummary).toBe('');
    expect(state.peAppliedAt).toBeNull();
  });

  it('rehydrates PE data when loading a saved session', () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Saved consult',
          patientName: 'Milo',
          consultType: 'General Consult',
          createdAt: 1710000000000,
          duration: 1200,
          transcript: 'Transcript',
          notes: 'Notes',
          vetNotes: 'Relevant vet note',
          peData: makePEData(),
          peEnabled: true,
          tasks: [],
          clientInstructions: null,
        },
      ],
    });

    useSessionStore.getState().loadSession('session-1');

    const state = useSessionStore.getState();
    expect(state.peEnabled).toBe(true);
    expect(state.peIncludeInNotes).toBe(true);
    expect(state.peData.vitals.temp).toBe('38.7');
    expect(state.peData.abdoPalpDetail).toBe('mild cranial discomfort');
    expect(state.peAppliedSummary).toContain('Temp 38.7 C');
    expect(state.vetNotes).toBe('Relevant vet note');
  });
});

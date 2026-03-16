import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}));

describe('getTemplatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the saved empty prompt instead of falling back to the library default', async () => {
    getUserMock.mockResolvedValue({ data: { auth: { user: null } } });
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          name: 'General Consult',
          system_prompt: '',
          updated_at: '2026-03-16T10:00:00Z',
          created_at: '2026-03-16T09:00:00Z',
        },
      ],
      error: null,
    });

    const eqUserIdMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqUserIdMock }));
    fromMock.mockReturnValue({ select: selectMock });

    const { getTemplatePrompt } = await import('@/lib/templatePrompts');
    const prompt = await getTemplatePrompt('General Consult', 'fallback');

    expect(prompt).toBe('');
  });
});

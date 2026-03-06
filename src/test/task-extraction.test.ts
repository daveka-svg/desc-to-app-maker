import { describe, expect, it } from 'vitest';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';

describe('task extraction normalization', () => {
  it('normalizes assignees, trims text, and keeps optional deadline', () => {
    const tasks = normalizeExtractedTasks({
      prescriptions: [
        { text: '  Dispense Pro-Kolin 5ml q8h x3 days  ', assignee: 'Nurse', deadline: null },
      ],
      diagnostics: [
        { text: 'Arrange faecal PCR if no improvement', assignee: 'Vet', deadline: '2026-03-07T15:30:00Z' },
      ],
      followup: [{ text: 'Call owner tomorrow', assignee: 'Admin', deadline: '' }],
      admin: [{ text: 'Email written plan', assignee: 'UnknownTeam', deadline: null }],
    });

    expect(tasks).toHaveLength(4);
    expect(tasks[0].text).toBe('Dispense Pro-Kolin 5ml q8h x3 days');
    expect(tasks[0].assignee).toBe('Nurse');
    expect(tasks[1].deadlineAt).toBe('2026-03-07T15:30:00.000Z');
    expect(tasks[3].assignee).toBe('Vet');
  });
});


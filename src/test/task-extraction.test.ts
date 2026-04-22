import { describe, expect, it } from 'vitest';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';
import { getTaskExtractionAiConfig } from '@/lib/appSettings';

describe('task extraction normalization', () => {
  it('uses the fast OpenAI nano model for task extraction', () => {
    expect(getTaskExtractionAiConfig()).toEqual(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-5.4-nano',
      }),
    );
  });

  it('keeps only grounded tasks, normalizes assignees, and preserves deadlines', () => {
    const source = `
      Transcript:
      Nurse Sarah, please dispense Pro-Kolin.
      Arrange faecal PCR if no improvement by tomorrow.
      Reception to email written plan.
    `;

    const tasks = normalizeExtractedTasks({
      prescriptions: [
        {
          text: '  Dispense Pro-Kolin 5ml q8h x3 days  ',
          assignee: 'Nurse',
          deadline: null,
          evidence: 'please dispense Pro-Kolin',
        },
      ],
      diagnostics: [
        {
          text: 'Arrange faecal PCR if no improvement',
          assignee: 'Vet',
          deadline: '2026-03-07T15:30:00Z',
          evidence: 'Arrange faecal PCR if no improvement',
        },
      ],
      followup: [{ text: 'Call owner tomorrow', assignee: 'Admin', deadline: '', evidence: 'Call owner tomorrow' }],
      admin: [
        {
          text: 'Email written plan',
          assignee: 'UnknownTeam',
          deadline: null,
          evidence: 'Reception to email written plan',
        },
      ],
    }, source);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].text).toBe('Dispense Pro-Kolin 5ml q8h x3 days');
    expect(tasks[0].assignee).toBe('Nurse');
    expect(tasks[1].deadlineAt).toBe('2026-03-07T15:30:00.000Z');
    expect(tasks[2].assignee).toBe('Vet');
    expect(tasks.map((task) => task.text)).not.toContain('Call owner tomorrow');
  });
});

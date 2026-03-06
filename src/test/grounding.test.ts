import { describe, expect, it } from 'vitest';
import {
  filterGroundedGeneralConsultPayload,
  parseGeneralConsultGroundingPayload,
  renderGeneralConsultFromGroundedPayload,
} from '../../supabase/functions/generate-notes/grounding';

describe('general consult grounding', () => {
  it('drops non-grounded assessment/plan statements', () => {
    const source = `
      Consultation transcript:
      Vet: Impression is acute gastroenteritis likely dietary indiscretion.
      Vet: Plan maropitant injection and Pro-Kolin 5 ml q8h for 3 days.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        TREATMENT: [],
        OBJECTIVE: [],
        ASSESSMENT: [
          {
            text: 'Acute gastroenteritis likely dietary indiscretion.',
            evidence: 'acute gastroenteritis likely dietary indiscretion',
          },
          {
            text: 'Pancreatitis suspected and severe sepsis risk.',
            evidence: 'pancreatitis suspected and severe sepsis risk',
          },
        ],
        PLAN: [
          {
            text: 'Maropitant and Pro-Kolin as discussed.',
            evidence: 'maropitant injection and Pro-Kolin 5 ml q8h for 3 days',
          },
          {
            text: 'Start omeprazole 0.5 mg/kg for 5 days.',
            evidence: 'omeprazole 0.5 mg/kg for 5 days',
          },
        ],
        COMMUNICATION: [],
      },
    }));

    expect(payload).not.toBeNull();
    const filtered = filterGroundedGeneralConsultPayload(payload!, source);

    expect(filtered.sections.ASSESSMENT).toHaveLength(1);
    expect(filtered.sections.ASSESSMENT[0].text).toContain('Acute gastroenteritis');
    expect(filtered.sections.PLAN).toHaveLength(1);
    expect(filtered.sections.PLAN[0].text).toContain('Maropitant');
  });

  it('renders headings in order and omits empty sections', () => {
    const rendered = renderGeneralConsultFromGroundedPayload({
      complexity: 'routine',
      sections: {
        TREATMENT: [{ text: 'Loose stool since yesterday.', evidence: 'Loose stool since yesterday' }],
        OBJECTIVE: [],
        ASSESSMENT: [{ text: 'Acute gastroenteritis discussed.', evidence: 'Acute gastroenteritis discussed' }],
        PLAN: [],
        COMMUNICATION: [{ text: 'Owner advised on red flags.', evidence: 'advised on red flags' }],
      },
    });

    expect(rendered.includes('TREATMENT:')).toBe(true);
    expect(rendered.includes('OBJECTIVE:')).toBe(false);
    expect(rendered.includes('ASSESSMENT:')).toBe(true);
    expect(rendered.includes('PLAN:')).toBe(false);
    expect(rendered.includes('COMMUNICATION:')).toBe(true);

    expect(rendered.indexOf('TREATMENT:')).toBeLessThan(rendered.indexOf('ASSESSMENT:'));
    expect(rendered.indexOf('ASSESSMENT:')).toBeLessThan(rendered.indexOf('COMMUNICATION:'));
  });
});


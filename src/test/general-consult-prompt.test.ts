import { describe, expect, it } from 'vitest';
import {
  buildGeneralConsultSystemPrompt,
  buildGeneralConsultUserPrompt,
  DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT,
} from '../../supabase/functions/generate-notes/general-consult';

describe('general consult extraction prompt builder', () => {
  it('uses the editable template instructions when provided', () => {
    const customTemplatePrompt = `SUBJECTIVE:
OBJECTIVE:
ASSESSMENT:
PLAN:

Keep more detail in PLAN.`;

    const prompt = buildGeneralConsultSystemPrompt(customTemplatePrompt);

    expect(prompt).toBe(customTemplatePrompt);
  });

  it('falls back to the default General Consult template prompt when no override is provided', () => {
    const prompt = buildGeneralConsultSystemPrompt();

    expect(prompt).toBe(DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT);
    expect(prompt).toContain('Use only information explicitly stated in the consultation source.');
  });

  it('builds a simple extraction user prompt for the full consultation source', () => {
    const prompt = buildGeneralConsultUserPrompt('Consultation transcript:\nTest');

    expect(prompt).toContain('Write the General Consult note directly from this consultation source.');
    expect(prompt).toContain('Return plain note text only.');
    expect(prompt).toContain('Consultation transcript:\nTest');
  });
});

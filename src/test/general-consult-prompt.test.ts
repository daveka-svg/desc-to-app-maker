import { describe, expect, it } from 'vitest';
import {
  buildGeneralConsultExtractionSystemPrompt,
  DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT,
} from '../../supabase/functions/generate-notes/general-consult';

describe('general consult extraction prompt builder', () => {
  it('uses the editable template instructions when provided', () => {
    const customTemplatePrompt = `SUBJECTIVE:
OBJECTIVE:
ASSESSMENT:
PLAN:

Keep more detail in PLAN.`;

    const prompt = buildGeneralConsultExtractionSystemPrompt(customTemplatePrompt);

    expect(prompt).toContain('Return ONLY valid JSON');
    expect(prompt).toContain('Editable General Consult template instructions:');
    expect(prompt).toContain(customTemplatePrompt);
  });

  it('falls back to the default General Consult template prompt when no override is provided', () => {
    const prompt = buildGeneralConsultExtractionSystemPrompt();

    expect(prompt).toContain(DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT);
    expect(prompt).toContain('Use only explicit source information.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildGeneralConsultExtractionSystemPrompt,
  buildGeneralConsultExtractionUserPrompt,
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
    expect(prompt.startsWith(`Editable General Consult template instructions:\n${customTemplatePrompt}`)).toBe(true);
  });

  it('falls back to the default General Consult template prompt when no override is provided', () => {
    const prompt = buildGeneralConsultExtractionSystemPrompt();

    expect(prompt).toContain(DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT);
    expect(prompt).toContain('Use only information explicitly stated in the consultation source.');
    expect(prompt).toContain('"SUBJECTIVE": ["..."] | null');
  });

  it('builds a simple extraction user prompt for the full consultation source', () => {
    const prompt = buildGeneralConsultExtractionUserPrompt('Consultation transcript:\nTest');

    expect(prompt).toContain('Extract a concise SOAP JSON note from this source.');
    expect(prompt).toContain('Consultation transcript:\nTest');
  });
});

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

    expect(prompt).toContain('Use the saved General Consult template instructions below as the primary instruction set');
    expect(prompt).toContain(customTemplatePrompt);
  });

  it('returns an empty-note guard prompt when an empty template is intentionally provided', () => {
    const prompt = buildGeneralConsultSystemPrompt('');

    expect(prompt).toContain('Return an empty string.');
    expect(prompt).not.toContain('SUBJECTIVE:');
  });

  it('returns an empty-note guard prompt when the template text is nonsense', () => {
    const prompt = buildGeneralConsultSystemPrompt('no text');

    expect(prompt).toContain('Return an empty string.');
    expect(prompt).not.toContain('Saved General Consult template instructions:\nno text');
  });

  it('falls back to the default General Consult template prompt when no override is provided', () => {
    const prompt = buildGeneralConsultSystemPrompt();

    expect(prompt).toContain(DEFAULT_GENERAL_CONSULT_TEMPLATE_PROMPT);
    expect(prompt).toContain('Use only information explicitly stated in the consultation source.');
  });

  it('accepts a short but usable custom prompt', () => {
    const prompt = buildGeneralConsultSystemPrompt('One paragraph summary');

    expect(prompt).toContain('One paragraph summary');
    expect(prompt).not.toContain('Return an empty string.');
  });

  it('uses the raw consultation source as the user prompt', () => {
    const prompt = buildGeneralConsultUserPrompt('Consultation transcript:\nTest');

    expect(prompt).toBe('Consultation transcript:\nTest');
  });
});

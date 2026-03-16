import { describe, expect, it } from 'vitest';
import {
  buildGeneralConsultExtractionSystemPrompt,
  buildGeneralConsultRecoverySystemPrompt,
  buildGeneralConsultRecoveryUserPrompt,
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
    expect(prompt).toContain('Use only explicit source information.');
  });

  it('builds a recovery prompt that explicitly asks for higher recall on noisy transcripts', () => {
    const prompt = buildGeneralConsultRecoverySystemPrompt('SUBJECTIVE:\nPLAN:\nKeep more detail.');

    expect(prompt).toContain('Recovery mode:');
    expect(prompt).toContain('The first extraction was too sparse');
    expect(prompt).toContain('do not rely on speaker labels being correct');
    expect(prompt).toContain('PLAN should keep all explicitly discussed vet recommendations');
  });

  it('builds a recovery user prompt that asks for a less sparse re-extraction', () => {
    const prompt = buildGeneralConsultRecoveryUserPrompt('Consultation transcript:\nTest');

    expect(prompt).toContain('The first pass was too sparse');
    expect(prompt).toContain('Do not be overly brief');
    expect(prompt).toContain('Consultation transcript:\nTest');
  });
});

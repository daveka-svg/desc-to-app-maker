import { describe, expect, it } from 'vitest';
import {
  buildGeneralConsultExtractionUserPrompt,
  buildGeneralConsultSystemPrompt,
} from '../../supabase/functions/generate-notes/general-consult';

describe('general consult prompt builder', () => {
  it('includes editable template guidance in the system and user prompts', () => {
    const editableTemplate = `SUBJECTIVE:
Keep details short.

PLAN:
Always preserve exact dose, timing, and recheck details.`;

    const systemPrompt = buildGeneralConsultSystemPrompt(editableTemplate);
    const userPrompt = buildGeneralConsultExtractionUserPrompt(
      'Consultation transcript:\nOwner reports vomiting.',
      editableTemplate,
    );

    expect(systemPrompt).toContain('User-editable template instructions');
    expect(systemPrompt).toContain('Always preserve exact dose, timing, and recheck details.');
    expect(userPrompt).toContain('Editable template guidance that the user can change in Settings');
    expect(userPrompt).toContain('Keep details short.');
  });
});

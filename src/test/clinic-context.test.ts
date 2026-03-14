import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNotesGenerationInput } from '@/lib/clinicContext';

describe('buildNotesGenerationInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds PE findings and vet notes as separate note-generation blocks', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    const output = buildNotesGenerationInput({
      transcript: 'Owner reports diarrhoea for 3 days.',
      peReport: 'PE: T 38.5 C, HR 110 bpm.',
      vetNotes: 'Recheck if not improved.',
      clinicKnowledgeBase: 'Clinic style text',
      includeClinicContext: false,
    });

    expect(output).toContain('Consultation transcript:\nOwner reports diarrhoea for 3 days.');
    expect(output).toContain('Physical examination:\nPE: T 38.5 C, HR 110 bpm.');
    expect(output).toContain('Vet notes:\nRecheck if not improved.');
    expect(output).not.toContain('Clinic personalization context:');
  });

  it('omits PE block when no PE findings are supplied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    const output = buildNotesGenerationInput({
      transcript: 'Owner reports diarrhoea for 3 days.',
      peReport: '',
      vetNotes: '',
      includeClinicContext: false,
    });

    expect(output).toContain('Consultation transcript:\nOwner reports diarrhoea for 3 days.');
    expect(output).not.toContain('Physical examination:');
    expect(output).not.toContain('Vet notes:');
  });
});

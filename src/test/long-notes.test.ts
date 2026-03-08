import { describe, expect, it } from 'vitest';
import { buildNotesGenerationInput } from '@/lib/clinicContext';
import {
  buildChunkedNoteSources,
  buildNoteSource,
  LONG_NOTE_CHUNK_CHARS,
  LONG_NOTE_TRIGGER_CHARS,
  parseNoteSource,
  shouldChunkNoteTranscript,
  splitTranscriptIntoChunks,
} from '../../supabase/functions/generate-notes/long-notes';
import {
  mergeGeneralConsultGroundingPayloads,
  type GeneralConsultGroundingPayload,
} from '../../supabase/functions/generate-notes/grounding';

describe('long note handling', () => {
  it('keeps full note transcripts in the client payload without omission markers', () => {
    const longTranscript = `Start ${'very detailed consultation text '.repeat(2400)}End`;

    const payload = buildNotesGenerationInput({
      transcript: longTranscript,
      peReport: 'Temp 38.7C',
      vetNotes: 'Owner worried about appetite.',
      clinicKnowledgeBase: 'Use concise UK vet style.',
    });

    expect(payload).toContain(longTranscript);
    expect(payload).not.toContain('[... ');
    expect(payload).toContain('Physical examination:\nTemp 38.7C');
    expect(payload).toContain('Vet notes:\nOwner worried about appetite.');
  });

  it('parses structured note source and rebuilds chunked sources with static context preserved', () => {
    const transcript = Array.from(
      { length: 260 },
      (_, index) => `[${index}] Stool update and vomiting detail. Owner reports urgency, watery stool, and reduced appetite today.`,
    ).join('\n');
    const source = [
      `Consultation transcript:\n${transcript}`,
      'Clinic personalization context:\nClinic phone: 01234 567890',
      'Physical examination:\nBAR, T 38.7C',
      'Vet notes:\nRecheck if not improving.',
    ].join('\n\n');

    const parsed = parseNoteSource(source);
    const rebuilt = buildNoteSource(parsed);
    const chunkedSources = buildChunkedNoteSources(source);

    expect(rebuilt).toBe(source);
    expect(chunkedSources.length).toBeGreaterThan(1);
    expect(chunkedSources.every((chunk) => chunk.clinicPersonalizationContext === 'Clinic phone: 01234 567890')).toBe(true);
    expect(chunkedSources.every((chunk) => chunk.physicalExamination === 'BAR, T 38.7C')).toBe(true);
    expect(chunkedSources.every((chunk) => chunk.vetNotes === 'Recheck if not improving.')).toBe(true);
  });

  it('splits long transcripts by line and preserves all content across chunks', () => {
    const transcript = Array.from({ length: 120 }, (_, index) =>
      `Line ${index + 1}: ${'Owner reports ongoing diarrhoea and urgency. '.repeat(8).trim()}`
    ).join('\n');

    const chunks = splitTranscriptIntoChunks(transcript, Math.floor(LONG_NOTE_CHUNK_CHARS / 4));
    const rebuilt = chunks.join('\n');

    expect(shouldChunkNoteTranscript('x'.repeat(LONG_NOTE_TRIGGER_CHARS + 1))).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
    expect(rebuilt).toContain('Line 1:');
    expect(rebuilt).toContain('Line 120:');
    expect(rebuilt.replace(/\s+/g, ' ').trim()).toBe(transcript.replace(/\s+/g, ' ').trim());
  });

  it('merges grounded SOAP payloads from multiple chunks', () => {
    const first: GeneralConsultGroundingPayload = {
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [{ text: 'Diarrhoea since yesterday', evidence: 'Diarrhoea since yesterday' }],
        OBJECTIVE: [{ text: 'T 38.7C', evidence: 'T 38.7C' }],
        ASSESSMENT: [],
        PLAN: [{ text: 'Maropitant 1 mg/kg SC', evidence: 'Maropitant 1 mg/kg SC' }],
      },
    };
    const second: GeneralConsultGroundingPayload = {
      complexity: 'complex',
      sections: {
        SUBJECTIVE: [{ text: 'One vomit yesterday', evidence: 'One vomit yesterday' }],
        OBJECTIVE: [],
        ASSESSMENT: [{ text: 'Acute gastroenteritis discussed', evidence: 'Acute gastroenteritis discussed' }],
        PLAN: [{ text: 'Nurse call tomorrow 15:30', evidence: 'Nurse call tomorrow 15:30' }],
      },
    };

    const merged = mergeGeneralConsultGroundingPayloads([first, second]);

    expect(merged.complexity).toBe('complex');
    expect(merged.sections.SUBJECTIVE).toHaveLength(2);
    expect(merged.sections.OBJECTIVE).toHaveLength(1);
    expect(merged.sections.ASSESSMENT).toHaveLength(1);
    expect(merged.sections.PLAN).toHaveLength(2);
  });
});

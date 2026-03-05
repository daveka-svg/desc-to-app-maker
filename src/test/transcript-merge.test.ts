import { describe, expect, it } from 'vitest';
import { extractPlainTranscript, mergeTranscriptTail } from '@/lib/transcriptMerge';

describe('transcript tail merge', () => {
  it('extracts plain transcript by removing speaker prefixes', () => {
    const plain = extractPlainTranscript('**Speaker 1:** Hello there\n\n**Speaker 2:** Yes please');
    expect(plain).toBe('Hello there Yes please');
  });

  it('appends only the missing audio tail when overlap is found', () => {
    const result = mergeTranscriptTail(
      '**Speaker 1:** Bella has been off food for two days',
      'off food for two days and is now drinking a little'
    );

    expect(result.warning).toBeNull();
    expect(result.usedAudioTail).toBe(true);
    expect(result.mergedTranscript).toContain('and is now drinking a little');
  });

  it('keeps live transcript without user-facing warning when merge confidence is low', () => {
    const live = '**Speaker 1:** Bella is much brighter today';
    const result = mergeTranscriptTail(live, 'Completely different wording from another consult');

    expect(result.warning).toBeNull();
    expect(result.mergedTranscript).toBe(live);
    expect(result.confidence).toBe('low');
  });

  it('uses full audio transcript when live transcript is empty', () => {
    const result = mergeTranscriptTail('', 'Patient was rechecked and discharged');
    expect(result.warning).toBeNull();
    expect(result.mergedTranscript).toBe('**Speaker 1:** Patient was rechecked and discharged');
  });
});

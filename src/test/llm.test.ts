import { describe, expect, it } from 'vitest';
import { sanitizePlainClinicalText } from '@/lib/llm';

describe('sanitizePlainClinicalText', () => {
  it('removes markdown emphasis markers from note text', () => {
    const input = `**SUBJECTIVE:**\nDog bright.\n\n__PLAN:__\n**Monitor** at home.`;

    expect(sanitizePlainClinicalText(input)).toBe(
      `SUBJECTIVE:\nDog bright.\n\nPLAN:\nMonitor at home.`,
    );
  });

  it('removes markdown heading prefixes and stray markers', () => {
    const input = `## ASSESSMENT\n**Acute gastroenteritis**\n\nPLAN**\nSupportive care.`;

    expect(sanitizePlainClinicalText(input)).toBe(
      `ASSESSMENT\nAcute gastroenteritis\n\nPLAN\nSupportive care.`,
    );
  });
});

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

  it('omits placeholder sections instead of rendering no-data filler text', () => {
    const input = `TREATMENT: Owner requested weight measurement and vaccination for Ben.\n\nOBJECTIVE: No vitals or physical examination data recorded.\n\nASSESSMENT: No explicit assessment documented.\n\nPLAN: Request for vaccination placed.`;

    expect(sanitizePlainClinicalText(input)).toBe(
      `TREATMENT: Owner requested weight measurement and vaccination for Ben.\n\nPLAN: Request for vaccination placed.`,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizePlainClinicalText, upsertSeparatePESection } from '@/lib/llm';

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
    const input = `TREATMENT: Owner requested weight measurement and vaccination for Ben.\n\nOBJECTIVE: No vitals or physical examination data recorded.\n\nASSESSMENT: No explicit assessment or diagnosis stated.\n\nPLAN: Request for vaccination placed.`;

    expect(sanitizePlainClinicalText(input)).toBe(
      `TREATMENT:\nOwner requested weight measurement and vaccination for Ben.\n\nPLAN:\nRequest for vaccination placed.`,
    );
  });

  it('removes placeholder sentences inside a mixed-content section', () => {
    const input = `TREATMENT: Owner requested weight and vaccination for Ben. No current medications or health issues were mentioned. Owner concerns: need for weight measurement and up-to-date vaccines.\n\nPLAN: Veterinarian will request weight and vaccination; will send a text when ready. No further instructions provided.`;

    expect(sanitizePlainClinicalText(input)).toBe(
      `TREATMENT:\nOwner requested weight and vaccination for Ben. Owner concerns: need for weight measurement and up-to-date vaccines.\n\nPLAN:\nVeterinarian will request weight and vaccination; will send a text when ready.`,
    );
  });

  it('inserts a separate PE section below OBJECTIVE', () => {
    const input = `SUBJECTIVE:\nVomiting since yesterday.\n\nOBJECTIVE:\nQuiet, hydrated.\n\nPLAN:\nMonitor at home.`;

    expect(upsertSeparatePESection(input, 'PE: Temp 38.5 C, HR 110 bpm.')).toBe(
      `SUBJECTIVE:\nVomiting since yesterday.\n\nOBJECTIVE:\nQuiet, hydrated.\n\nPE:\nTemp 38.5 C, HR 110 bpm.\n\nPLAN:\nMonitor at home.`,
    );
  });

  it('replaces any existing PE section instead of duplicating it', () => {
    const input = `SUBJECTIVE:\nVomiting since yesterday.\n\nOBJECTIVE:\nQuiet, hydrated.\n\nPE:\nOld PE text.\n\nPLAN:\nMonitor at home.`;

    expect(upsertSeparatePESection(input, 'PE: Temp 38.5 C, HR 110 bpm.')).toBe(
      `SUBJECTIVE:\nVomiting since yesterday.\n\nOBJECTIVE:\nQuiet, hydrated.\n\nPE:\nTemp 38.5 C, HR 110 bpm.\n\nPLAN:\nMonitor at home.`,
    );
  });
});

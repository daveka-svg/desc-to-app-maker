import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterGroundedGeneralConsultPayload,
  parseGeneralConsultGroundingPayload,
  renderGeneralConsultFromGroundedPayload,
} from '../../supabase/functions/generate-notes/grounding';

const FIXTURE_TRANSCRIPT = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/mock-consultation/dog-diarrhoea-20min-transcript.txt'),
  'utf8',
).trim();

const FIXTURE_EXPECTED_GENERAL_CONSULT = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/mock-consultation/expected-general-consult.txt'),
  'utf8',
).trim();

describe('general consult grounding', () => {
  it('drops non-grounded assessment and plan statements', () => {
    const source = `
      Consultation transcript:
      Vet: Impression is acute gastroenteritis likely dietary indiscretion.
      Vet: Plan maropitant injection and Pro-Kolin 5 ml q8h for 3 days.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [],
        OBJECTIVE: [],
        ASSESSMENT: [
          {
            text: 'Acute gastroenteritis likely dietary indiscretion',
            evidence: 'acute gastroenteritis likely dietary indiscretion',
          },
          {
            text: 'Pancreatitis suspected and severe sepsis risk',
            evidence: 'pancreatitis suspected and severe sepsis risk',
          },
        ],
        PLAN: [
          {
            text: 'Maropitant and Pro-Kolin as discussed',
            evidence: 'maropitant injection and Pro-Kolin 5 ml q8h for 3 days',
          },
          {
            text: 'Start omeprazole 0.5 mg/kg for 5 days',
            evidence: 'omeprazole 0.5 mg/kg for 5 days',
          },
        ],
      },
    }));

    expect(payload).not.toBeNull();
    const filtered = filterGroundedGeneralConsultPayload(payload!, source);

    expect(filtered.sections.ASSESSMENT).toHaveLength(1);
    expect(filtered.sections.ASSESSMENT[0].text).toContain('Acute gastroenteritis');
    expect(filtered.sections.PLAN).toHaveLength(1);
    expect(filtered.sections.PLAN[0].text).toContain('Maropitant');
  });

  it('renders headings in SOAP order and omits empty sections', () => {
    const rendered = renderGeneralConsultFromGroundedPayload({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [{ text: 'Loose stool since yesterday', evidence: 'Loose stool since yesterday' }],
        OBJECTIVE: [],
        ASSESSMENT: [{ text: 'Acute gastroenteritis discussed', evidence: 'Acute gastroenteritis discussed' }],
        PLAN: [{ text: 'Monitor at home', evidence: 'Monitor at home' }],
      },
    });

    expect(rendered.includes('SUBJECTIVE:')).toBe(true);
    expect(rendered.includes('OBJECTIVE:')).toBe(false);
    expect(rendered.includes('ASSESSMENT:')).toBe(true);
    expect(rendered.includes('PLAN:')).toBe(true);
    expect(rendered.indexOf('SUBJECTIVE:')).toBeLessThan(rendered.indexOf('ASSESSMENT:'));
    expect(rendered.indexOf('ASSESSMENT:')).toBeLessThan(rendered.indexOf('PLAN:'));
  });

  it('returns empty string when all sections are empty', () => {
    const rendered = renderGeneralConsultFromGroundedPayload({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [],
        OBJECTIVE: [],
        ASSESSMENT: [],
        PLAN: [],
      },
    });

    expect(rendered).toBe('');
  });

  it('dedupes repeated recap content while keeping one plan item', () => {
    const source = `
      Vet: Acute diarrhoea since yesterday morning.
      Vet: Plan maropitant injection today.
      Vet: Plan maropitant injection today.
      Vet: Nurse follow-up tomorrow at 15:30.
      Vet: Nurse follow-up tomorrow at 15:30.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Acute diarrhoea since yesterday morning',
            evidence: 'Acute diarrhoea since yesterday morning',
          },
        ],
        OBJECTIVE: [],
        ASSESSMENT: [],
        PLAN: [
          {
            text: 'Maropitant injection today',
            evidence: 'Plan maropitant injection today',
          },
          {
            text: 'Maropitant injection today for GI signs',
            evidence: 'Plan maropitant injection today',
          },
          {
            text: 'Nurse follow-up tomorrow at 15:30',
            evidence: 'Nurse follow-up tomorrow at 15:30',
          },
          {
            text: 'Nurse progress call tomorrow at 15:30',
            evidence: 'Nurse follow-up tomorrow at 15:30',
          },
        ],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, source);
    expect(filtered.sections.PLAN).toHaveLength(2);

    const rendered = renderGeneralConsultFromGroundedPayload(filtered);
    expect(rendered.match(/15:30/g)).toHaveLength(1);
    expect(rendered.indexOf('SUBJECTIVE:')).toBeLessThan(rendered.indexOf('PLAN:'));
  });

  it('matches the Milo SOAP fixture and keeps only explicit plan items', () => {
    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Milo, 4y MN Labrador',
            evidence: "Milo, he's four, Labrador, male neutered",
          },
          {
            text: 'Diarrhoea since yesterday morning, first noted about 6am yesterday, 6-7 episodes yesterday and 3 this morning',
            evidence: "He's had diarrhoea since yesterday morning",
          },
          {
            text: 'Stool watery with mucus, tiny red streak once last night',
            evidence: 'Mostly watery with some mucus. I saw a tiny streak of red once last night',
          },
          {
            text: 'One vomit yesterday afternoon, yellow/foamy, none overnight',
            evidence: 'One vomit yesterday afternoon, yellow foamy stuff. None overnight',
          },
          {
            text: 'Appetite lower, drinking slightly more, slightly quieter but still waggy/wanting to go out, urgency overnight with no house accident',
            evidence: 'Appetite lower. He ignored breakfast today',
          },
          {
            text: 'Possible dietary indiscretion at park (sausage/bread), daycare contact with dog with loose stools, Pro-Kolin approx 2 ml BID yesterday, midday dosing may be difficult',
            evidence: 'He grabbed some sausage and maybe a bit of bread before I could stop him',
          },
        ],
        OBJECTIVE: [
          {
            text: 'Bright, responsive, friendly, slightly quieter than typical; wt 28.4 kg',
            evidence: "Milo's bright and responsive, a bit quieter than typical but still friendly. Weight today is 28.4 kg",
          },
          {
            text: 'T 38.7C, HR 108, RR 28; MM pink/moist; CRT<2',
            evidence: 'Temp is 38.7C. HR 108, RR 28. Mucous membranes pink and moist, CRT under 2 seconds',
          },
          {
            text: 'Mild cranial abdo discomfort on deep palpation, no obvious mass, no severe guarding',
            evidence: 'Mild abdominal discomfort on deep cranial palpation, no obvious mass, no severe guarding',
          },
          {
            text: 'Lungs clear, heart sounds normal rhythm, pulses good quality',
            evidence: 'Lungs clear, heart sounds normal rhythm, peripheral pulses good quality',
          },
          {
            text: 'Mild dehydration approx 5%',
            evidence: 'Hydration looks mildly reduced, around 5%',
          },
        ],
        ASSESSMENT: [
          {
            text: 'Acute gastroenteritis, likely dietary indiscretion',
            evidence: 'this is most consistent with acute gastroenteritis, likely dietary indiscretion',
          },
          {
            text: 'Stable for outpatient management today; no current indication for immediate hospitalisation',
            evidence: "He's stable for outpatient treatment today",
          },
          {
            text: 'Pancreatitis cannot be ruled out',
            evidence: 'pancreatitis cannot be ruled out',
          },
        ],
        PLAN: [
          {
            text: 'Maropitant 1 mg/kg SC in clinic',
            evidence: 'maropitant 1 mg/kg SC in clinic',
          },
          {
            text: 'Pro-Kolin 5 ml PO q8h x3 days; bland diet small frequent meals x3 days, then transition to normal food over 2-3 days if stools improve',
            evidence: 'Pro-Kolin 5 ml by mouth every 8 hours for 3 days, and a bland diet in small frequent meals',
          },
          {
            text: 'Encourage water; avoid high-fat treats and no new foods this week; short lead walks only today',
            evidence: 'encourage water, small frequent drinks are good. Avoid high-fat treats and no new foods this week',
          },
          {
            text: 'Monitor for repeated vomiting, unable to keep water down, increasing blood in stool, marked lethargy, abdominal pain, or no improvement by 48 hours',
            evidence: 'Please call urgently if: repeated vomiting, unable to keep water down, blood increasing in stool, marked lethargy, abdominal pain, or no improvement by 48 hours',
          },
          {
            text: 'Nurse progress call tomorrow at 15:30; if still loose/not improving, recheck and faecal testing',
            evidence: 'Reception has booked nurse phone update for tomorrow at 15:30',
          },
          {
            text: 'Stool pot and emailed care plan on checkout; reception to tag case for 48h review if no improvement',
            evidence: 'Tasks: nurse follow-up call tomorrow 15:30; provide stool pot; email care plan; reception to tag case for 48h review if no improvement',
          },
          {
            text: 'Start metronidazole now',
            evidence: 'metronidazole now',
          },
        ],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, FIXTURE_TRANSCRIPT);
    const rendered = renderGeneralConsultFromGroundedPayload(filtered);

    expect(filtered.sections.ASSESSMENT).toHaveLength(2);
    expect(filtered.sections.PLAN).toHaveLength(6);
    expect(rendered).toBe(FIXTURE_EXPECTED_GENERAL_CONSULT);
    expect(rendered).toContain('Maropitant 1 mg/kg SC in clinic');
    expect(rendered).toContain('Pro-Kolin 5 ml PO q8h x3 days');
    expect(rendered).toContain('Nurse progress call tomorrow at 15:30');
    expect(rendered).toContain('Stool pot and emailed care plan on checkout');
    expect(rendered).not.toContain('metronidazole');
  });
});

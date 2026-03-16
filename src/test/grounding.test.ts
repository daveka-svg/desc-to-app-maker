import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterGroundedGeneralConsultPayload,
  mergeGeneralConsultGroundingPayloads,
  parseGeneralConsultGroundingPayload,
  renderGeneralConsultFromGroundedPayload,
} from '../../supabase/functions/generate-notes/grounding';

const FIXTURE_TRANSCRIPT = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/mock-consultation/dog-diarrhoea-20min-transcript.txt'),
  'utf8',
).replace(/\r\n/g, '\n').trim();

const FIXTURE_EXPECTED_GENERAL_CONSULT = readFileSync(
  resolve(process.cwd(), 'src/test/fixtures/mock-consultation/expected-general-consult.txt'),
  'utf8',
).replace(/\r\n/g, '\n').trim();

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

  it('drops invented assessment and plan items when evidence is not actually assessment or plan', () => {
    const source = `
      Consultation transcript:
      Owner: He vomited twice yesterday and is quieter today.
      Vet: His abdomen feels soft and non-painful.
      Owner: Thank you.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Vomited twice yesterday, quieter today',
            evidence: 'He vomited twice yesterday and is quieter today',
          },
        ],
        OBJECTIVE: [
          {
            text: 'Abdomen soft, non-painful',
            evidence: 'His abdomen feels soft and non-painful',
          },
        ],
        ASSESSMENT: [
          {
            text: 'Acute gastroenteritis likely',
            evidence: 'He vomited twice yesterday and is quieter today',
          },
        ],
        PLAN: [
          {
            text: 'Bland diet and monitor at home',
            evidence: 'He vomited twice yesterday and is quieter today',
          },
        ],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, source);

    expect(filtered.sections.SUBJECTIVE).toHaveLength(1);
    expect(filtered.sections.OBJECTIVE).toHaveLength(1);
    expect(filtered.sections.ASSESSMENT).toHaveLength(0);
    expect(filtered.sections.PLAN).toHaveLength(0);
  });

  it('drops unrelated historical subjective items that do not affect today visit', () => {
    const source = `
      Consultation transcript:
      Owner: He has been vomiting since yesterday and off food today.
      Owner: He broke his leg five years ago but has been fine since.
      Vet: Impression is acute gastritis.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Vomiting since yesterday, off food today',
            evidence: 'He has been vomiting since yesterday and off food today',
          },
          {
            text: 'Broken leg 5 years ago, resolved',
            evidence: 'He broke his leg five years ago but has been fine since',
          },
        ],
        OBJECTIVE: [],
        ASSESSMENT: [
          {
            text: 'Acute gastritis',
            evidence: 'Impression is acute gastritis',
          },
        ],
        PLAN: [],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, source);
    const rendered = renderGeneralConsultFromGroundedPayload(filtered, source);

    expect(filtered.sections.SUBJECTIVE).toHaveLength(1);
    expect(rendered).toContain('Vomiting since yesterday');
    expect(rendered).not.toContain('Broken leg');
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

  it('renders numeric details, exact weekdays, and percentages in normalized form', () => {
    const rendered = renderGeneralConsultFromGroundedPayload({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Loose stool for three days and one vomit this morning',
            evidence: 'Loose stool for three days and one vomit this morning',
          },
        ],
        OBJECTIVE: [],
        ASSESSMENT: [],
        PLAN: [
          {
            text: 'Give one tablet twice daily for three days starting next monday',
            evidence: 'Give one tablet twice daily for three days starting next Monday',
          },
          {
            text: 'Split diet half and half for one week',
            evidence: 'Split diet half and half for one week',
          },
        ],
      },
    });

    expect(rendered).toContain('3d');
    expect(rendered).toContain('1 vomit');
    expect(rendered).toContain('1 tablet 2x daily for 3d starting next Monday');
    expect(rendered).toContain('50%/50%');
    expect(rendered).toContain('1wk');
  });

  it('drops placeholder JSON items such as N/A and null', () => {
    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          { text: 'N/A', evidence: 'N/A' },
          { text: 'Vomiting since yesterday', evidence: 'Vomiting since yesterday' },
        ],
        OBJECTIVE: [
          { text: 'null', evidence: 'null' },
        ],
        ASSESSMENT: [
          { text: 'Not available', evidence: 'Not available' },
        ],
        PLAN: [
          { text: 'No data', evidence: 'No data' },
        ],
      },
    }));

    expect(payload).not.toBeNull();
    expect(payload!.sections.SUBJECTIVE).toHaveLength(1);
    expect(payload!.sections.SUBJECTIVE[0].text).toBe('Vomiting since yesterday');
    expect(payload!.sections.OBJECTIVE).toHaveLength(0);
    expect(payload!.sections.ASSESSMENT).toHaveLength(0);
    expect(payload!.sections.PLAN).toHaveLength(0);
  });

  it('treats null sections and null items as empty', () => {
    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: null,
        OBJECTIVE: [
          null,
          { text: 'Patient appears thin', evidence: 'he is a little thin to me' },
        ],
        ASSESSMENT: null,
        PLAN: [
          { text: null, evidence: null },
        ],
      },
    }));

    expect(payload).not.toBeNull();
    expect(payload!.sections.SUBJECTIVE).toHaveLength(0);
    expect(payload!.sections.OBJECTIVE).toHaveLength(1);
    expect(payload!.sections.OBJECTIVE[0].text).toBe('Patient appears thin');
    expect(payload!.sections.ASSESSMENT).toHaveLength(0);
    expect(payload!.sections.PLAN).toHaveLength(0);
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

  it('can merge missing explicit items back after an incomplete first pass', () => {
    const source = `
      Consultation transcript:
      Owner: Vomiting since yesterday and quieter today.
      Vet: Impression is mild gastritis.
      Vet: Plan bland diet for 3 days and monitor for further vomiting.
    `;

    const firstPass = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Vomiting since yesterday, quieter today',
            evidence: 'Vomiting since yesterday and quieter today',
          },
        ],
        OBJECTIVE: [],
        ASSESSMENT: [
          {
            text: 'Mild gastritis',
            evidence: 'Impression is mild gastritis',
          },
        ],
        PLAN: [],
      },
    }));

    const completenessPass = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [],
        OBJECTIVE: [],
        ASSESSMENT: [],
        PLAN: [
          {
            text: 'Bland diet x3 days; monitor for further vomiting',
            evidence: 'Plan bland diet for 3 days and monitor for further vomiting',
          },
        ],
      },
    }));

    const merged = filterGroundedGeneralConsultPayload(
      mergeGeneralConsultGroundingPayloads([firstPass!, completenessPass!]),
      source,
    );

    expect(merged.sections.PLAN).toHaveLength(1);
    expect(merged.sections.PLAN[0].text).toContain('Bland diet');
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

    expect(filtered.sections.ASSESSMENT).toHaveLength(1);
    expect(filtered.sections.PLAN).toHaveLength(6);
    expect(rendered).toBe(FIXTURE_EXPECTED_GENERAL_CONSULT);
    expect(rendered).toContain('Maropitant 1 mg/kg SC in clinic');
    expect(rendered).toContain('Pro-Kolin 5 ml PO q8h x3 days');
    expect(rendered).toContain('no improvement by 48h');
    expect(rendered).toContain('tomorrow at 15:30');
    expect(rendered).not.toContain('metronidazole');
  });

  it('keeps long-consult output concise', () => {
    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          { text: 'Vomiting since yesterday', evidence: 'Vomiting since yesterday' },
          { text: 'Loose stool since yesterday', evidence: 'Loose stool since yesterday' },
          { text: 'Appetite reduced, still drinking', evidence: 'Appetite reduced, still drinking' },
          { text: 'One previous grape incident last year, resolved', evidence: 'One previous grape incident last year, resolved' },
          { text: 'Urgency overnight', evidence: 'Urgency overnight' },
          { text: 'Owner worried about dehydration', evidence: 'Owner worried about dehydration' },
        ],
        OBJECTIVE: [
          { text: 'BAR, wt 28.4 kg', evidence: 'BAR, wt 28.4 kg' },
          { text: 'T 38.7C HR 108 RR 28', evidence: 'T 38.7C HR 108 RR 28' },
        ],
        ASSESSMENT: [
          { text: 'Acute gastroenteritis', evidence: 'Acute gastroenteritis' },
        ],
        PLAN: [
          { text: 'Maropitant 1 mg/kg SC', evidence: 'Plan maropitant 1 mg/kg SC' },
          { text: 'Pro-Kolin 5 ml PO q8h x3 days', evidence: 'Pro-Kolin 5 ml PO q8h x3 days' },
          { text: 'Bland diet', evidence: 'Bland diet' },
          { text: 'Monitor for worsening vomiting or lethargy', evidence: 'Monitor for worsening vomiting or lethargy' },
          { text: 'Nurse call tomorrow', evidence: 'Nurse call tomorrow' },
          { text: 'Email care plan', evidence: 'Email care plan' },
        ],
      },
    }));

    const longSource = `Consultation transcript:
Vomiting since yesterday.
Loose stool since yesterday.
Appetite reduced, still drinking.
Urgency overnight.
Owner worried about dehydration.
BAR, wt 28.4 kg.
T 38.7C HR 108 RR 28.
Acute gastroenteritis.
Plan maropitant 1 mg/kg SC.
Pro-Kolin 5 ml PO q8h x3 days.
Bland diet.
Monitor for worsening vomiting or lethargy.
Nurse call tomorrow.
Email care plan.
${'Detailed discussion about vomiting and diarrhoea. '.repeat(1700)}`;
    const filtered = filterGroundedGeneralConsultPayload(payload!, longSource);
    const rendered = renderGeneralConsultFromGroundedPayload(filtered, longSource);
    const renderedWordCount = rendered.split(/\s+/).filter(Boolean).length;

    expect(filtered.sections.SUBJECTIVE.length).toBeLessThanOrEqual(7);
    expect(filtered.sections.PLAN.length).toBeLessThanOrEqual(7);
    expect(rendered).toContain('T 38.7C');
    expect(renderedWordCount).toBeLessThanOrEqual(220);
  });

  it('retains elaborated diet and prior-episode context when central to the consult', () => {
    const source = `
      Consultation transcript:
      Owner: Diarrhoea for 4 days.
      Owner: Same thing happened 2-3 months ago and he was on IV fluids overnight.
      Owner: He has mostly been eating Applaws cat chicken and broth because he struggles to eat normal food.
      Owner: No vomiting.
      Vet: He is a little thin to me.
      Vet: He needs a complete dog food long term.
      Vet: Royal Canin GI or Purina GI were suggested.
      Vet: Buscopan 1/2 of a 10 mg tablet once daily for 3-4 days if straining/frequent stools.
      Vet: Transition 50% new diet with 50% current diet over 1 week.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'Diarrhoea for 4 days',
            evidence: 'Diarrhoea for 4 days',
          },
          {
            text: 'Previous similar episode 2-3 months ago, hospitalised overnight on IV fluids',
            evidence: 'Same thing happened 2-3 months ago and he was on IV fluids overnight',
          },
          {
            text: 'Mostly eating Applaws cat chicken and broth because he struggles to eat normal food',
            evidence: 'He has mostly been eating Applaws cat chicken and broth because he struggles to eat normal food',
          },
          {
            text: 'No vomiting',
            evidence: 'No vomiting',
          },
        ],
        OBJECTIVE: [
          {
            text: 'Thin body condition observed',
            evidence: 'He is a little thin to me',
          },
        ],
        ASSESSMENT: [],
        PLAN: [
          {
            text: 'Needs complete dog food long term',
            evidence: 'He needs a complete dog food long term',
          },
          {
            text: 'Royal Canin GI or Purina GI suggested',
            evidence: 'Royal Canin GI or Purina GI were suggested',
          },
          {
            text: 'Buscopan 1/2 of a 10 mg tablet once daily for 3-4 days if straining/frequent stools',
            evidence: 'Buscopan 1/2 of a 10 mg tablet once daily for 3-4 days if straining/frequent stools',
          },
          {
            text: 'Transition 50% new diet with 50% current diet over 1 week',
            evidence: 'Transition 50% new diet with 50% current diet over 1 week',
          },
        ],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, source);
    const rendered = renderGeneralConsultFromGroundedPayload(filtered, source);

    expect(rendered).toContain('Applaws cat chicken and broth');
    expect(rendered).toContain('2-3mo ago');
    expect(rendered).toContain('No vomiting');
    expect(rendered).toContain('Buscopan 1/2 of a 10 mg tablet 1x daily for 3-4d');
    expect(rendered).toContain('50% new diet with 50% current diet over 1wk');
  });

  it('retains wellness screening, estimate, and follow-up communication details when explicitly discussed', () => {
    const source = `
      Consultation transcript:
      Owner: First time here, wants a general check up.
      Owner: She eats cooked natural food, no dry food. Previous scratching stopped after dry food was removed. Possible chicken allergy.
      Vet: Weight is 13.9 kg. Muscle tone is good. Teeth are nice and clean.
      Vet: She is in very good condition for her age.
      Owner: Do you think she needs a blood test?
      Vet: We could do a general profile now or in 1-2 months for peace of mind and future comparison.
      Vet: The profile would look at white blood cells, red blood cells, liver function, kidney function, pancreas enzymes, and electrolytes.
      Vet: I will take the blood sample today and email the results on Monday.
      Owner: Email please.
      Vet: We have Spectra for fleas, ticks, and worms, or Milpro as the worming tablet.
      Owner: Just the worming tablet.
      Vet: Milpro is 1 tablet every 3 months and costs £24.30.
    `;

    const payload = parseGeneralConsultGroundingPayload(JSON.stringify({
      complexity: 'routine',
      sections: {
        SUBJECTIVE: [
          {
            text: 'First visit for a general check up',
            evidence: 'First time here, wants a general check up',
          },
          {
            text: 'Cooked natural food only, no dry food; previous scratching stopped after dry food was removed; possible chicken allergy',
            evidence: 'She eats cooked natural food, no dry food. Previous scratching stopped after dry food was removed. Possible chicken allergy',
          },
          {
            text: 'Owner asked whether blood testing is needed',
            evidence: 'Do you think she needs a blood test?',
          },
        ],
        OBJECTIVE: [
          {
            text: 'Wt 13.9 kg, good muscle tone, teeth clean',
            evidence: 'Weight is 13.9 kg. Muscle tone is good. Teeth are nice and clean',
          },
        ],
        ASSESSMENT: [
          {
            text: 'Very good condition for age',
            evidence: 'She is in very good condition for her age',
          },
        ],
        PLAN: [
          {
            text: 'General profile offered now or in 1-2 months for peace of mind and future comparison',
            evidence: 'We could do a general profile now or in 1-2 months for peace of mind and future comparison',
          },
          {
            text: 'Profile would assess WBC, RBC, liver, kidney, pancreas enzymes, and electrolytes',
            evidence: 'The profile would look at white blood cells, red blood cells, liver function, kidney function, pancreas enzymes, and electrolytes',
          },
          {
            text: 'Blood sample to be taken today; results by email on Monday',
            evidence: 'I will take the blood sample today and email the results on Monday',
          },
          {
            text: 'Owner prefers email communication',
            evidence: 'Email please',
          },
          {
            text: 'Spectra discussed for fleas, ticks, and worms; owner chose Milpro',
            evidence: 'We have Spectra for fleas, ticks, and worms, or Milpro as the worming tablet',
          },
          {
            text: 'Milpro 1 tablet q3 months, £24.30',
            evidence: 'Milpro is 1 tablet every 3 months and costs £24.30',
          },
        ],
      },
    }));

    const filtered = filterGroundedGeneralConsultPayload(payload!, source);
    const rendered = renderGeneralConsultFromGroundedPayload(filtered, source);

    expect(rendered).toContain('general check up');
    expect(rendered).toContain('Cooked natural food');
    expect(rendered).toContain('Previous scratching stopped after dry food was removed');
    expect(rendered).toContain('13.9 kg');
    expect(rendered).toContain('General profile offered now or in 1-2mo');
    expect(rendered).toContain('Blood sample to be taken today');
    expect(rendered).toContain('Results by email on Monday');
    expect(rendered).toContain('Spectra');
    expect(rendered).toContain('Milpro 1 tablet');
    expect(rendered).toContain('£24.30');
  });
});

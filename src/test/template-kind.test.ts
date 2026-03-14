import { describe, expect, it } from 'vitest';
import { inferTemplateKind } from '@/lib/templateKind';

describe('inferTemplateKind', () => {
  it('treats standard General Consult as general_consult', () => {
    expect(
      inferTemplateKind('General Consult', 'SUBJECTIVE:\nOBJECTIVE:\nASSESSMENT:\nPLAN:'),
    ).toBe('general_consult');
  });

  it('treats renamed SOAP-style general consult templates as general_consult', () => {
    expect(
      inferTemplateKind('Consult Note', `Use concise UK veterinary documentation style.

SUBJECTIVE:
OBJECTIVE:
ASSESSMENT:
PLAN:`),
    ).toBe('general_consult');
  });

  it('treats legacy renamed general consult prompts as general_consult', () => {
    expect(
      inferTemplateKind('Custom', `Use concise UK veterinary documentation style.
Only include if explicitly mentioned.

TREATMENT:
OBJECTIVE:
ASSESSMENT:
PLAN:
COMMUNICATIONS:`),
    ).toBe('general_consult');
  });

  it('treats bare legacy TREATMENT/COMMUNICATIONS prompts as general_consult', () => {
    expect(
      inferTemplateKind('My note', `TREATMENT:
OBJECTIVE:
ASSESSMENT:
PLAN:
COMMUNICATIONS:`),
    ).toBe('general_consult');
  });

  it('keeps unrelated templates on standard path', () => {
    expect(
      inferTemplateKind('Referral Letter', 'Formal referral letter tone in UK English.'),
    ).toBe('standard');
  });
});

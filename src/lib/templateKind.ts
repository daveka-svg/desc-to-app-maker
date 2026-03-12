export type TemplateKind = 'general_consult' | 'standard';

const normalizeTemplateName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizePrompt = (value: string): string =>
  value.replace(/\r\n/g, '\n').toUpperCase();

const hasSoapHeadings = (value: string): boolean =>
  ['SUBJECTIVE:', 'OBJECTIVE:', 'ASSESSMENT:', 'PLAN:'].every((heading) =>
    normalizePrompt(value).includes(heading),
  );

const hasLegacyGeneralConsultHeadings = (value: string): boolean =>
  ['TREATMENT:', 'OBJECTIVE:', 'ASSESSMENT:', 'PLAN:'].every((heading) =>
    normalizePrompt(value).includes(heading),
  ) && /COMMUNICATIONS?:/i.test(value);

export const inferTemplateKind = (
  templateName: string,
  templatePrompt: string,
): TemplateKind => {
  const normalizedName = normalizeTemplateName(templateName);
  const prompt = String(templatePrompt || '');

  if (
    normalizedName === 'general consult' ||
    normalizedName === 'general consultation' ||
    (normalizedName.includes('general') && normalizedName.includes('consult'))
  ) {
    return 'general_consult';
  }

  if (hasSoapHeadings(prompt)) {
    return 'general_consult';
  }

  if (
    hasLegacyGeneralConsultHeadings(prompt) &&
    /uk veterinary documentation style|only include if explicitly mentioned|do not make things up/i.test(prompt)
  ) {
    return 'general_consult';
  }

  return 'standard';
};

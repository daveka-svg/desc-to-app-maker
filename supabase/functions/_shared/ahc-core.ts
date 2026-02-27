/**
 * AHC shared core logic.
 * France (AHC09) is the canonical schema and category model.
 * This module contains no PDF mutation logic; it only provides:
 * - canonical schema
 * - profile detection
 * - field adapters (canonical key -> real PDF field)
 * - universal cross-out category decisions
 */

export const MAX_PETS = 5;

export const FRANCE_CROSSOUT_CATEGORIES = [
  "responsibility_owner",
  "responsibility_authorised_person",
  "responsibility_carrier",
  "five_or_less_animals",
  "more_than_five_animals",
  "attend_event",
  "association_events",
  "young_pet_unvaccinated",
  "young_pet_no_wild_contact",
  "young_pet_mother_vaccinated",
  "rabies_titre_option",
  "rabies_titre_option_a",
  "rabies_titre_option_b",
  "tapeworm_treated",
  "tapeworm_not_treated",
  "declaration_owner",
  "declaration_owner_alt",
  "declaration_authorised_person",
  "declaration_authorised_person_alt",
  "declaration_carrier",
] as const;

export type FranceCrossoutCategory = (typeof FRANCE_CROSSOUT_CATEGORIES)[number];

export const FRANCE_CHECK_CATEGORIES: Record<string, FranceCrossoutCategory> = {
  "Check 1": "responsibility_owner",
  "Check 2": "responsibility_authorised_person",
  "Check 3": "responsibility_carrier",
  "Check 4": "five_or_less_animals",
  "Check 5": "more_than_five_animals",
  "Check 6": "attend_event",
  "Check 7": "association_events",
  "Check 8": "young_pet_unvaccinated",
  "Check 9": "young_pet_no_wild_contact",
  "Check 10": "young_pet_mother_vaccinated",
  "Check 11": "rabies_titre_option_a",
  "Check 12": "rabies_titre_option_b",
  "Check 13": "rabies_titre_option",
  "Check 14": "tapeworm_treated",
  "Check 15": "tapeworm_not_treated",
  "Check 16": "declaration_authorised_person",
  "Check 17": "declaration_owner",
  "Check 18": "declaration_owner_alt",
  "Check 19": "declaration_authorised_person_alt",
  "Check 20": "declaration_carrier",
};

const BASE_CANONICAL_KEYS = [
  "certificate.reference",
  "owner.fullName",
  "owner.address",
  "owner.telephone",
  "destination.fullName",
  "destination.address",
  "destination.postcode",
  "destination.telephone",
  "goods.description",
  "goods.quantity",
  "localCompetentAuthority",
  "ov.name",
  "ov.address",
  "ov.telephone",
  "ov.qualification",
  "certificate.issue_date",
  "declaration.placeDate",
  "transport.transporter",
  "transport.meansOfTransport",
  "pets[0].identification_line",
] as const;

const PER_PET_SUFFIXES = [
  "microchip",
  "microchipDate",
  "rabies.date",
  "rabies.vaccine",
  "rabies.batch",
  "rabies.validFrom",
  "rabies.validTo",
  "rabies.bloodSamplingDate",
  "tapeworm.transponder",
  "tapeworm.product",
  "tapeworm.dateTime",
  "tapeworm.adminVet",
] as const;

export const CANONICAL_KEYS: string[] = (() => {
  const out = [...BASE_CANONICAL_KEYS];
  for (let i = 0; i < MAX_PETS; i++) {
    for (const suffix of PER_PET_SUFFIXES) {
      out.push(`pets[${i}].${suffix}`);
    }
  }
  for (let i = 0; i < MAX_PETS; i++) {
    out.push(`declaration.rows[${i}].transponder`);
    out.push(`declaration.rows[${i}].ahcNumber`);
  }
  return out;
})();

export const REQUIRED_CANONICAL_KEYS: string[] = [
  "certificate.reference",
  "owner.fullName",
  "owner.address",
  "destination.fullName",
  "destination.address",
  "destination.postcode",
  "destination.telephone",
  "localCompetentAuthority",
  "ov.name",
  "ov.address",
  "ov.telephone",
  "ov.qualification",
  "certificate.issue_date",
  "declaration.placeDate",
  "transport.transporter",
  "pets[0].microchip",
  "pets[0].microchipDate",
  "pets[0].rabies.date",
  "pets[0].rabies.vaccine",
  "pets[0].rabies.batch",
  "pets[0].rabies.validFrom",
  "pets[0].rabies.validTo",
  "pets[0].rabies.bloodSamplingDate",
  "pets[0].tapeworm.transponder",
  "pets[0].tapeworm.product",
  "pets[0].tapeworm.dateTime",
  "pets[0].tapeworm.adminVet",
  "declaration.rows[0].transponder",
  "declaration.rows[0].ahcNumber",
];

export type TemplateProfile =
  | "fr_textn_full_checks"
  | "es_textn_full_checks"
  | "named_full_checks_english"
  | "named_full_checks_german_patternA"
  | "named_full_checks_patternB"
  | "textn_reduced_no_strikes"
  | "unknown";

export interface ProfileCapabilities {
  supportsCheckWidgets: boolean;
  supportsStrikeWidgets: boolean;
  supportsFullCheckStrikePairing: boolean;
  reducedCrossoutRendering: boolean;
}

export interface ProfileInfo {
  profile: TemplateProfile;
  hasTextN: boolean;
  hasFullChecks: boolean;
  hasFullStrikes: boolean;
  hasStrikeFields: boolean;
  checkCount: number;
  strikeCount: number;
  checkFieldNames: string[];
  strikeFieldNames: string[];
  capabilities: ProfileCapabilities;
}

export interface DetectProfileOptions {
  templateHint?: string | null;
}

export type CanonicalFieldMapping = Record<string, string | null>;

type AdapterResolver = (fieldNames: Set<string>) => CanonicalFieldMapping;

interface TemplateAdapter {
  id: string;
  profiles: TemplateProfile[];
  resolve: AdapterResolver;
}

const CERT_REF_REGEX = /certificate\s*reference/i;
const PHONE_REGEX = /(telephone|phone|tel)/i;
const POSTCODE_REGEX = /(post\s*code|postcode|postal\s*code)/i;

function toFieldSet(fieldNamesInput: Iterable<string>): Set<string> {
  return new Set(Array.from(fieldNamesInput));
}

function extractIndex1To20(fieldName: string): number | null {
  const match = fieldName.match(/(?:^|[^0-9])(20|1[0-9]|[1-9])(?![0-9])/);
  if (!match) return null;
  const idx = Number(match[1]);
  return idx >= 1 && idx <= 20 ? idx : null;
}

function normalizeCheckOrStrikeName(prefix: "Check" | "Strike", fieldName: string): string | null {
  const strict = fieldName.match(new RegExp(`^${prefix}\\s*(\\d+)$`, "i"));
  if (strict) return `${prefix} ${Number(strict[1])}`;

  const checkLike = /\b(check(?:\s*box)?|checkbox|tick(?:\s*box)?|wyboru|wybor)\b/i;
  const strikeLike = /\b(strike|cross\s*out|crossout|line\s*out|lineout|skre(?:\u015b|s)?l)\b/i;
  const looksRelevant = prefix === "Check" ? checkLike.test(fieldName) : strikeLike.test(fieldName);
  if (!looksRelevant) return null;

  const idx = extractIndex1To20(fieldName);
  return idx ? `${prefix} ${idx}` : null;
}

function pick(fieldNames: Set<string>, ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fieldNames.has(candidate)) return candidate;
  }
  return null;
}

function pickRegex(fieldNames: Set<string>, pattern: RegExp): string | null {
  for (const name of fieldNames) {
    if (pattern.test(name)) return name;
  }
  return null;
}

function emptyMapping(): CanonicalFieldMapping {
  const mapping: CanonicalFieldMapping = {};
  for (const key of CANONICAL_KEYS) mapping[key] = null;
  return mapping;
}

function resolveCommonFields(fieldNames: Set<string>, mapping: CanonicalFieldMapping): void {
  mapping["owner.fullName"] = pick(fieldNames, "Name1");
  mapping["owner.address"] = pick(fieldNames, "Address1");
  mapping["owner.telephone"] = pick(fieldNames, "Telephone1", "Phone1", "Tel1");
  mapping["destination.fullName"] = pick(fieldNames, "Name2");
  mapping["destination.address"] = pick(fieldNames, "Address2");
  mapping["destination.postcode"] =
    pick(fieldNames, "Post code", "Postcode", "Postal code")
    ?? pickRegex(fieldNames, POSTCODE_REGEX);
  mapping["destination.telephone"] =
    pick(fieldNames, "Telephone2", "Phone2", "Tel2")
    ?? pickRegex(fieldNames, PHONE_REGEX);
  mapping["goods.description"] = pick(fieldNames, "Commodity description");
  mapping["pets[0].identification_line"] = pick(fieldNames, "Commodity description2");
  mapping["goods.quantity"] = pick(fieldNames, "Quantity");
  mapping["localCompetentAuthority"] = pick(fieldNames, "LCA");
  mapping["ov.name"] = pick(fieldNames, "OV name");
  mapping["ov.address"] = pick(fieldNames, "OV address", "OV Address");
  mapping["ov.telephone"] = pick(fieldNames, "OV telephone", "OV Telephone");
  mapping["ov.qualification"] = pick(fieldNames, "OV qualification", "OV Qualification");
  mapping["certificate.issue_date"] = pick(fieldNames, "Date");
  mapping["declaration.placeDate"] = pick(fieldNames, "Placedate", "PlaceDate");
  mapping["transport.transporter"] = pick(fieldNames, "Transporter");
  mapping["transport.meansOfTransport"] = pick(fieldNames, "Means of transport", "Means Of Transport");

  mapping["certificate.reference"] =
    pick(
      fieldNames,
      "Certificate reference No",
      "Certificate Reference No",
      "Certificate reference NO",
      "II.a. Certificate reference No",
      "II.a. Certificate Reference No",
    )
    ?? pickRegex(fieldNames, CERT_REF_REGEX)
    ?? pick(fieldNames, "Text1");

  const declarationTransponderCandidates = [
    "Transponder",
    "Transponder1",
    "Transponder2",
    "Transponder3",
    "Transponder4",
  ];
  const declarationAhcCandidatesA = [
    "AHC number",
    "AHC number1",
    "AHC number2",
    "AHC number3",
    "AHC number4",
  ];
  const declarationAhcCandidatesB = [
    "Animal health certificate number",
    "Animal health certificate number1",
    "Animal health certificate number2",
    "Animal health certificate number3",
    "Animal health certificate number4",
  ];
  for (let i = 0; i < MAX_PETS; i++) {
    mapping[`declaration.rows[${i}].transponder`] = pick(fieldNames, declarationTransponderCandidates[i]);
    mapping[`declaration.rows[${i}].ahcNumber`] = pick(
      fieldNames,
      declarationAhcCandidatesA[i],
      declarationAhcCandidatesB[i],
    );
  }
}

function resolveTextNPetFields(fieldNames: Set<string>, mapping: CanonicalFieldMapping): void {
  const baseOffsets = [2, 10, 18, 26, 34];
  const tapewormOffsets = [42, 46, 50, 54, 58];
  for (let i = 0; i < MAX_PETS; i++) {
    const base = baseOffsets[i];
    const tap = tapewormOffsets[i];
    const prefix = `pets[${i}]`;
    mapping[`${prefix}.microchip`] = fieldNames.has(`Text${base}`) ? `Text${base}` : null;
    mapping[`${prefix}.microchipDate`] = fieldNames.has(`Text${base + 1}`) ? `Text${base + 1}` : null;
    mapping[`${prefix}.rabies.date`] = fieldNames.has(`Text${base + 2}`) ? `Text${base + 2}` : null;
    mapping[`${prefix}.rabies.vaccine`] = fieldNames.has(`Text${base + 3}`) ? `Text${base + 3}` : null;
    mapping[`${prefix}.rabies.batch`] = fieldNames.has(`Text${base + 4}`) ? `Text${base + 4}` : null;
    mapping[`${prefix}.rabies.validFrom`] = fieldNames.has(`Text${base + 5}`) ? `Text${base + 5}` : null;
    mapping[`${prefix}.rabies.validTo`] = fieldNames.has(`Text${base + 6}`) ? `Text${base + 6}` : null;
    mapping[`${prefix}.rabies.bloodSamplingDate`] = fieldNames.has(`Text${base + 7}`) ? `Text${base + 7}` : null;
    mapping[`${prefix}.tapeworm.transponder`] = fieldNames.has(`Text${tap}`) ? `Text${tap}` : null;
    mapping[`${prefix}.tapeworm.product`] = fieldNames.has(`Text${tap + 1}`) ? `Text${tap + 1}` : null;
    mapping[`${prefix}.tapeworm.dateTime`] = fieldNames.has(`Text${tap + 2}`) ? `Text${tap + 2}` : null;
    mapping[`${prefix}.tapeworm.adminVet`] = fieldNames.has(`Text${tap + 3}`) ? `Text${tap + 3}` : null;
  }
}

function resolveNamedEnglishPetFields(fieldNames: Set<string>, mapping: CanonicalFieldMapping): void {
  for (let i = 0; i < MAX_PETS; i++) {
    const suffix = i === 0 ? "" : `${i + 1}`;
    const dashSuffix = i === 0 ? "" : `-${i + 1}`;
    const prefix = `pets[${i}]`;

    mapping[`${prefix}.microchip`] = pick(
      fieldNames,
      i === 0 ? "Alphanumeric code of the animal" : `Alphanumeric code of the animal${suffix}`,
    );
    mapping[`${prefix}.microchipDate`] = pick(fieldNames, i === 0 ? "Date1" : `Date1${dashSuffix}`);
    mapping[`${prefix}.rabies.date`] = pick(fieldNames, i === 0 ? "Date2" : `Date2${dashSuffix}`);
    mapping[`${prefix}.rabies.vaccine`] = pick(
      fieldNames,
      i === 0 ? "Name" : `Name${suffix}`,
      i === 0 ? "Name25" : `Name25${dashSuffix}`,
    );
    mapping[`${prefix}.rabies.batch`] = pick(fieldNames, i === 0 ? "Batch No" : `Batch No${suffix}`);
    mapping[`${prefix}.rabies.validFrom`] = pick(fieldNames, i === 0 ? "From" : `From${suffix}`);
    mapping[`${prefix}.rabies.validTo`] = pick(fieldNames, i === 0 ? "To" : `To${suffix}`);
    mapping[`${prefix}.rabies.bloodSamplingDate`] = pick(fieldNames, i === 0 ? "Date3" : `Date3${dashSuffix}`);
    mapping[`${prefix}.tapeworm.transponder`] = pick(
      fieldNames,
      i === 0 ? "Transponder or tattoo number of the dog" : `Transponder or tattoo number of the dog${suffix}`,
    );
    mapping[`${prefix}.tapeworm.product`] = pick(
      fieldNames,
      i === 0 ? "Name and manufacturer of the product" : `Name and manufacturer of the product${suffix}`,
    );
    mapping[`${prefix}.tapeworm.dateTime`] = pick(fieldNames, i === 0 ? "Date and Time" : `Date and Time${suffix}`);
    mapping[`${prefix}.tapeworm.adminVet`] = pick(
      fieldNames,
      i === 0 ? "Veterinarian Details" : `Veterinarian Details${suffix}`,
      i === 0 ? "Vet Details" : `Vet Details${suffix}`,
    );
  }
}

function resolveNamedGermanPatternAPetFields(fieldNames: Set<string>, mapping: CanonicalFieldMapping): void {
  for (let i = 0; i < MAX_PETS; i++) {
    const suffix = i === 0 ? "" : `${i + 1}`;
    const prefix = `pets[${i}]`;
    mapping[`${prefix}.microchip`] = pick(fieldNames, i === 0 ? "Code of Animal" : `Code of Animal${suffix}`);
    mapping[`${prefix}.microchipDate`] = pick(fieldNames, `Date1${i}`);
    mapping[`${prefix}.rabies.date`] = pick(fieldNames, i === 0 ? "Date20" : `Date20-${suffix}`);
    mapping[`${prefix}.rabies.vaccine`] = pick(fieldNames, i === 0 ? "Name20" : `Name20-${suffix}`);
    mapping[`${prefix}.rabies.batch`] = pick(fieldNames, i === 0 ? "Batch No" : `Batch No${suffix}`);
    mapping[`${prefix}.rabies.validFrom`] = pick(fieldNames, i === 0 ? "From" : `From${suffix}`);
    mapping[`${prefix}.rabies.validTo`] = pick(fieldNames, i === 0 ? "To" : `To${suffix}`);
    mapping[`${prefix}.rabies.bloodSamplingDate`] = pick(fieldNames, i === 0 ? "Date21" : `Date21-${suffix}`);
    mapping[`${prefix}.tapeworm.transponder`] = pick(
      fieldNames,
      i === 0 ? "Transponder or tattoo number of the dog" : `Transponder or tattoo number of the dog${suffix}`,
    );
    mapping[`${prefix}.tapeworm.product`] = pick(
      fieldNames,
      i === 0 ? "Name and manufacturer of the product" : `Name and manufacturer of the product${suffix}`,
      `Name1${i}`,
    );
    mapping[`${prefix}.tapeworm.dateTime`] = pick(fieldNames, i === 0 ? "Date22" : `Date22-${suffix}`, `Date1${i}`);
    mapping[`${prefix}.tapeworm.adminVet`] = pick(
      fieldNames,
      i === 0 ? "Veterinarian Details" : `Veterinarian Details${suffix}`,
      i === 0 ? "Vet Details" : `Vet Details${suffix}`,
    );
  }
}

function resolveNamedPatternBPetFields(fieldNames: Set<string>, mapping: CanonicalFieldMapping): void {
  for (let i = 0; i < MAX_PETS; i++) {
    const suffix = i === 0 ? "" : `${i + 1}`;
    const dashSuffix = i === 0 ? "" : `-${i + 1}`;
    const prefix = `pets[${i}]`;
    mapping[`${prefix}.microchip`] = pick(
      fieldNames,
      i === 0 ? "Code of the animal" : `Code of animal${suffix}`,
      i === 0 ? "Code of Animal" : `Code of Animal${suffix}`,
    );
    mapping[`${prefix}.microchipDate`] = pick(fieldNames, i === 0 ? "Date2" : `Date2${dashSuffix}`);
    mapping[`${prefix}.rabies.date`] = pick(fieldNames, i === 0 ? "Date3" : `Date3${dashSuffix}`);
    mapping[`${prefix}.rabies.vaccine`] = pick(
      fieldNames,
      i === 0 ? "Name" : `Name${suffix}`,
      i === 0 ? "Name3" : `Name${i + 2}`,
    );
    mapping[`${prefix}.rabies.batch`] = pick(fieldNames, i === 0 ? "Batch No" : `Batch No${suffix}`);
    mapping[`${prefix}.rabies.validFrom`] = pick(fieldNames, i === 0 ? "From" : `From${suffix}`);
    mapping[`${prefix}.rabies.validTo`] = pick(fieldNames, i === 0 ? "To" : `To${suffix}`);
    mapping[`${prefix}.rabies.bloodSamplingDate`] = pick(fieldNames, i === 0 ? "Date4" : `Date4-${i}`);
    mapping[`${prefix}.tapeworm.transponder`] = pick(
      fieldNames,
      i === 0 ? "Transponder or tattoo number of the dog" : `Transponder or tattoo number of the dog${suffix}`,
    );
    mapping[`${prefix}.tapeworm.product`] = pick(
      fieldNames,
      i === 0 ? "Name and manufacturer of the product" : `Name and manufacturer of the product${suffix}`,
      `Name1${i}`,
    );
    mapping[`${prefix}.tapeworm.dateTime`] = pick(fieldNames, i === 0 ? "Date and Time" : `Date and Time${suffix}`);
    mapping[`${prefix}.tapeworm.adminVet`] = pick(
      fieldNames,
      i === 0 ? "Veterinarian Details" : `Veterinarian Details${suffix}`,
      i === 0 ? "Vet details" : `Vet Details${suffix}`,
      i === 0 ? "Vet Details" : `Vet Details${suffix}`,
    );
  }
}

const ADAPTERS: TemplateAdapter[] = [
  {
    id: "fr-es-textn",
    profiles: ["fr_textn_full_checks", "es_textn_full_checks", "textn_reduced_no_strikes"],
    resolve: (fieldNames) => {
      const mapping = emptyMapping();
      resolveCommonFields(fieldNames, mapping);
      resolveTextNPetFields(fieldNames, mapping);
      return mapping;
    },
  },
  {
    id: "named-english",
    profiles: ["named_full_checks_english"],
    resolve: (fieldNames) => {
      const mapping = emptyMapping();
      resolveCommonFields(fieldNames, mapping);
      resolveNamedEnglishPetFields(fieldNames, mapping);
      return mapping;
    },
  },
  {
    id: "named-german-patternA",
    profiles: ["named_full_checks_german_patternA"],
    resolve: (fieldNames) => {
      const mapping = emptyMapping();
      resolveCommonFields(fieldNames, mapping);
      resolveNamedGermanPatternAPetFields(fieldNames, mapping);
      return mapping;
    },
  },
  {
    id: "named-patternB",
    profiles: ["named_full_checks_patternB"],
    resolve: (fieldNames) => {
      const mapping = emptyMapping();
      resolveCommonFields(fieldNames, mapping);
      resolveNamedPatternBPetFields(fieldNames, mapping);
      return mapping;
    },
  },
  {
    id: "fallback-hybrid",
    profiles: ["unknown"],
    resolve: (fieldNames) => {
      const mapping = emptyMapping();
      resolveCommonFields(fieldNames, mapping);
      resolveTextNPetFields(fieldNames, mapping);
      for (const [key, value] of Object.entries(resolveNamedEnglishPetFieldsShim(fieldNames))) {
        if (!mapping[key] && value) mapping[key] = value;
      }
      for (const [key, value] of Object.entries(resolveNamedGermanPatternAShim(fieldNames))) {
        if (!mapping[key] && value) mapping[key] = value;
      }
      for (const [key, value] of Object.entries(resolveNamedPatternBShim(fieldNames))) {
        if (!mapping[key] && value) mapping[key] = value;
      }
      return mapping;
    },
  },
];

function resolveNamedEnglishPetFieldsShim(fieldNames: Set<string>): CanonicalFieldMapping {
  const mapping = emptyMapping();
  resolveNamedEnglishPetFields(fieldNames, mapping);
  return mapping;
}

function resolveNamedGermanPatternAShim(fieldNames: Set<string>): CanonicalFieldMapping {
  const mapping = emptyMapping();
  resolveNamedGermanPatternAPetFields(fieldNames, mapping);
  return mapping;
}

function resolveNamedPatternBShim(fieldNames: Set<string>): CanonicalFieldMapping {
  const mapping = emptyMapping();
  resolveNamedPatternBPetFields(fieldNames, mapping);
  return mapping;
}

function pickAdapter(profile: TemplateProfile): TemplateAdapter {
  return ADAPTERS.find((adapter) => adapter.profiles.includes(profile))
    ?? ADAPTERS.find((adapter) => adapter.profiles.includes("unknown"))!;
}

export function detectProfile(fieldNamesInput: Iterable<string>, options: DetectProfileOptions = {}): ProfileInfo {
  const fieldNames = toFieldSet(fieldNamesInput);
  const templateHint = (options.templateHint || "").toLowerCase();

  const checkFieldNames = [...fieldNames]
    .map((name) => normalizeCheckOrStrikeName("Check", name))
    .filter((name): name is string => !!name)
    .sort((a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1]));

  const strikeFieldNames = [...fieldNames]
    .map((name) => normalizeCheckOrStrikeName("Strike", name))
    .filter((name): name is string => !!name)
    .sort((a, b) => Number(a.split(" ")[1]) - Number(b.split(" ")[1]));

  const checkIndexSet = new Set(checkFieldNames.map((name) => Number(name.split(" ")[1])));
  const strikeIndexSet = new Set(strikeFieldNames.map((name) => Number(name.split(" ")[1])));
  const hasFullChecks = Array.from({ length: 20 }, (_, i) => i + 1).every((n) => checkIndexSet.has(n));
  const hasFullStrikes = Array.from({ length: 20 }, (_, i) => i + 1).every((n) => strikeIndexSet.has(n));
  const hasTextN = [...fieldNames].some((name) => /^Text\d+$/i.test(name));
  const hasStrikeFields = strikeFieldNames.length > 0;

  let profile: TemplateProfile = "unknown";
  if (hasTextN && hasFullChecks && hasFullStrikes) {
    const looksSpanish = templateHint.includes("spanish") || templateHint.includes("espan") || templateHint.includes("ahc21");
    profile = looksSpanish ? "es_textn_full_checks" : "fr_textn_full_checks";
  } else if (!hasTextN && fieldNames.has("Alphanumeric code of the animal")) {
    profile = "named_full_checks_english";
  } else if (!hasTextN && (fieldNames.has("Code of Animal") || fieldNames.has("Code of Animal2"))) {
    profile = "named_full_checks_german_patternA";
  } else if (!hasTextN && (fieldNames.has("Code of the animal") || fieldNames.has("Code of animal2"))) {
    profile = "named_full_checks_patternB";
  } else if (hasTextN) {
    profile = "textn_reduced_no_strikes";
  }

  const capabilities: ProfileCapabilities = {
    supportsCheckWidgets: checkFieldNames.length > 0,
    supportsStrikeWidgets: strikeFieldNames.length > 0,
    supportsFullCheckStrikePairing: hasFullChecks && hasFullStrikes,
    reducedCrossoutRendering: profile === "textn_reduced_no_strikes" || !hasFullStrikes,
  };

  return {
    profile,
    hasTextN,
    hasFullChecks,
    hasFullStrikes,
    hasStrikeFields,
    checkCount: checkFieldNames.length,
    strikeCount: strikeFieldNames.length,
    checkFieldNames,
    strikeFieldNames,
    capabilities,
  };
}

export function buildFieldMapping(
  profileInfo: ProfileInfo,
  fieldNamesInput: Iterable<string>,
  overrides?: Record<string, string>,
): CanonicalFieldMapping {
  const fieldNames = toFieldSet(fieldNamesInput);
  const adapter = pickAdapter(profileInfo.profile);
  const mapping = adapter.resolve(fieldNames);

  if (overrides && typeof overrides === "object") {
    for (const [canonicalKey, pdfField] of Object.entries(overrides)) {
      if (!canonicalKey || !pdfField) continue;
      if (fieldNames.has(pdfField)) mapping[canonicalKey] = pdfField;
    }
  }
  return mapping;
}

export function buildCheckCategoryMapping(
  fieldNamesInput: Iterable<string>,
  overrides?: Record<string, string>,
): Record<string, FranceCrossoutCategory> {
  const fieldNames = toFieldSet(fieldNamesInput);
  const mapping: Record<string, FranceCrossoutCategory> = {};

  for (const name of fieldNames) {
    const normalized = normalizeCheckOrStrikeName("Check", name);
    if (!normalized) continue;
    const idx = Number(normalized.split(" ")[1]);
    const franceKey = `Check ${idx}`;
    const category = FRANCE_CHECK_CATEGORIES[franceKey];
    if (category) mapping[normalized] = category;
  }

  if (overrides && typeof overrides === "object") {
    for (const [checkFieldNameRaw, categoryRaw] of Object.entries(overrides)) {
      const normalizedCheck = normalizeCheckOrStrikeName("Check", checkFieldNameRaw);
      if (!normalizedCheck || !fieldNames.has(checkFieldNameRaw) && !fieldNames.has(normalizedCheck)) continue;
      if (!FRANCE_CROSSOUT_CATEGORIES.includes(categoryRaw as FranceCrossoutCategory)) continue;
      mapping[normalizedCheck] = categoryRaw as FranceCrossoutCategory;
    }
  }

  return mapping;
}

export function validateCanonicalCoverage(
  mapping: CanonicalFieldMapping,
  requiredKeys: string[] = REQUIRED_CANONICAL_KEYS,
): string[] {
  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (!mapping[key]) missing.push(key);
  }
  return missing;
}

export interface OverrideValidationIssue {
  canonicalKey: string;
  pdfField: string;
  reason: "field_not_found";
}

export function validateFieldOverrides(
  overrides: Record<string, string> | undefined,
  fieldNamesInput: Iterable<string>,
): OverrideValidationIssue[] {
  if (!overrides) return [];
  const fieldNames = toFieldSet(fieldNamesInput);
  const issues: OverrideValidationIssue[] = [];
  for (const [canonicalKey, pdfField] of Object.entries(overrides)) {
    if (!fieldNames.has(pdfField)) {
      issues.push({
        canonicalKey,
        pdfField,
        reason: "field_not_found",
      });
    }
  }
  return issues;
}

export interface CrossoutInput {
  transportBy: string;
  numPets: number;
  petSpecies: string;
  rabiesVaxDate: string;
  euEntryDate: string;
  petDob: string;
  isTapewormCountry: boolean;
}

export function parseDateUTC(value: string): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  return null;
}

export function computeCategoriesToCross(input: CrossoutInput): Set<FranceCrossoutCategory> {
  const categories = new Set<FranceCrossoutCategory>();

  if (input.transportBy === "owner") {
    categories.add("responsibility_authorised_person");
    categories.add("responsibility_carrier");
    categories.add("declaration_authorised_person");
    categories.add("declaration_authorised_person_alt");
    categories.add("declaration_carrier");
  } else if (input.transportBy === "authorised_person") {
    categories.add("responsibility_owner");
    categories.add("responsibility_carrier");
    categories.add("declaration_owner");
    categories.add("declaration_owner_alt");
    categories.add("declaration_carrier");
  } else if (input.transportBy === "carrier") {
    categories.add("responsibility_owner");
    categories.add("responsibility_authorised_person");
    categories.add("declaration_owner");
    categories.add("declaration_owner_alt");
    categories.add("declaration_authorised_person");
    categories.add("declaration_authorised_person_alt");
  }

  if (input.numPets <= 5) {
    categories.add("more_than_five_animals");
    categories.add("attend_event");
    categories.add("association_events");
  } else {
    categories.add("five_or_less_animals");
  }

  let adultRabiesClauseApplies = false;
  if (input.rabiesVaxDate && input.euEntryDate) {
    const vax = parseDateUTC(input.rabiesVaxDate);
    const entry = parseDateUTC(input.euEntryDate);
    if (vax && entry) {
      const daysSinceVax = (entry.getTime() - vax.getTime()) / 86400000;
      let ageAtVaxWeeks = Infinity;
      if (input.petDob) {
        const dob = parseDateUTC(input.petDob);
        if (dob) ageAtVaxWeeks = (vax.getTime() - dob.getTime()) / (86400000 * 7);
      }
      adultRabiesClauseApplies = daysSinceVax >= 21 && ageAtVaxWeeks >= 12;
      if (adultRabiesClauseApplies) {
        // Young/under-21-day clause not applicable.
        categories.add("young_pet_unvaccinated");
        categories.add("young_pet_no_wild_contact");
        categories.add("young_pet_mother_vaccinated");
      }
    }
  }

  if (adultRabiesClauseApplies) {
    // Based on 8233 NFG (Version 6.0, 23 Jan 2026):
    // for GB origin, II.3.1 first sub-clause (listed Annex II territory) applies,
    // so only the titre-test route sub-clause is crossed out.
    categories.add("rabies_titre_option_b");
  } else {
    // If the adult clause does not apply, keep young-animal path and remove II.3/II.3.1 route.
    categories.add("rabies_titre_option");
    categories.add("rabies_titre_option_a");
    categories.add("rabies_titre_option_b");
  }

  if (input.petSpecies !== "dog") {
    categories.add("tapeworm_treated");
    categories.add("tapeworm_not_treated");
  } else if (input.isTapewormCountry) {
    categories.add("tapeworm_not_treated");
  } else {
    categories.add("tapeworm_treated");
  }

  return categories;
}

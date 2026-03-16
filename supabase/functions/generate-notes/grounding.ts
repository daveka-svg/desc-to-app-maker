export type GeneralSection =
  | "SUBJECTIVE"
  | "OBJECTIVE"
  | "ASSESSMENT"
  | "PLAN";

export interface GroundingItem {
  text: string;
  evidence: string;
}

export interface GeneralConsultGroundingPayload {
  complexity: "routine" | "complex";
  sections: Record<GeneralSection, GroundingItem[]>;
}

const SECTION_ORDER: GeneralSection[] = [
  "SUBJECTIVE",
  "OBJECTIVE",
  "ASSESSMENT",
  "PLAN",
];

const DEFAULT_MAX_ITEMS_BY_SECTION: Record<GeneralSection, number> = {
  SUBJECTIVE: 8,
  OBJECTIVE: 4,
  ASSESSMENT: 1,
  PLAN: 8,
};

const LONG_SOURCE_MAX_ITEMS_BY_SECTION: Record<GeneralSection, number> = {
  SUBJECTIVE: 10,
  OBJECTIVE: 4,
  ASSESSMENT: 1,
  PLAN: 9,
};

const LONG_SOURCE_WORD_THRESHOLD = 1600;
const SHORT_CONSULT_WORD_THRESHOLD = 180;
const MIN_TEXT_EVIDENCE_OVERLAP = 0.2;

const PLAN_MARKERS = [
  "plan",
  "recommend",
  "recommended",
  "monitor",
  "diet",
  "follow up",
  "follow-up",
  "recheck",
  "return",
  "call",
  "book",
  "booked",
  "schedule",
  "scheduled",
  "arrange",
  "arranged",
  "dispense",
  "dispensed",
  "give",
  "given",
  "administer",
  "administered",
  "start",
  "continue",
  "avoid",
  "email",
  "results",
  "result",
  "blood",
  "profile",
  "screen",
  "screening",
  "sample",
  "estimate",
  "cost",
  "price",
  "£",
  "worm",
  "worming",
  "deworm",
  "flea",
  "tick",
  "spectra",
  "milpro",
  "provide",
  "provided",
  "dose",
  "q8h",
  "po",
  "sc",
  "im",
  "iv",
];

const ASSESSMENT_MARKERS = [
  "assessment",
  "impression",
  "diagnosis",
  "diagnosed",
  "consistent with",
  "likely",
  "suspect",
  "suspected",
  "stable for",
  "outpatient",
  "no evidence",
  "most consistent",
];

const MEDICATION_MARKERS = [
  "mg",
  "ml",
  "tablet",
  "capsule",
  "dose",
  "dosing",
  "medication",
  "medicine",
  "po",
  "sc",
  "im",
  "iv",
  "milpro",
  "spectra",
  "worming",
  "dewormer",
  "flea",
  "tick",
];

const DECISION_MARKERS = [
  "agreed",
  "decided",
  "discussed",
  "discussion",
  "opted",
  "preferred",
  "preference",
  "trial",
  "switch",
  "switched",
  "continue",
  "continued",
  "start",
  "started",
  "stop",
  "stopped",
  "hold",
  "declined",
  "choose",
  "chose",
  "prefers",
  "prefer",
  "wanted",
  "wants",
];

const DIRECT_TREATMENT_MARKERS = [
  "give",
  "given",
  "administer",
  "administered",
  "start",
  "started",
  "continue",
  "continued",
  "dispense",
  "dispensed",
  "switch",
  "switched",
  "trial",
  "feed",
  "fed",
  "apply",
  "applied",
  "use",
  "used",
  "test",
  "sample",
  "email",
  "order",
];

const IGNORED_TOKENS = new Set([
  "about",
  "after",
  "also",
  "been",
  "before",
  "from",
  "has",
  "have",
  "having",
  "hers",
  "him",
  "his",
  "into",
  "its",
  "just",
  "made",
  "more",
  "none",
  "only",
  "over",
  "owner",
  "reports",
  "since",
  "than",
  "that",
  "then",
  "they",
  "this",
  "those",
  "their",
  "there",
  "these",
  "today",
  "very",
  "wanting",
  "well",
  "were",
  "with",
  "would",
  "yesterday",
]);

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeEvidence = (value: string): string => {
  const words = normalize(value).split(" ").filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= 24) return words.join(" ");
  return words.slice(0, 24).join(" ");
};

const compact = (value: string): string => value.replace(/\s+/g, " ").trim();

const isPlaceholderValue = (value: string): boolean => {
  const normalized = compact(value).toLowerCase().replace(/[.\s]+/g, " ").trim();
  if (!normalized) return true;
  return [
    "n a",
    "na",
    "n/a",
    "null",
    "none",
    "not available",
    "not documented",
    "not recorded",
    "not mentioned",
    "not provided",
    "not stated",
    "no data",
    "no details",
    "unknown",
  ].includes(normalized);
};

const capitaliseSentence = (value: string): string =>
  value.replace(/^[a-z]/, (match) => match.toUpperCase());

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const meaningfulTokens = (value: string): string[] =>
  normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !IGNORED_TOKENS.has(token));

const hasTimingOrQuantity = (value: string): boolean =>
  /\b\d+(?::\d{2})?\b|\b(?:today|tomorrow|overnight|next|this|am|pm|q\d+h|x\d+|daily|once|twice|hours?|days?|weeks?|months?|minutes?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/iu.test(
    value,
  );

const hasCurrentClinicalSignal = (value: string): boolean =>
  /\b(?:vomit|diarr|stool|mucus|blood|appetite|drinking|quiet|letharg|pain|urgency|strain|cough|sneez|pee|urinary|weight|dehydrat|dose|med|tablet|paste|food|diet|itch|lick|bleed|rash|skin|ear|eye)\w*\b/iu.test(
    value,
  );

const hasPrimaryComplaintSignal = (value: string): boolean =>
  /\b(?:vomit|diarr|loose stool|itch|bleed|pain|cough|sneez|lame|lameness|seiz|letharg|off food|reduced appetite|appetite|drinking|urinary)\w*\b/iu.test(
    value,
  );

const hasDietOrFeedingSignal = (value: string): boolean =>
  /\b(?:food|diet|feeding|fed|eating|eat|appetite|cat food|dog food|treats?|royal canin|purina|gastrointestinal|gi food|complete food)\b/iu.test(
    value,
  );

const hasWellnessOrPreventiveSignal = (value: string): boolean =>
  /\b(?:check up|checkup|general check|wellness|baseline|blood test|blood work|general profile|screening|peace of mind|email|results|worming|deworm|milpro|spectra|flea|tick|estimate|price|cost)\b/iu.test(
    value,
  );

const hasPriorEpisodeSignal = (value: string): boolean =>
  /\b(?:same thing|similar episode|previous episode|2-3 months ago|3-4 months ago|iv overnight|hospitali[sz]ed|put on an iv|had this before)\b/iu.test(
    value,
  );

const sourceWordCount = (value: string): number =>
  normalize(value).split(" ").filter(Boolean).length;

const NUMBER_WORD_MAP: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

const TITLE_CASE_WORDS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const emptySections = (): Record<GeneralSection, GroundingItem[]> => ({
  SUBJECTIVE: [],
  OBJECTIVE: [],
  ASSESSMENT: [],
  PLAN: [],
});

const parseItem = (candidate: unknown): GroundingItem | null => {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  const text = compact(String(row.text ?? ""));
  const evidence = compact(String(row.evidence ?? ""));
  if (!text || !evidence) return null;
  if (isPlaceholderValue(text) || isPlaceholderValue(evidence)) return null;
  return { text, evidence };
};

export const parseGeneralConsultGroundingPayload = (
  raw: string,
): GeneralConsultGroundingPayload | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const complexity = parsed.complexity === "complex" ? "complex" : "routine";
    const sections = emptySections();
    const parsedSections =
      parsed.sections && typeof parsed.sections === "object"
        ? parsed.sections as Record<string, unknown>
        : {};

    for (const section of SECTION_ORDER) {
      sections[section] = toArray(parsedSections[section])
        .map(parseItem)
        .filter((item): item is GroundingItem => !!item);
    }

    return { complexity, sections };
  } catch {
    return null;
  }
};

const isItemGrounded = (item: GroundingItem, sourceText: string): boolean => {
  const source = normalize(sourceText);
  const evidence = normalizeEvidence(item.evidence);
  if (!source || !evidence) return false;
  if (evidence.length < 8) return false;
  return source.includes(evidence);
};

const overlapScore = (left: string, right: string): number => {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
};

const hasMarker = (value: string, markers: string[]): boolean => {
  const normalized = normalize(value);
  return markers.some((marker) => {
    const normalizedMarker = normalize(marker);
    if (!normalizedMarker) return false;
    return new RegExp(`\\b${escapeRegex(normalizedMarker)}\\b`, "u").test(normalized);
  });
};

const hasHistoricalTiming = (value: string): boolean =>
  /\b(?:\d+\s+)?(?:year|years|month|months|week|weeks)\s+ago\b|\blast year\b|\bpreviously\b|\bhistory of\b|\bprior\b|\bresolved\b|\bused to\b/u.test(
    normalize(value),
  );

const hasCurrentVisitTiming = (value: string): boolean =>
  /\btoday\b|\byesterday\b|\bthis morning\b|\bovernight\b|\bcurrent\b|\bcurrently\b|\bnow\b|\bthis week\b/u.test(
    normalize(value),
  );

const sharesMeaningfulToken = (left: string, right: string): boolean => {
  const leftTokens = new Set(meaningfulTokens(left));
  if (leftTokens.size === 0) return false;
  return meaningfulTokens(right).some((token) => leftTokens.has(token));
};

const meaningfulOverlapScore = (left: string, right: string): number => {
  const leftTokens = new Set(meaningfulTokens(left));
  const rightTokens = new Set(meaningfulTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
};

const buildFocusTerms = (payload: GeneralConsultGroundingPayload): Set<string> => {
  const focus = new Set<string>();
  const addTokens = (value: string) => {
    for (const token of meaningfulTokens(value)) {
      if (token.length >= 4) focus.add(token);
    }
  };

  for (const item of payload.sections.SUBJECTIVE) {
    if (!hasHistoricalTiming(item.text) || hasCurrentVisitTiming(item.text)) {
      addTokens(item.text);
      addTokens(item.evidence);
    }
  }

  for (const item of payload.sections.ASSESSMENT) {
    addTokens(item.text);
    addTokens(item.evidence);
  }

  for (const item of payload.sections.PLAN) {
    if (hasMarker(item.evidence, PLAN_MARKERS) || hasMarker(item.text, PLAN_MARKERS)) {
      addTokens(item.text);
      addTokens(item.evidence);
    }
  }

  return focus;
};

const overlapsFocusTerms = (value: string, focusTerms: Set<string>): boolean => {
  if (focusTerms.size === 0) return true;
  return meaningfulTokens(value).some((token) => focusTerms.has(token));
};

const itemTextSupportedByEvidence = (item: GroundingItem): boolean => {
  const overlap = meaningfulOverlapScore(item.text, item.evidence);
  if (overlap >= MIN_TEXT_EVIDENCE_OVERLAP) return true;
  if (sharesMeaningfulToken(item.text, item.evidence)) return true;
  return false;
};

const isRelevantSubjectiveItem = (
  item: GroundingItem,
  focusTerms: Set<string>,
): boolean => {
  const combined = `${item.text} ${item.evidence}`;
  const historicalOnly = hasHistoricalTiming(combined) && !hasCurrentVisitTiming(combined);
  if (!historicalOnly) return true;
  if (hasMarker(combined, MEDICATION_MARKERS)) return true;
  return overlapsFocusTerms(combined, focusTerms);
};

const isSupportedAssessmentItem = (item: GroundingItem): boolean =>
  hasMarker(item.evidence, ASSESSMENT_MARKERS) ||
  itemTextSupportedByEvidence(item);

const isSupportedPlanItem = (
  item: GroundingItem,
  isShortConsult: boolean,
): boolean => {
  const strongEvidenceAlignment = meaningfulOverlapScore(item.text, item.evidence) >= 0.34;
  const hasExplicitPlanSignal =
    hasMarker(item.evidence, PLAN_MARKERS) ||
    strongEvidenceAlignment;

  if (!hasExplicitPlanSignal) return false;
  if (!isShortConsult) return true;

  return hasMarker(item.evidence, PLAN_MARKERS) || strongEvidenceAlignment;
};

const resolveMaxItemsBySection = (sourceText: string): Record<GeneralSection, number> =>
  sourceWordCount(sourceText) >= LONG_SOURCE_WORD_THRESHOLD
    ? LONG_SOURCE_MAX_ITEMS_BY_SECTION
    : DEFAULT_MAX_ITEMS_BY_SECTION;

const areNearDuplicates = (left: GroundingItem, right: GroundingItem): boolean => {
  const leftText = normalize(left.text);
  const rightText = normalize(right.text);
  if (!leftText || !rightText) return false;
  if (leftText === rightText) return true;

  const shorterWordCount = Math.min(leftText.split(" ").length, rightText.split(" ").length);
  if (shorterWordCount >= 6 && (leftText.includes(rightText) || rightText.includes(leftText))) {
    return true;
  }

  const leftEvidence = normalizeEvidence(left.evidence);
  const rightEvidence = normalizeEvidence(right.evidence);
  if (leftEvidence && rightEvidence && leftEvidence === rightEvidence) return true;

  if (overlapScore(leftText, rightText) >= 0.82) return true;
  if (leftEvidence && rightEvidence && overlapScore(leftEvidence, rightEvidence) >= 0.9) {
    return true;
  }

  return false;
};

const dedupeAndLimit = (
  items: GroundingItem[],
  maxItems: number,
): GroundingItem[] => {
  const output: GroundingItem[] = [];
  for (const item of items) {
    const key = normalize(item.text);
    if (!key) continue;
    if (output.some((existing) => areNearDuplicates(existing, item))) continue;
    output.push({
      text: compact(item.text),
      evidence: compact(item.evidence),
    });
    if (output.length >= maxItems) break;
  }
  return output;
};

const dedupeItems = (items: GroundingItem[]): GroundingItem[] =>
  dedupeAndLimit(items, Number.MAX_SAFE_INTEGER);

const prioritizeAndLimitPreservingOrder = (
  items: GroundingItem[],
  scorer: (item: GroundingItem) => number,
  maxItems: number,
): GroundingItem[] =>
  items
    .map((item, index) => ({ item, index, score: scorer(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxItems)
    .sort((left, right) => left.index - right.index)
    .map(({ item }) => item);

const scoreSubjectiveItem = (item: GroundingItem): number => {
  const combined = `${item.text} ${item.evidence}`;
  let score = 0;
  if (hasCurrentClinicalSignal(combined)) score += 4;
  if (hasPrimaryComplaintSignal(combined)) score += 4;
  if (hasDietOrFeedingSignal(combined)) score += 3;
  if (hasPriorEpisodeSignal(combined)) score += 2;
  if (hasTimingOrQuantity(combined)) score += 3;
  if (hasMarker(combined, MEDICATION_MARKERS)) score += 1;
  if (hasWellnessOrPreventiveSignal(combined)) score += 3;
  if (/\b(?:no vomiting|no diarrhoea|still drinking|still eating|fussy|struggling to eat|home treatment|probiotic|pro-kolin|buscopan|applaws|royal canin|purina|cat food|dog food|dried fish|treats?)\b/iu.test(combined)) {
    score += 3;
  }
  if (/\b(?:owner|client).{0,24}(?:concern|worried|concerned|reports|reported|states|stated|noticed|noted|asked|mentions|mentioned)|\b(?:concern|worried|concerned|difficulty|struggling|fussy|admin|home treatment|at home|previous episode|same thing before)\b/iu.test(combined)) {
    score += 2;
  }
  if (hasHistoricalTiming(combined) && !hasCurrentVisitTiming(combined)) score -= 2;
  return score;
};

const scorePlanItem = (item: GroundingItem): number => {
  const combined = `${item.text} ${item.evidence}`;
  let score = 0;
  if (hasMarker(combined, MEDICATION_MARKERS)) score += 6;
  if (hasTimingOrQuantity(combined)) score += 4;
  if (hasMarker(combined, DIRECT_TREATMENT_MARKERS)) score += 3;
  if (/\b(?:blood test|blood work|general profile|screening|sample|results?|monday|email|estimate|cost|price|£|milpro|spectra|worming|flea|tick|parasite)\b/iu.test(combined)) {
    score += 5;
  }
  if (/\b(?:recheck|follow ?up|call|book|schedule|review|return|48\s*h|24\s*h|15:30|tomorrow|today)\b/iu.test(combined)) {
    score += 4;
  }
  if (/\b(?:royal canin|purina|buscopan|pro-kolin|maropitant|omeprazole|paste|tablet|food|diet|transition|mix|50%|gastrointestinal|gi)\b/iu.test(combined)) {
    score += 4;
  }
  if (/\b(?:monitor|red flags?|worsen|if no improvement|if still)\b/iu.test(combined)) {
    score += 2;
  }
  if (hasMarker(combined, DECISION_MARKERS)) score += 3;
  if (hasMarker(combined, PLAN_MARKERS)) score += 1;
  return score;
};

export const filterGroundedGeneralConsultPayload = (
  payload: GeneralConsultGroundingPayload,
  sourceText: string,
): GeneralConsultGroundingPayload => {
  const next: GeneralConsultGroundingPayload = {
    complexity: payload.complexity,
    sections: emptySections(),
  };
  const maxItemsBySection = resolveMaxItemsBySection(sourceText);
  const isShortConsult = sourceWordCount(sourceText) <= SHORT_CONSULT_WORD_THRESHOLD;

  for (const section of SECTION_ORDER) {
    const grounded = payload.sections[section].filter((item) =>
      isItemGrounded(item, sourceText)
    );
    next.sections[section] = dedupeItems(grounded);
  }

  const focusTerms = buildFocusTerms(next);

  next.sections.SUBJECTIVE = next.sections.SUBJECTIVE.filter((item) =>
    isRelevantSubjectiveItem(item, focusTerms)
  );
  next.sections.ASSESSMENT = next.sections.ASSESSMENT.filter(isSupportedAssessmentItem);
  next.sections.PLAN = next.sections.PLAN.filter((item) =>
    isSupportedPlanItem(item, isShortConsult)
  );

  next.sections.SUBJECTIVE = prioritizeAndLimitPreservingOrder(
    next.sections.SUBJECTIVE,
    scoreSubjectiveItem,
    maxItemsBySection.SUBJECTIVE,
  );
  next.sections.PLAN = prioritizeAndLimitPreservingOrder(
    next.sections.PLAN,
    scorePlanItem,
    maxItemsBySection.PLAN,
  );

  for (const section of SECTION_ORDER) {
    if (section === "SUBJECTIVE" || section === "PLAN") {
      next.sections[section] = dedupeItems(next.sections[section]);
      continue;
    }
    next.sections[section] = dedupeAndLimit(next.sections[section], maxItemsBySection[section]);
  }

  return next;
};

export const mergeGeneralConsultGroundingPayloads = (
  payloads: GeneralConsultGroundingPayload[],
): GeneralConsultGroundingPayload => {
  const merged: GeneralConsultGroundingPayload = {
    complexity: payloads.some((payload) => payload.complexity === "complex")
      ? "complex"
      : "routine",
    sections: emptySections(),
  };

  for (const payload of payloads) {
    for (const section of SECTION_ORDER) {
      merged.sections[section].push(...payload.sections[section]);
    }
  }

  return merged;
};

const sectionHasContent = (items: GroundingItem[]): boolean => items.length > 0;

const trimToWordBudget = (text: string, maxWords: number): string => {
  const tokens = text.match(/\S+|\s+/g) ?? [];
  let wordCount = 0;
  let output = "";

  for (const token of tokens) {
    if (/\S/.test(token)) {
      if (wordCount >= maxWords) {
        const trimmed = output.trim();
        const lastBoundary = Math.max(
          trimmed.lastIndexOf(";"),
          trimmed.lastIndexOf("."),
          trimmed.lastIndexOf("\n"),
        );
        if (lastBoundary >= 0 && lastBoundary >= trimmed.length - 120) {
          return trimmed.slice(0, lastBoundary + 1).trim();
        }
        return `${trimmed}...`;
      }
      wordCount += 1;
    }
    output += token;
  }

  return output.trim();
};

const getSectionWordBudget = (
  section: GeneralSection,
  complexity: "routine" | "complex",
  isLongSource: boolean,
  sectionCount: number,
): number => {
  const routineBudgets: Record<GeneralSection, number> = isLongSource
      ? {
        SUBJECTIVE: 110,
        OBJECTIVE: 36,
        ASSESSMENT: 18,
        PLAN: 120,
      }
    : {
        SUBJECTIVE: 96,
        OBJECTIVE: 40,
        ASSESSMENT: 20,
        PLAN: 104,
      };

  const complexBudgets: Record<GeneralSection, number> = isLongSource
    ? {
        SUBJECTIVE: 118,
        OBJECTIVE: 42,
        ASSESSMENT: 24,
        PLAN: 132,
      }
    : {
        SUBJECTIVE: 104,
        OBJECTIVE: 46,
        ASSESSMENT: 26,
        PLAN: 120,
      };

  const base = (complexity === "complex" ? complexBudgets : routineBudgets)[section];
  if (sectionCount <= 2 && (section === "SUBJECTIVE" || section === "PLAN")) {
    return base + (section === "SUBJECTIVE" ? 34 : 28);
  }
  return base;
};

const renderSectionBody = (items: GroundingItem[]): string => {
  const replaceNumberWords = (value: string): string =>
    value.replace(
      /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
      (match) => NUMBER_WORD_MAP[match.toLowerCase()] ?? match,
    );

  const titleCaseTimingWords = (value: string): string =>
    value.replace(/\b([a-z]+)\b/gi, (match) =>
      TITLE_CASE_WORDS.has(match.toLowerCase())
        ? `${match.charAt(0).toUpperCase()}${match.slice(1).toLowerCase()}`
        : match
    );

  const condenseClinicalText = (value: string): string =>
    titleCaseTimingWords(replaceNumberWords(value))
      .replace(/\bhalf and half\b/gi, "50%/50%")
      .replace(/\bhalf\b/gi, "1/2")
      .replace(/\bquarter\b/gi, "1/4")
      .replace(/\bonce\b/gi, "1x")
      .replace(/\btwice\b/gi, "2x")
      .replace(/\b(\d+)\s+times?\b/gi, "$1x")
      .replace(/\b(\d+)\s*(?:or|to)\s*(\d+)\s*days?\b/gi, "$1-$2d")
      .replace(/\b(\d+)\s*(?:or|to)\s*(\d+)\s*weeks?\b/gi, "$1-$2wk")
      .replace(/\b(\d+)\s*(?:or|to)\s*(\d+)\s*months?\b/gi, "$1-$2mo")
      .replace(/\b(\d+)\s*(?:or|to)\s*(\d+)\s*hours?\b/gi, "$1-$2h")
      .replace(/\bevery\s+(\d+)\s*hours?\b/gi, "q$1h")
      .replace(/\bevery\s+(\d+)\s*days?\b/gi, "q$1d")
      .replace(/\b(\d+)\s*(?:percent|per cent)\b/gi, "$1%")
      .replace(/\bowner\b/gi, "O")
      .replace(/\bapproximately\b/gi, "approx")
      .replace(/\b(\d+)\s*days?\b/gi, "$1d")
      .replace(/\b(\d+)\s*weeks?\b/gi, "$1wk")
      .replace(/\b(\d+)\s*months?\b/gi, "$1mo")
      .replace(/\b(\d+)\s*hours?\b/gi, "$1h")
      .replace(/\bby mouth\b/gi, "PO")
      .replace(/\bsubcutaneous\b/gi, "SC")
      .replace(/\bintramuscular\b/gi, "IM")
      .replace(/\bintravenous\b/gi, "IV")
      .replace(/\s+/g, " ")
      .trim();

  const fragments = items
    .map((item) => compact(item.text).replace(/\s*[.;]+\s*$/g, "").trim())
    .filter(Boolean);
  if (fragments.length === 0) return "";
  const rendered = fragments
    .flatMap((fragment) =>
      fragment
        .split(/\s*;\s*|\s+[-–—]\s+/)
        .map((part) => compact(part).replace(/\s*[.;]+\s*$/g, "").trim())
        .filter(Boolean)
        .map(capitaliseSentence),
    )
    .join(". ");
  const condensed = condenseClinicalText(rendered)
    .trim();
  if (!condensed) return "";
  return /[.!?]$/.test(condensed) ? condensed : `${condensed}.`;
};

export const renderGeneralConsultFromGroundedPayload = (
  payload: GeneralConsultGroundingPayload,
  sourceText = "",
): string => {
  const blocks: string[] = [];
  const isLongSource = sourceText ? sourceWordCount(sourceText) >= LONG_SOURCE_WORD_THRESHOLD : false;
  const sectionCount = SECTION_ORDER.filter((section) => sectionHasContent(payload.sections[section])).length;

  for (const section of SECTION_ORDER) {
    const items = payload.sections[section];
    if (!sectionHasContent(items)) continue;
    const renderedBody = renderSectionBody(items);
    const body = trimToWordBudget(
      renderedBody,
      getSectionWordBudget(section, payload.complexity, isLongSource, sectionCount),
    );
    if (!body) continue;
    blocks.push(`${section}:\n${body}`);
  }

  if (blocks.length === 0) {
    return "";
  }

  const joined = blocks.join("\n\n").trim();
  const maxWords = payload.complexity === "complex"
    ? (isLongSource ? 340 : 380)
    : (isLongSource ? 310 : 330);
  const sparseSectionBonus = sectionCount <= 2 ? 55 : 0;
  return trimToWordBudget(joined, maxWords + sparseSectionBonus);
};

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
  SUBJECTIVE: 4,
  OBJECTIVE: 4,
  ASSESSMENT: 1,
  PLAN: 4,
};

const LONG_SOURCE_MAX_ITEMS_BY_SECTION: Record<GeneralSection, number> = {
  SUBJECTIVE: 5,
  OBJECTIVE: 4,
  ASSESSMENT: 1,
  PLAN: 5,
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
  /\b\d+(?::\d{2})?\b|\b(?:today|tomorrow|overnight|am|pm|q\d+h|x\d+|daily|once|twice|hours?|days?|weeks?|months?|minutes?)\b/iu.test(
    value,
  );

const hasCurrentClinicalSignal = (value: string): boolean =>
  /\b(?:vomit|diarr|stool|mucus|blood|appetite|drinking|quiet|letharg|pain|urgency|strain|cough|sneez|pee|urinary|weight|dehydrat|dose|med|tablet|paste|food|diet)\w*\b/iu.test(
    value,
  );

const sourceWordCount = (value: string): number =>
  normalize(value).split(" ").filter(Boolean).length;

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

const sortByPriority = (
  items: GroundingItem[],
  scorer: (item: GroundingItem) => number,
): GroundingItem[] =>
  items
    .map((item, index) => ({ item, index, score: scorer(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);

const scoreSubjectiveItem = (item: GroundingItem): number => {
  const combined = `${item.text} ${item.evidence}`;
  let score = 0;
  if (hasCurrentClinicalSignal(combined)) score += 3;
  if (hasTimingOrQuantity(combined)) score += 3;
  if (hasMarker(combined, MEDICATION_MARKERS)) score += 2;
  if (/\b(?:owner concern|worried|concerned|difficulty|struggling|fussy|admin)\b/iu.test(combined)) {
    score += 1;
  }
  if (hasHistoricalTiming(combined) && !hasCurrentVisitTiming(combined)) score -= 3;
  return score;
};

const scorePlanItem = (item: GroundingItem): number => {
  const combined = `${item.text} ${item.evidence}`;
  let score = 0;
  if (hasMarker(combined, MEDICATION_MARKERS)) score += 4;
  if (hasTimingOrQuantity(combined)) score += 3;
  if (/\b(?:recheck|follow ?up|call|book|schedule|review|return|48\s*h|24\s*h|15:30|tomorrow|today)\b/iu.test(combined)) {
    score += 3;
  }
  if (/\b(?:monitor|red flags?|worsen|if no improvement|if still)\b/iu.test(combined)) {
    score += 2;
  }
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
    next.sections[section] = dedupeAndLimit(grounded, maxItemsBySection[section]);
  }

  const focusTerms = buildFocusTerms(next);

  next.sections.SUBJECTIVE = next.sections.SUBJECTIVE.filter((item) =>
    isRelevantSubjectiveItem(item, focusTerms)
  );
  next.sections.ASSESSMENT = next.sections.ASSESSMENT.filter(isSupportedAssessmentItem);
  next.sections.PLAN = next.sections.PLAN.filter((item) =>
    isSupportedPlanItem(item, isShortConsult)
  );

  next.sections.SUBJECTIVE = sortByPriority(next.sections.SUBJECTIVE, scoreSubjectiveItem);
  next.sections.PLAN = sortByPriority(next.sections.PLAN, scorePlanItem);

  for (const section of SECTION_ORDER) {
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
): number => {
  const routineBudgets: Record<GeneralSection, number> = isLongSource
    ? {
        SUBJECTIVE: 56,
        OBJECTIVE: 34,
        ASSESSMENT: 18,
        PLAN: 68,
      }
    : {
        SUBJECTIVE: 54,
        OBJECTIVE: 38,
        ASSESSMENT: 20,
        PLAN: 62,
      };

  const complexBudgets: Record<GeneralSection, number> = isLongSource
    ? {
        SUBJECTIVE: 55,
        OBJECTIVE: 42,
        ASSESSMENT: 24,
        PLAN: 55,
      }
    : {
        SUBJECTIVE: 62,
        OBJECTIVE: 46,
        ASSESSMENT: 26,
        PLAN: 62,
      };

  return (complexity === "complex" ? complexBudgets : routineBudgets)[section];
};

const renderSectionBody = (items: GroundingItem[]): string => {
  const condenseClinicalText = (value: string): string =>
    value
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

  for (const section of SECTION_ORDER) {
    const items = payload.sections[section];
    if (!sectionHasContent(items)) continue;
    const renderedBody = renderSectionBody(items);
    const body = trimToWordBudget(
      renderedBody,
      getSectionWordBudget(section, payload.complexity, isLongSource),
    );
    if (!body) continue;
    blocks.push(`${section}:\n${body}`);
  }

  if (blocks.length === 0) {
    return "";
  }

  const joined = blocks.join("\n\n").trim();
  const maxWords = payload.complexity === "complex"
    ? (isLongSource ? 210 : 240)
    : (isLongSource ? 185 : 195);
  return trimToWordBudget(joined, maxWords);
};

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

const MAX_ITEMS_BY_SECTION: Record<GeneralSection, number> = {
  SUBJECTIVE: 6,
  OBJECTIVE: 5,
  ASSESSMENT: 2,
  PLAN: 6,
};

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

export const filterGroundedGeneralConsultPayload = (
  payload: GeneralConsultGroundingPayload,
  sourceText: string,
): GeneralConsultGroundingPayload => {
  const next: GeneralConsultGroundingPayload = {
    complexity: payload.complexity,
    sections: emptySections(),
  };

  for (const section of SECTION_ORDER) {
    const grounded = payload.sections[section].filter((item) =>
      isItemGrounded(item, sourceText)
    );
    next.sections[section] = dedupeAndLimit(grounded, MAX_ITEMS_BY_SECTION[section]);
  }

  return next;
};

const sectionHasContent = (items: GroundingItem[]): boolean => items.length > 0;

const trimToWordBudget = (text: string, maxWords: number): string => {
  const tokens = text.match(/\S+|\s+/g) ?? [];
  let wordCount = 0;
  let output = "";

  for (const token of tokens) {
    if (/\S/.test(token)) {
      if (wordCount >= maxWords) {
        return `${output.trim()}...`;
      }
      wordCount += 1;
    }
    output += token;
  }

  return output.trim();
};

const renderSectionBody = (items: GroundingItem[]): string => {
  const fragments = items
    .map((item) => compact(item.text).replace(/\s*[.;]+\s*$/g, "").trim())
    .filter(Boolean);
  if (fragments.length === 0) return "";
  const rendered = fragments.join("; ").trim();
  if (!rendered) return "";
  return /[.!?]$/.test(rendered) ? rendered : `${rendered}.`;
};

export const renderGeneralConsultFromGroundedPayload = (
  payload: GeneralConsultGroundingPayload,
): string => {
  const blocks: string[] = [];

  for (const section of SECTION_ORDER) {
    const items = payload.sections[section];
    if (!sectionHasContent(items)) continue;
    const body = renderSectionBody(items);
    if (!body) continue;
    blocks.push(`${section}:\n${body}`);
  }

  if (blocks.length === 0) {
    return "";
  }

  const joined = blocks.join("\n\n").trim();
  const maxWords = payload.complexity === "complex" ? 400 : 260;
  return trimToWordBudget(joined, maxWords);
};

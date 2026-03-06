export type GeneralSection =
  | "TREATMENT"
  | "OBJECTIVE"
  | "ASSESSMENT"
  | "PLAN"
  | "COMMUNICATION";

export interface GroundingItem {
  text: string;
  evidence: string;
}

export interface GeneralConsultGroundingPayload {
  complexity: "routine" | "complex";
  sections: Record<GeneralSection, GroundingItem[]>;
}

const SECTION_ORDER: GeneralSection[] = [
  "TREATMENT",
  "OBJECTIVE",
  "ASSESSMENT",
  "PLAN",
  "COMMUNICATION",
];

const BULLET_SECTIONS = new Set<GeneralSection>([
  "TREATMENT",
  "OBJECTIVE",
  "COMMUNICATION",
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

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const emptySections = (): Record<GeneralSection, GroundingItem[]> => ({
  TREATMENT: [],
  OBJECTIVE: [],
  ASSESSMENT: [],
  PLAN: [],
  COMMUNICATION: [],
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

const dedupeAndLimit = (
  items: GroundingItem[],
  maxItems: number,
): GroundingItem[] => {
  const seen = new Set<string>();
  const output: GroundingItem[] = [];
  for (const item of items) {
    const key = normalize(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
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
    const maxItems = BULLET_SECTIONS.has(section) ? 3 : 2;
    next.sections[section] = dedupeAndLimit(grounded, maxItems);
  }

  return next;
};

const sectionHasContent = (items: GroundingItem[]): boolean => items.length > 0;

const trimToWordBudget = (text: string, maxWords: number): string => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ").trim()}...`;
};

export const renderGeneralConsultFromGroundedPayload = (
  payload: GeneralConsultGroundingPayload,
): string => {
  const blocks: string[] = [];

  for (const section of SECTION_ORDER) {
    const items = payload.sections[section];
    if (!sectionHasContent(items)) continue;

    if (BULLET_SECTIONS.has(section)) {
      blocks.push(
        `${section}:\n${items.map((item) => `- ${item.text}`).join("\n")}`,
      );
      continue;
    }

    blocks.push(`${section}:\n${items.map((item) => item.text).join(" ")}`);
  }

  if (blocks.length === 0) {
    return "TREATMENT:\n- No explicit clinically relevant details stated in source.";
  }

  const joined = blocks.join("\n\n").trim();
  const maxWords = payload.complexity === "complex" ? 400 : 220;
  return trimToWordBudget(joined, maxWords);
};


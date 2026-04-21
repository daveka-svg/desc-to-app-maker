const SECTION_LABELS = [
  "Consultation transcript",
  "Clinic personalization context",
  "Additional context",
  "Physical examination",
  "Vet notes",
] as const;

type SectionLabel = typeof SECTION_LABELS[number];

export interface ParsedNoteSource {
  consultationTranscript: string;
  clinicPersonalizationContext: string;
  additionalContext: string;
  physicalExamination: string;
  vetNotes: string;
}

export const LONG_NOTE_TRIGGER_CHARS = 28000;
export const LONG_NOTE_CHUNK_CHARS = 18000;
export const LONG_NOTE_MAX_CHUNKS = 8;

const normalizeNewlines = (value: string): string => value.replace(/\r\n/g, "\n");

const isSectionHeader = (value: string): value is `${SectionLabel}:` =>
  SECTION_LABELS.some((label) => `${label}:` === value.trim());

const splitLongLine = (line: string, maxChars: number): string[] => {
  const text = line.trim();
  if (text.length <= maxChars) return [text];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length > maxChars && current) {
        chunks.push(current);
        if (sentence.length > maxChars) {
          chunks.push(...splitLongLine(sentence, maxChars));
          current = "";
        } else {
          current = sentence;
        }
      } else if (candidate.length > maxChars) {
        chunks.push(...splitLongLine(sentence, maxChars));
        current = "";
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + maxChars).trim());
    offset += maxChars;
  }
  return chunks.filter(Boolean);
};

export const parseNoteSource = (raw: string): ParsedNoteSource => {
  const normalized = normalizeNewlines(String(raw || "")).trim();
  if (!normalized) {
    return {
      consultationTranscript: "",
      clinicPersonalizationContext: "",
      additionalContext: "",
      physicalExamination: "",
      vetNotes: "",
    };
  }

  const lines = normalized.split("\n");
  const foundHeaders = lines.some((line) => isSectionHeader(line.trim()));

  if (!foundHeaders) {
    return {
      consultationTranscript: normalized,
      clinicPersonalizationContext: "",
      additionalContext: "",
      physicalExamination: "",
      vetNotes: "",
    };
  }

  const sections: Record<SectionLabel, string[]> = {
    "Consultation transcript": [],
    "Clinic personalization context": [],
    "Additional context": [],
    "Physical examination": [],
    "Vet notes": [],
  };

  let currentSection: SectionLabel | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (isSectionHeader(trimmed)) {
      currentSection = trimmed.slice(0, -1) as SectionLabel;
      continue;
    }
    if (!currentSection) {
      sections["Consultation transcript"].push(line);
      continue;
    }
    sections[currentSection].push(line);
  }

  return {
    consultationTranscript: sections["Consultation transcript"].join("\n").trim(),
    clinicPersonalizationContext: sections["Clinic personalization context"].join("\n").trim(),
    additionalContext: sections["Additional context"].join("\n").trim(),
    physicalExamination: sections["Physical examination"].join("\n").trim(),
    vetNotes: sections["Vet notes"].join("\n").trim(),
  };
};

export const buildNoteSource = (parsed: ParsedNoteSource): string => {
  const parts: string[] = [];
  if (parsed.consultationTranscript.trim()) {
    parts.push(`Consultation transcript:\n${parsed.consultationTranscript.trim()}`);
  }
  if (parsed.clinicPersonalizationContext.trim()) {
    parts.push(`Clinic personalization context:\n${parsed.clinicPersonalizationContext.trim()}`);
  }
  if (parsed.additionalContext.trim()) {
    parts.push(`Additional context:\n${parsed.additionalContext.trim()}`);
  }
  if (parsed.physicalExamination.trim()) {
    parts.push(`Physical examination:\n${parsed.physicalExamination.trim()}`);
  }
  if (parsed.vetNotes.trim()) {
    parts.push(`Vet notes:\n${parsed.vetNotes.trim()}`);
  }
  return parts.join("\n\n").trim();
};

export const splitTranscriptIntoChunks = (
  transcript: string,
  chunkChars = LONG_NOTE_CHUNK_CHARS,
): string[] => {
  const normalized = normalizeNewlines(transcript).trim();
  if (!normalized) return [];
  if (normalized.length <= chunkChars) return [normalized];

  const rawUnits = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const units = rawUnits.flatMap((line) => splitLongLine(line, chunkChars));

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const unit of units) {
    const addition = (current.length > 0 ? 1 : 0) + unit.length;
    if (current.length > 0 && currentLength + addition > chunkChars) {
      chunks.push(current.join("\n").trim());
      current = [unit];
      currentLength = unit.length;
      continue;
    }
    current.push(unit);
    currentLength += addition;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n").trim());
  }

  if (chunks.length <= LONG_NOTE_MAX_CHUNKS) return chunks;

  const adaptiveChunkChars = Math.ceil(normalized.length / LONG_NOTE_MAX_CHUNKS) + 500;
  if (adaptiveChunkChars <= chunkChars) return chunks;
  return splitTranscriptIntoChunks(normalized, adaptiveChunkChars);
};

export const shouldChunkNoteTranscript = (transcript: string): boolean =>
  normalizeNewlines(transcript).trim().length > LONG_NOTE_TRIGGER_CHARS;

export const buildChunkedNoteSources = (sourceText: string): ParsedNoteSource[] => {
  const parsed = parseNoteSource(sourceText);
  const chunks = splitTranscriptIntoChunks(parsed.consultationTranscript);
  if (chunks.length <= 1) return [parsed];

  return chunks.map((chunk) => ({
    ...parsed,
    consultationTranscript: chunk,
  }));
};

export const buildStaticNoteContext = (parsed: ParsedNoteSource): string =>
  buildNoteSource({
    consultationTranscript: "",
    clinicPersonalizationContext: parsed.clinicPersonalizationContext,
    additionalContext: parsed.additionalContext,
    physicalExamination: parsed.physicalExamination,
    vetNotes: parsed.vetNotes,
  });

export const buildGeneralConsultSource = (parsed: ParsedNoteSource): string =>
  buildNoteSource({
    consultationTranscript: parsed.consultationTranscript,
    clinicPersonalizationContext: "",
    additionalContext: parsed.additionalContext,
    physicalExamination: parsed.physicalExamination,
    vetNotes: parsed.vetNotes,
  });

export const buildChunkReductionSystemPrompt = (systemPrompt: string): string => `${systemPrompt}

You are processing one chunk from a longer veterinary consultation.
- Return a concise partial note for this chunk only.
- Use only facts explicitly stated in this chunk or the static context included with it.
- Omit empty sections.
- Do not add introductions, conclusions, placeholders, or markdown fences.
- Do not invent details that are not present in this chunk.`;

export const buildChunkReductionUserPrompt = (
  chunkSource: string,
  chunkIndex: number,
  totalChunks: number,
): string => `This is chunk ${chunkIndex + 1} of ${totalChunks} from one long consultation.

Source:
${chunkSource}

Return only the partial note for this chunk.`;

export const buildFinalChunkMergeSystemPrompt = (systemPrompt: string): string => `${systemPrompt}

You are combining partial notes from multiple chunks of the same veterinary consultation.
- Merge the chunk notes into one final note.
- Deduplicate repeated facts.
- Keep only facts contained in the chunk notes or static context.
- Omit empty sections.
- Do not add markdown fences, filler text, or placeholders.`;

export const buildFinalChunkMergeUserPrompt = (
  staticContext: string,
  partialNotes: string[],
): string => {
  const chunkBlocks = partialNotes
    .map((note, index) => `Chunk ${index + 1} partial note:\n${note.trim()}`)
    .join("\n\n");

  const parts: string[] = [];
  if (staticContext.trim()) {
    parts.push(`Static context:\n${staticContext.trim()}`);
  }
  parts.push(chunkBlocks);
  parts.push("Return the final combined note only.");
  return parts.join("\n\n");
};

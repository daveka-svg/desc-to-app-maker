export async function extractLlmText(raw: unknown): Promise<string> {
  const asString = async (value: unknown): Promise<string> => {
    if (typeof value === 'string') return value;
    if (value instanceof Blob) return value.text();
    return JSON.stringify(value ?? '');
  };

  const text = await asString(raw);

  // SSE payload
  if (text.includes('data: ')) {
    let content = '';
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed?.choices?.[0]?.delta?.content;
        const message = parsed?.choices?.[0]?.message?.content;
        if (typeof delta === 'string') content += delta;
        else if (typeof message === 'string') content += message;
      } catch {
        // ignore malformed chunks
      }
    }
    if (content.trim()) return content.trim();
  }

  // JSON payload
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.content === 'string') return parsed.content.trim();
    if (typeof parsed?.choices?.[0]?.message?.content === 'string') return parsed.choices[0].message.content.trim();
    if (typeof parsed?.choices?.[0]?.delta?.content === 'string') return parsed.choices[0].delta.content.trim();
  } catch {
    // plain text fallback
  }

  return text.trim();
}

const PLACEHOLDER_SENTENCE_RE =
  /^(?:No|None|Not)\b.*\b(?:documented|recorded|provided|discussed|mentioned|available|noted|stated)\b.*$|^No explicit assessment.*$/i;

const stripPlaceholderSentences = (body: string): string => {
  const normalizedBody = body.replace(/\s+/g, ' ').trim();
  if (!normalizedBody) return '';

  const sentences = normalizedBody.match(/[^.!?]+[.!?]?/g) || [];
  const kept = sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !PLACEHOLDER_SENTENCE_RE.test(sentence));

  return kept.join(' ').replace(/\s+/g, ' ').trim();
};

const stripPlaceholderSections = (value: string): string =>
  value
    .replace(
      /(?:^|\n\n)[A-Z][A-Z /()&-]*:?\s+(?:(?:No|None|Not)\b[^\n]*(?:documented|recorded|provided|discussed|mentioned|available|noted|stated)\.?|No explicit assessment documented\.?)(?=\n\n|$)/g,
      '',
    )
    .replace(
      /(?:^|\n\n)[A-Z][A-Z /()&-]*:?\n(?:(?:No|None|Not)\b[^\n]*(?:documented|recorded|provided|discussed|mentioned|available|noted|stated)\.?|No explicit assessment documented\.?)(?=\n\n|$)/g,
      '',
    )
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const headingMatch = block.match(/^([A-Z][A-Z /()&-]*:)\s*([\s\S]*)$/);
      if (!headingMatch) return block;

      const [, heading, rawBody] = headingMatch;
      const cleanedBody = stripPlaceholderSentences(rawBody);
      if (!cleanedBody) return '';
      return `${heading}\n${cleanedBody}`;
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/(?:^|\n\n)[A-Z][A-Z /()&-]*:[ \t]*(?=\n\n|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function sanitizePlainClinicalText(value: string): string {
  const cleaned = value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return stripPlaceholderSections(cleaned);
}

const buildPESection = (peReport: string): string => {
  const body = peReport.replace(/^PE:\s*/i, '').trim();
  return body ? `PE:\n${body}` : '';
};

export function upsertSeparatePESection(note: string, peReport: string): string {
  const peSection = buildPESection(peReport);
  const cleanedNote = sanitizePlainClinicalText(note);
  if (!peSection) return cleanedNote;

  const withoutExistingPE = cleanedNote
    .replace(
      /(?:^|\n\n)(?:PE|P\/E|PHYSICAL EXAMINATION):\n[\s\S]*?(?=\n\n[A-Z][A-Z /()&-]*:|\s*$)/gi,
      '',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!withoutExistingPE) return peSection;

  const blocks = withoutExistingPE
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const objectiveIndex = blocks.findIndex((block) => /^OBJECTIVE:/i.test(block));
  if (objectiveIndex >= 0) {
    blocks.splice(objectiveIndex + 1, 0, peSection);
    return blocks.join('\n\n').trim();
  }

  const subjectiveIndex = blocks.findIndex((block) => /^SUBJECTIVE:/i.test(block));
  if (subjectiveIndex >= 0) {
    blocks.splice(subjectiveIndex + 1, 0, peSection);
    return blocks.join('\n\n').trim();
  }

  const firstClinicalSectionIndex = blocks.findIndex((block) => /^(ASSESSMENT|PLAN):/i.test(block));
  if (firstClinicalSectionIndex >= 0) {
    blocks.splice(firstClinicalSectionIndex, 0, peSection);
    return blocks.join('\n\n').trim();
  }

  blocks.push(peSection);
  return blocks.join('\n\n').trim();
}

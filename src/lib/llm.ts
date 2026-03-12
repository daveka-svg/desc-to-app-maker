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

const stripPlaceholderSections = (value: string): string =>
  value
    .replace(
      /(?:^|\n\n)[A-Z][A-Z /()&-]*:?\s+(?:(?:No|None|Not)\b[^\n]*(?:documented|recorded|provided|discussed|mentioned|available|noted)\.?|No explicit assessment documented\.?)(?=\n\n|$)/g,
      '',
    )
    .replace(
      /(?:^|\n\n)[A-Z][A-Z /()&-]*:?\n(?:(?:No|None|Not)\b[^\n]*(?:documented|recorded|provided|discussed|mentioned|available|noted)\.?|No explicit assessment documented\.?)(?=\n\n|$)/g,
      '',
    )
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

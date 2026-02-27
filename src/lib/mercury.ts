// Mercury AI 2 Client — Primary AI for ETV Scribe
// OpenAI-compatible API at Inception AI

const MERCURY_ENDPOINT = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MERCURY_KEY = 'sk_3588270662ab805f24c94201e16f4188';
const MERCURY_MODEL = 'mercury-2';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MercuryConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

/**
 * Stream a chat completion from Mercury AI 2.
 * Yields text chunks as they arrive.
 */
export async function* streamMercuryChat(
  messages: ChatMessage[],
  config?: MercuryConfig,
): AsyncGenerator<string, void, unknown> {
  const apiKey = config?.apiKey || MERCURY_KEY;
  const endpoint = config?.endpoint || MERCURY_ENDPOINT;
  const model = config?.model || MERCURY_MODEL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Mercury API error ${response.status}: ${errText}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') return;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Incomplete JSON, put it back
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  // Flush remaining
  for (const raw of buffer.split('\n')) {
    if (!raw.startsWith('data: ')) continue;
    const jsonStr = raw.slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) yield content;
    } catch { /* ignore */ }
  }
}

/**
 * Non-streaming chat completion. Returns full response text.
 */
export async function mercuryChat(
  messages: ChatMessage[],
  config?: MercuryConfig,
): Promise<string> {
  const apiKey = config?.apiKey || MERCURY_KEY;
  const endpoint = config?.endpoint || MERCURY_ENDPOINT;
  const model = config?.model || MERCURY_MODEL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Mercury API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

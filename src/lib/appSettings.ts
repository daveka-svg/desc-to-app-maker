export const SETTINGS_STORAGE_KEY = 'etv-scribe-settings';

export type AiGenerationMode = 'mercury-2' | 'openai-chatgpt';

interface AppSettingsSnapshot {
  aiGenerationMode?: AiGenerationMode;
}

export const DEFAULT_AI_GENERATION_MODE: AiGenerationMode = 'mercury-2';

export const AI_GENERATION_OPTIONS: Array<{
  value: AiGenerationMode;
  label: string;
  description: string;
  provider: 'inception' | 'openai';
  model: string;
}> = [
  {
    value: 'mercury-2',
    label: 'Mercury 2',
    description: 'Fast Inception Labs generation.',
    provider: 'inception',
    model: 'mercury-2',
  },
  {
    value: 'openai-chatgpt',
    label: 'ChatGPT latest',
    description: 'OpenAI ChatGPT model (gpt-5.2-chat-latest).',
    provider: 'openai',
    model: 'gpt-5.2-chat-latest',
  },
];

export const loadAppSettingsSnapshot = (): AppSettingsSnapshot => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AppSettingsSnapshot;
  } catch {
    return {};
  }
};

export const getAiGenerationConfig = () => {
  const snapshot = loadAppSettingsSnapshot();
  const selectedMode = snapshot.aiGenerationMode || DEFAULT_AI_GENERATION_MODE;
  return (
    AI_GENERATION_OPTIONS.find((option) => option.value === selectedMode) ||
    AI_GENERATION_OPTIONS[0]
  );
};

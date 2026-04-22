export const SETTINGS_STORAGE_KEY = 'etv-scribe-settings';

export type AiGenerationMode = 'mercury-2' | 'openai-chatgpt';

interface AppSettingsSnapshot {
  aiGenerationMode?: AiGenerationMode;
}

export const DEFAULT_AI_GENERATION_MODE: AiGenerationMode = 'openai-chatgpt';

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
    label: 'ChatGPT 5.2 Pro',
    description: 'OpenAI GPT-5.2 pro model (gpt-5.2-pro).',
    provider: 'openai',
    model: 'gpt-5.2-pro',
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

export const getOpenAiGenerationConfig = () =>
  AI_GENERATION_OPTIONS.find((option) => option.value === 'openai-chatgpt') ||
  AI_GENERATION_OPTIONS[0];

export const getTaskExtractionAiConfig = () => ({
  value: 'openai-task-extraction',
  label: 'ChatGPT 5.4 Nano',
  description: 'Fast, low-cost OpenAI model for task extraction.',
  provider: 'openai' as const,
  model: 'gpt-5.4-nano',
});

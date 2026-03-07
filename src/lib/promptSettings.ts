import { TASK_EXTRACTION_PROMPT } from '@/lib/prompts';

const TASK_PROMPT_STORAGE_KEY = 'etv-task-extraction-prompt';

export const getTaskExtractionPrompt = (): string => {
  if (typeof window === 'undefined') return TASK_EXTRACTION_PROMPT;
  try {
    const stored = localStorage.getItem(TASK_PROMPT_STORAGE_KEY);
    if (!stored) return TASK_EXTRACTION_PROMPT;
    const trimmed = stored.trim();
    return trimmed || TASK_EXTRACTION_PROMPT;
  } catch {
    return TASK_EXTRACTION_PROMPT;
  }
};

export const setTaskExtractionPrompt = (value: string): void => {
  if (typeof window === 'undefined') return;
  const trimmed = value.trim();
  localStorage.setItem(
    TASK_PROMPT_STORAGE_KEY,
    trimmed || TASK_EXTRACTION_PROMPT
  );
};

export const resetTaskExtractionPrompt = (): string => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TASK_PROMPT_STORAGE_KEY);
  }
  return TASK_EXTRACTION_PROMPT;
};

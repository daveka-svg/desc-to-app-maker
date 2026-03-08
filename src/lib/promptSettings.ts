import { TASK_EXTRACTION_PROMPT } from '@/lib/prompts';

const TASK_PROMPT_STORAGE_KEY = 'etv-task-extraction-prompt';
const LEGACY_TASK_EXTRACTION_PROMPTS = new Set([
  `Given the following veterinary clinical notes, extract all action items. For each item, assign it to: "Vet" (clinical decisions, prescriptions, procedures), "Nurse" (sample collection, monitoring, fluid administration), or "Admin" (estimates, insurance, scheduling).

Write each task as a short, plain instruction (ideally under 12 words).
Add an optional "deadline" only if the source explicitly includes a due date/time. Otherwise use null.

Return as JSON:
{
  "prescriptions": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null"}],
  "diagnostics": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null"}],
  "followup": [{"text": "...", "assignee": "Vet", "deadline": "ISO-8601 or null"}],
  "admin": [{"text": "...", "assignee": "Admin", "deadline": "ISO-8601 or null"}]
}
Only include items explicitly mentioned. Do not invent items. Return ONLY valid JSON, no markdown fences.`,
  `Given the consultation transcript and generated notes, extract only explicit action items that were directly requested, assigned, scheduled, or agreed. For each item, assign it to: "Vet" (clinical decisions, prescriptions, procedures), "Nurse" (sample collection, monitoring, fluid administration), or "Admin" (estimates, insurance, scheduling).

Write each task as a short, plain instruction (ideally under 12 words).
Add an optional "deadline" only if the source explicitly includes a due date/time. Otherwise use null.
Every task must include a short direct evidence quote copied from the source text.

Return as JSON:
{
  "prescriptions": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null", "evidence": "..."}],
  "diagnostics": [{"text": "...", "assignee": "Vet|Nurse", "deadline": "ISO-8601 or null", "evidence": "..."}],
  "followup": [{"text": "...", "assignee": "Vet|Nurse|Admin", "deadline": "ISO-8601 or null", "evidence": "..."}],
  "admin": [{"text": "...", "assignee": "Admin", "deadline": "ISO-8601 or null", "evidence": "..."}]
}
Rules:
- Only include items explicitly mentioned in the transcript or notes.
- Do not convert general advice into a task unless someone was clearly asked to do it.
- Do not invent reminders, monitoring steps, or follow-up tasks.
- If no task exists for a category, return [].
- Return ONLY valid JSON, no markdown fences.`,
]);

export const getTaskExtractionPrompt = (): string => {
  if (typeof window === 'undefined') return TASK_EXTRACTION_PROMPT;
  try {
    const stored = localStorage.getItem(TASK_PROMPT_STORAGE_KEY);
    if (!stored) return TASK_EXTRACTION_PROMPT;
    const trimmed = stored.trim();
    if (LEGACY_TASK_EXTRACTION_PROMPTS.has(trimmed)) {
      localStorage.setItem(TASK_PROMPT_STORAGE_KEY, TASK_EXTRACTION_PROMPT);
      return TASK_EXTRACTION_PROMPT;
    }
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

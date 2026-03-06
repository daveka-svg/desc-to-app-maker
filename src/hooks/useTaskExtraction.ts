import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TASK_EXTRACTION_PROMPT } from '@/lib/prompts';
import { useSessionStore, type Task } from '@/stores/useSessionStore';
import { extractLlmText } from '@/lib/llm';
import { buildTaskExtractionInput } from '@/lib/clinicContext';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';

export function useTaskExtraction() {
  const notes = useSessionStore((s) => s.notes);
  const clinicKnowledgeBase = useSessionStore((s) => s.clinicKnowledgeBase);
  const setTasks = useSessionStore((s) => s.setTasks);
  const persistSessionTasks = useSessionStore((s) => s.persistSessionTasks);
  const isExtractingTasks = useSessionStore((s) => s.isExtractingTasks);
  const setIsExtractingTasks = useSessionStore((s) => s.setIsExtractingTasks);

  const extractTasks = useCallback(async () => {
    if (!notes.trim()) throw new Error('No notes to extract tasks from');

    setIsExtractingTasks(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `${TASK_EXTRACTION_PROMPT}\n\n${buildTaskExtractionInput({
            notes,
            clinicKnowledgeBase,
          })}`,
          templatePrompt: 'You are a veterinary task extraction assistant. Return only valid JSON.',
        },
      });
      if (error) throw new Error(error.message);

      let jsonStr = (await extractLlmText(data)).trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const tasks: Task[] = normalizeExtractedTasks(parsed);

      setTasks(tasks);
      await persistSessionTasks(tasks);
      window.dispatchEvent(new Event('session-saved'));
    } catch (err) {
      console.error('Task extraction error:', err);
      throw err;
    } finally {
      setIsExtractingTasks(false);
    }
  }, [notes, clinicKnowledgeBase, setTasks, persistSessionTasks, setIsExtractingTasks]);

  return { extractTasks, isExtractingTasks };
}

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore, type Task } from '@/stores/useSessionStore';
import { extractLlmText } from '@/lib/llm';
import { buildTaskExtractionInput } from '@/lib/clinicContext';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';
import { getTaskExtractionPrompt } from '@/lib/promptSettings';
import { getAiGenerationConfig } from '@/lib/appSettings';

export function useTaskExtraction() {
  const notes = useSessionStore((s) => s.notes);
  const transcript = useSessionStore((s) => s.transcript);
  const clinicKnowledgeBase = useSessionStore((s) => s.clinicKnowledgeBase);
  const setTasks = useSessionStore((s) => s.setTasks);
  const setTasksNeedReview = useSessionStore((s) => s.setTasksNeedReview);
  const isExtractingTasks = useSessionStore((s) => s.isExtractingTasks);
  const setIsExtractingTasks = useSessionStore((s) => s.setIsExtractingTasks);

  const extractTasks = useCallback(async () => {
    if (!notes.trim()) throw new Error('No notes to extract tasks from');

    setIsExtractingTasks(true);
    try {
      const taskExtractionPrompt = getTaskExtractionPrompt();
      const aiConfig = getAiGenerationConfig();
      const taskSource = `${transcript.trim()}\n\n${notes.trim()}`.trim();
      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `${taskExtractionPrompt}\n\n${buildTaskExtractionInput({
            notes,
            transcript,
            clinicKnowledgeBase,
          })}`,
          templatePrompt: 'You are a veterinary task extraction assistant. Return only valid JSON with evidence quotes for every task.',
          llmProvider: aiConfig.provider,
          llmModel: aiConfig.model,
        },
      });
      if (error) throw new Error(error.message);

      let jsonStr = (await extractLlmText(data)).trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const tasks: Task[] = normalizeExtractedTasks(parsed, taskSource);

      setTasks(tasks);
      setTasksNeedReview(tasks.length > 0);
    } catch (err) {
      console.error('Task extraction error:', err);
      throw err;
    } finally {
      setIsExtractingTasks(false);
    }
  }, [notes, transcript, clinicKnowledgeBase, setTasks, setTasksNeedReview, setIsExtractingTasks]);

  return { extractTasks, isExtractingTasks };
}

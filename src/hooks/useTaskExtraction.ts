import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore, type Task } from '@/stores/useSessionStore';
import { extractLlmText } from '@/lib/llm';
import { buildTaskExtractionInput } from '@/lib/clinicContext';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';
import { getTaskExtractionPrompt } from '@/lib/promptSettings';
import { getTaskExtractionAiConfig } from '@/lib/appSettings';

interface ExtractTasksOptions {
  forceOpenAI?: boolean;
}

let taskExtractionRunId = 0;

export function useTaskExtraction() {
  const setTasks = useSessionStore((s) => s.setTasks);
  const setTasksNeedReview = useSessionStore((s) => s.setTasksNeedReview);
  const isExtractingTasks = useSessionStore((s) => s.isExtractingTasks);
  const setIsExtractingTasks = useSessionStore((s) => s.setIsExtractingTasks);
  const setTaskExtractionState = useSessionStore((s) => s.setTaskExtractionState);

  const extractTasks = useCallback(async (_options: ExtractTasksOptions = {}) => {
    const transcript = useSessionStore.getState().transcript;
    if (!transcript.trim()) throw new Error('No transcript available for task extraction');

    const state = useSessionStore.getState();
    const runId = taskExtractionRunId + 1;
    taskExtractionRunId = runId;
    const targetSessionId = state.activeSessionId;
    const targetTranscript = transcript.trim();

    const isCurrentRunTarget = () => {
      const current = useSessionStore.getState();
      return (
        runId === taskExtractionRunId &&
        current.activeSessionId === targetSessionId &&
        current.transcript.trim() === targetTranscript
      );
    };

    setIsExtractingTasks(true);
    setTasks([]);
    setTasksNeedReview(false);
    setTaskExtractionState('extracting');
    try {
      const taskExtractionPrompt = getTaskExtractionPrompt();
      const aiConfig = getTaskExtractionAiConfig();
      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `${taskExtractionPrompt}\n\n${buildTaskExtractionInput({
            transcript,
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
      const tasks: Task[] = normalizeExtractedTasks(parsed, transcript);

      if (!isCurrentRunTarget()) {
        return false;
      }

      setTasks(tasks);
      setTasksNeedReview(tasks.length > 0);
      setTaskExtractionState(
        tasks.length > 0 ? 'success' : 'empty',
        tasks.length > 0 ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} found.` : 'No tasks found in the transcript.',
      );
      return true;
    } catch (err) {
      console.error('Task extraction error:', err);
      const message = err instanceof Error ? err.message : 'Task extraction failed';
      setTasks([]);
      setTasksNeedReview(false);
      setTaskExtractionState('error', message);
      throw err;
    } finally {
      if (runId === taskExtractionRunId) {
        setIsExtractingTasks(false);
      }
    }
  }, [setTasks, setTasksNeedReview, setIsExtractingTasks, setTaskExtractionState]);

  return { extractTasks, isExtractingTasks };
}

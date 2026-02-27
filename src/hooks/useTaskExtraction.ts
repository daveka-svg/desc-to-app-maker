import { useCallback } from 'react';
import { mercuryChat, type ChatMessage } from '@/lib/mercury';
import { TASK_EXTRACTION_PROMPT } from '@/lib/prompts';
import { useSessionStore, type Task } from '@/stores/useSessionStore';

export function useTaskExtraction() {
  const setTasks = useSessionStore((s) => s.setTasks);
  const isExtractingTasks = useSessionStore((s) => s.isExtractingTasks);
  const setIsExtractingTasks = useSessionStore((s) => s.setIsExtractingTasks);

  const extractTasks = useCallback(async () => {
    const currentNotes = useSessionStore.getState().notes;
    if (!currentNotes.trim()) throw new Error('No notes to extract tasks from');

    setIsExtractingTasks(true);
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a veterinary task extraction assistant. Extract tasks from clinical notes and return them as JSON.' },
        { role: 'user', content: `${TASK_EXTRACTION_PROMPT}\n\nClinical Notes:\n${currentNotes}` },
      ];

      const response = await mercuryChat(messages);

      // Parse JSON from response (handle markdown fences)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const tasks: Task[] = [];
      const genId = () => crypto.randomUUID();

      const categories = ['prescriptions', 'diagnostics', 'followup', 'admin'] as const;
      for (const cat of categories) {
        const items = parsed[cat] || [];
        for (const item of items) {
          tasks.push({
            id: genId(),
            text: item.text,
            category: cat,
            assignee: (item.assignee || 'Vet') as Task['assignee'],
            done: false,
          });
        }
      }

      setTasks(tasks);
    } catch (err) {
      console.error('Task extraction error:', err);
      throw err;
    } finally {
      setIsExtractingTasks(false);
    }
  }, [setTasks, setIsExtractingTasks]);

  return { extractTasks, isExtractingTasks };
}

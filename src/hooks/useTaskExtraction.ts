import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TASK_EXTRACTION_PROMPT } from '@/lib/prompts';
import { useSessionStore, type Task } from '@/stores/useSessionStore';

async function parseSSEText(raw: unknown): Promise<string> {
  const text = typeof raw === 'string'
    ? raw
    : raw instanceof Blob
      ? await raw.text()
      : JSON.stringify(raw);

  let content = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const chunk = parsed.choices?.[0]?.delta?.content;
      if (chunk) content += chunk;
    } catch {
      // noop
    }
  }
  return content || text;
}

export function useTaskExtraction() {
  const notes = useSessionStore((s) => s.notes);
  const setTasks = useSessionStore((s) => s.setTasks);
  const isExtractingTasks = useSessionStore((s) => s.isExtractingTasks);
  const setIsExtractingTasks = useSessionStore((s) => s.setIsExtractingTasks);

  const extractTasks = useCallback(async () => {
    if (!notes.trim()) throw new Error('No notes to extract tasks from');

    setIsExtractingTasks(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `${TASK_EXTRACTION_PROMPT}\n\nClinical Notes:\n${notes}`,
          templatePrompt: 'You are a veterinary task extraction assistant. Return only valid JSON.',
        },
      });
      if (error) throw new Error(error.message);

      let jsonStr = (await parseSSEText(data)).trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const tasks: Task[] = [];
      const categories = ['prescriptions', 'diagnostics', 'followup', 'admin'] as const;

      for (const cat of categories) {
        const items = parsed[cat] || [];
        for (const item of items) {
          tasks.push({
            id: crypto.randomUUID(),
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
  }, [notes, setTasks, setIsExtractingTasks]);

  return { extractTasks, isExtractingTasks };
}

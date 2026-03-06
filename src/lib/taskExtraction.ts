import type { Task } from '@/stores/useSessionStore';

const categories = ['prescriptions', 'diagnostics', 'followup', 'admin'] as const;

const normalizeDeadline = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const asValidAssignee = (value: unknown): Task['assignee'] => {
  if (value === 'Vet' || value === 'Nurse' || value === 'Admin') return value;
  return 'Vet';
};

export const normalizeExtractedTasks = (parsed: unknown): Task[] => {
  const payload = parsed as Record<string, unknown>;
  const tasks: Task[] = [];

  for (const category of categories) {
    const items = Array.isArray(payload?.[category]) ? payload[category] as Array<Record<string, unknown>> : [];
    for (const item of items) {
      const rawText = typeof item?.text === 'string' ? item.text : String(item?.text || '');
      const compactText = rawText.replace(/\s+/g, ' ').trim();
      if (!compactText) continue;
      tasks.push({
        id: crypto.randomUUID(),
        text: compactText.length > 140 ? `${compactText.slice(0, 137)}...` : compactText,
        category,
        assignee: asValidAssignee(item?.assignee),
        done: false,
        orderIndex: tasks.length + 1,
        deadlineAt: normalizeDeadline(item?.deadline),
      });
    }
  }

  return tasks;
};


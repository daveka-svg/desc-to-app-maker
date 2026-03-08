import type { Task } from '@/stores/useSessionStore';

const categories = ['prescriptions', 'diagnostics', 'followup', 'admin'] as const;

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeEvidence = (value: string): string => {
  const words = normalize(value).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  if (words.length <= 24) return words.join(' ');
  return words.slice(0, 24).join(' ');
};

const isEvidenceGrounded = (evidence: unknown, sourceText: string): boolean => {
  if (typeof evidence !== 'string' || !evidence.trim()) return false;
  const normalizedSource = normalize(sourceText);
  const normalizedEvidence = normalizeEvidence(evidence);
  if (!normalizedSource || !normalizedEvidence || normalizedEvidence.length < 8) return false;
  return normalizedSource.includes(normalizedEvidence);
};

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

export const normalizeExtractedTasks = (parsed: unknown, sourceText: string): Task[] => {
  const payload = parsed as Record<string, unknown>;
  const tasks: Task[] = [];
  const seen = new Set<string>();

  for (const category of categories) {
    const items = Array.isArray(payload?.[category]) ? payload[category] as Array<Record<string, unknown>> : [];
    for (const item of items) {
      if (!isEvidenceGrounded(item?.evidence, sourceText)) continue;
      const rawText = typeof item?.text === 'string' ? item.text : String(item?.text || '');
      const compactText = rawText.replace(/\s+/g, ' ').trim();
      if (!compactText) continue;
      const dedupeKey = `${category}:${normalize(compactText)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
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

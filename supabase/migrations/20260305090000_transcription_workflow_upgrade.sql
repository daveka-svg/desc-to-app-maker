-- Sessions: custom naming + archiving support
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS sessions_user_archived_created_idx
  ON public.sessions (user_id, archived_at, created_at DESC);

-- Tasks: stable ordering for drag-and-drop boards
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS order_index INTEGER;

WITH ranked_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, COALESCE(assignee, 'Vet')
      ORDER BY created_at, id
    ) AS row_num
  FROM public.tasks
)
UPDATE public.tasks t
SET order_index = r.row_num
FROM ranked_tasks r
WHERE t.id = r.id
  AND t.order_index IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN order_index SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS tasks_session_assignee_order_idx
  ON public.tasks (session_id, assignee, order_index);

-- Note templates: support template CRUD recency ordering
ALTER TABLE public.note_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.note_templates
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_note_templates_updated_at ON public.note_templates;
CREATE TRIGGER update_note_templates_updated_at
  BEFORE UPDATE ON public.note_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS note_templates_user_updated_idx
  ON public.note_templates (user_id, updated_at DESC);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_session_deadline_idx
  ON public.tasks (session_id, deadline_at);

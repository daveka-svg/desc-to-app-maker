ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS supplemental_context text;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index integer;
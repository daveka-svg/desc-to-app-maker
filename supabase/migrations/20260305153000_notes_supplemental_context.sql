-- Persist uploaded/pasted context alongside notes so chat and regeneration
-- can load the same supporting materials when reopening a session.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS supplemental_context TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clinic_knowledge_base TEXT;

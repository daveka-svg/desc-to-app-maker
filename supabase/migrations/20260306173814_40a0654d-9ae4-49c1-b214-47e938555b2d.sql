
-- Add missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_knowledge_base text;
ALTER TABLE public.note_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

-- Add updated_at trigger to note_templates
CREATE TRIGGER update_note_templates_updated_at
  BEFORE UPDATE ON public.note_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

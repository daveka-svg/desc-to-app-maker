-- Add storage fields to document_templates so it becomes the single source of truth
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'generated-pdfs',
ADD COLUMN IF NOT EXISTS storage_path text;
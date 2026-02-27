-- Fix FK: selected_template_id should reference ahc_templates, not document_templates
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_selected_template_id_fkey;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_selected_template_id_fkey 
  FOREIGN KEY (selected_template_id) REFERENCES public.ahc_templates(id);
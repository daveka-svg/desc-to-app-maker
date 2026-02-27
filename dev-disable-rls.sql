-- Temporarily disable RLS for development testing
-- Run this in your Supabase SQL Editor to allow dev mode access

-- IMPORTANT: Only do this for LOCAL TESTING!
-- Re-enable RLS before deploying to production

-- Disable RLS on key tables
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates DISABLE ROW LEVEL SECURITY;

-- Note: clinics, profiles, and user_roles can stay enabled
-- since we're using a valid demo clinic ID

-- To re-enable RLS later, run:
-- ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

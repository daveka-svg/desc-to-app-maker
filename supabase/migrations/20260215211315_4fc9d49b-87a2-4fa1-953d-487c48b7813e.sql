
-- Drop the partially created tables from failed migration
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.document_templates CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.clinics CASCADE;
DROP TYPE IF EXISTS public.audit_action CASCADE;
DROP TYPE IF EXISTS public.attachment_type CASCADE;
DROP TYPE IF EXISTS public.submission_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.submission_status AS ENUM (
  'Draft', 'Submitted', 'NeedsCorrection', 'UnderReview', 
  'ReadyToGenerate', 'Generated', 'Approved', 'Downloaded', 'Cancelled'
);
CREATE TYPE public.attachment_type AS ENUM ('rabies_evidence', 'authorisation_letter', 'other');
CREATE TYPE public.audit_action AS ENUM (
  'created', 'saved_draft', 'submitted', 'correction_requested', 
  'corrected', 'template_selected', 'generated', 'approved', 'downloaded'
);

-- ============ CLINICS ============
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'United Kingdom',
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ DOCUMENT_TEMPLATES (before submissions) ============
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  first_country_of_entry TEXT NOT NULL,
  second_language_code TEXT NOT NULL,
  template_pdf_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  mapping_schema_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- ============ SUBMISSIONS ============
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.submission_status NOT NULL DEFAULT 'Draft',
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_name TEXT,
  owner_email TEXT,
  entry_date DATE,
  first_country_of_entry TEXT,
  final_destination TEXT,
  pets_count INTEGER DEFAULT 1,
  selected_template_id UUID REFERENCES public.document_templates(id),
  intake_pdf_url TEXT,
  final_ahc_pdf_url TEXT,
  correction_fields JSONB,
  correction_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ============ ATTACHMENTS ============
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  type public.attachment_type NOT NULL DEFAULT 'other',
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT_LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  details_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============ INDEXES ============
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_clinic_id ON public.profiles(clinic_id);
CREATE INDEX idx_submissions_clinic_id ON public.submissions(clinic_id);
CREATE INDEX idx_submissions_public_token ON public.submissions(public_token);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_entry_date ON public.submissions(entry_date);
CREATE INDEX idx_attachments_submission_id ON public.attachments(submission_id);
CREATE INDEX idx_audit_log_submission_id ON public.audit_log(submission_id);
CREATE INDEX idx_document_templates_country ON public.document_templates(first_country_of_entry);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT clinic_id FROM public.profiles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_member_of_clinic(_user_id UUID, _clinic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND clinic_id = _clinic_id) $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup (assigns to demo clinic)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, clinic_id, email, name)
  VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000001',
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
CREATE POLICY "Users can view their own clinic" ON public.clinics FOR SELECT TO authenticated
  USING (public.is_member_of_clinic(auth.uid(), id));

CREATE POLICY "Users can view profiles in their clinic" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_member_of_clinic(auth.uid(), clinic_id));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view their clinic submissions" ON public.submissions FOR SELECT TO authenticated
  USING (public.is_member_of_clinic(auth.uid(), clinic_id));
CREATE POLICY "Staff can insert submissions" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of_clinic(auth.uid(), clinic_id));
CREATE POLICY "Staff can update their clinic submissions" ON public.submissions FOR UPDATE TO authenticated
  USING (public.is_member_of_clinic(auth.uid(), clinic_id));
CREATE POLICY "Staff can delete their clinic submissions" ON public.submissions FOR DELETE TO authenticated
  USING (public.is_member_of_clinic(auth.uid(), clinic_id));

CREATE POLICY "Staff can view attachments" ON public.attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND public.is_member_of_clinic(auth.uid(), s.clinic_id)));
CREATE POLICY "Staff can insert attachments" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND public.is_member_of_clinic(auth.uid(), s.clinic_id)));
CREATE POLICY "Staff can delete attachments" ON public.attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND public.is_member_of_clinic(auth.uid(), s.clinic_id)));

CREATE POLICY "Auth users can view templates" ON public.document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert templates" ON public.document_templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update templates" ON public.document_templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete templates" ON public.document_templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view audit logs" ON public.audit_log FOR SELECT TO authenticated
  USING (submission_id IS NULL OR EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND public.is_member_of_clinic(auth.uid(), s.clinic_id)));
CREATE POLICY "Auth users can insert audit logs" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
CREATE POLICY "Auth upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Auth view attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');

INSERT INTO storage.buckets (id, name, public) VALUES ('generated-pdfs', 'generated-pdfs', true);
CREATE POLICY "Auth upload generated pdfs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generated-pdfs');
CREATE POLICY "Anyone view generated pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'generated-pdfs');

-- ============ SEED DATA ============
INSERT INTO public.clinics (id, name, address_line1, city, postal_code, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Veterinary Clinic', '123 High Street', 'London', 'SW1A 1AA', 'United Kingdom');

INSERT INTO public.document_templates (name, first_country_of_entry, second_language_code, template_pdf_url, active)
VALUES ('AHC - English/French (France)', 'France', 'fr', 'https://www.improve-ov.com/instructions/instructions-file.php?action=view&file_type=Form&unique_id=67210e8547f32', true);

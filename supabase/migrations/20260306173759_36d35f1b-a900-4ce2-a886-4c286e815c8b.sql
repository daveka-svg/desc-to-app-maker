
-- Allowed users whitelist table
CREATE TABLE public.allowed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage allowed_users
CREATE POLICY "Admins can view allowed_users"
  ON public.allowed_users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_users au
      WHERE au.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND au.email = 'veronika@everytailvets.co.uk'
    )
  );

CREATE POLICY "Admins can insert allowed_users"
  ON public.allowed_users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.allowed_users au
      WHERE au.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND au.email = 'veronika@everytailvets.co.uk'
    )
  );

CREATE POLICY "Admins can delete allowed_users"
  ON public.allowed_users FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_users au
      WHERE au.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND au.email = 'veronika@everytailvets.co.uk'
    )
  );

-- Seed the initial whitelist
INSERT INTO public.allowed_users (email, display_name) VALUES
  ('veronika@everytailvets.co.uk', 'Veronika Efimova'),
  ('anton@everytailvets.co.uk', 'Anton Efimov'),
  ('james.evenden@everytailvets.co.uk', 'James Evenden'),
  ('katherine.durban@everytailvets.co.uk', 'Katherine Durban'),
  ('lucinda.collins@everytailvets.co.uk', 'Lucinda Collins'),
  ('olivia.mcfarlane@everytailvets.co.uk', 'Olivia McFarlane'),
  ('safiya.eldeen@everytailvets.co.uk', 'Safiya El-Deen'),
  ('samantha.millette@everytailvets.co.uk', 'Samantha Millette');

-- Security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
    AND u.email = 'veronika@everytailvets.co.uk'
  )
$$;

-- Security definer function to check if email is allowed
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users WHERE lower(email) = lower(_email)
  )
$$;

-- Add permissive policies for admin to see ALL sessions, notes, tasks
CREATE POLICY "Admin can view all sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can view all notes"
  ON public.notes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can view all tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

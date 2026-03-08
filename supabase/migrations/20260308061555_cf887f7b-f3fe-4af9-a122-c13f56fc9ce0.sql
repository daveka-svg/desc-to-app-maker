-- Create the session-recordings storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-recordings', 'session-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own recordings
CREATE POLICY "Users can upload own recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'session-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own recordings
CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'session-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow admin to read all recordings
CREATE POLICY "Admin can read all recordings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'session-recordings' AND public.is_admin(auth.uid()));
-- Persist consultation audio recordings in Supabase Storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-recordings',
  'session-recordings',
  false,
  524288000,
  ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view own session recordings'
  ) THEN
    CREATE POLICY "Users can view own session recordings"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'session-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own session recordings'
  ) THEN
    CREATE POLICY "Users can upload own session recordings"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'session-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own session recordings'
  ) THEN
    CREATE POLICY "Users can update own session recordings"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'session-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'session-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own session recordings'
  ) THEN
    CREATE POLICY "Users can delete own session recordings"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'session-recordings'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

import { supabase } from '@/integrations/supabase/client';
import type { RecordingArtifact } from '@/stores/useSessionStore';

export const RECORDINGS_BUCKET = 'session-recordings';

const buildRecordingFileName = (now = new Date()): string => {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `consultation-${stamp}.webm`;
};

export const getRecordingFileNameFromPath = (path: string): string => {
  const value = String(path || '').trim();
  if (!value) return buildRecordingFileName();
  const segments = value.split('/');
  const fileName = segments[segments.length - 1];
  return fileName || buildRecordingFileName();
};

export const createRecordingSignedUrl = async (path: string): Promise<string | null> => {
  const trimmed = path.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(trimmed, 60 * 60 * 24 * 30);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

interface UploadSessionRecordingInput {
  blob: Blob;
  sessionId: string;
  durationSeconds: number;
  createdAt?: number;
}

export const uploadSessionRecording = async ({
  blob,
  sessionId,
  durationSeconds,
  createdAt = Date.now(),
}: UploadSessionRecordingInput): Promise<RecordingArtifact | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const fileName = buildRecordingFileName(new Date(createdAt));
  const storagePath = `${user.id}/${sessionId}/${fileName}`;

  const { error: uploadError } = await supabase
    .storage
    .from(RECORDINGS_BUCKET)
    .upload(storagePath, blob, {
      contentType: blob.type || 'audio/webm',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'Recording upload failed');
  }

  await supabase
    .from('sessions')
    .update({ audio_url: storagePath })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  const signedUrl = await createRecordingSignedUrl(storagePath);
  if (!signedUrl) return null;

  return {
    id: `remote-${sessionId}-${createdAt}`,
    sessionId,
    fileName,
    objectUrl: signedUrl,
    createdAt,
    durationSeconds: Math.max(0, durationSeconds),
    sizeBytes: blob.size,
  };
};

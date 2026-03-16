import { supabase } from '@/integrations/supabase/client';
import type { RecordingArtifact } from '@/stores/useSessionStore';

export const RECORDINGS_BUCKET = 'session-recordings';
export const RECORDING_RETENTION_DAYS = 14;

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

const chunkPaths = (paths: string[], chunkSize = 100): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < paths.length; index += chunkSize) {
    chunks.push(paths.slice(index, index + chunkSize));
  }
  return chunks;
};

export const purgeExpiredRemoteRecordings = async (now = Date.now()): Promise<number> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const cutoffIso = new Date(now - RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sessions')
    .select('id, audio_url, created_at')
    .eq('user_id', user.id)
    .not('audio_url', 'is', null)
    .lt('created_at', cutoffIso);

  if (error || !data?.length) {
    if (error) {
      console.warn('Recording retention cleanup query failed:', error.message);
    }
    return 0;
  }

  const paths = data
    .map((row) => String(row.audio_url || '').trim())
    .filter(Boolean);
  const sessionIds = data.map((row) => row.id);

  for (const chunk of chunkPaths(paths)) {
    const { error: removeError } = await supabase.storage.from(RECORDINGS_BUCKET).remove(chunk);
    if (removeError) {
      console.warn('Recording retention cleanup storage delete failed:', removeError.message);
    }
  }

  const { error: updateError } = await supabase
    .from('sessions')
    .update({ audio_url: null })
    .eq('user_id', user.id)
    .in('id', sessionIds);

  if (updateError) {
    console.warn('Recording retention cleanup session update failed:', updateError.message);
    return 0;
  }

  return sessionIds.length;
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

import { useRef, useCallback, useState } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const setInterimTranscript = useSessionStore((s) => s.setInterimTranscript);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  const segmentCountRef = useRef(0);
  const connectedRef = useRef(false);

  const pickText = (data: any): string => {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (typeof data.text === 'string') return data.text;
    if (typeof data.transcript === 'string') return data.transcript;
    if (typeof data.partial_transcript === 'string') return data.partial_transcript;
    if (typeof data.content === 'string') return data.content;
    if (typeof data?.transcript?.text === 'string') return data.transcript.text;
    return '';
  };

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onConnect: () => {
      console.log('[Scribe] Connected to ElevenLabs realtime');
      connectedRef.current = true;
    },
    onDisconnect: () => {
      console.log('[Scribe] Disconnected from ElevenLabs realtime');
      connectedRef.current = false;
    },
    onSessionStarted: () => {
      console.log('[Scribe] Session started - listening for speech');
    },
    onPartialTranscript: (data: unknown) => {
      const text = pickText(data).trim();
      console.log('[Scribe] Partial:', text);
      setInterimText(text);
      setInterimTranscript(text);
    },
    onCommittedTranscript: (data: unknown) => {
      const text = pickText(data).trim();
      console.log('[Scribe] Committed:', text);
      if (!text) return;

      segmentCountRef.current += 1;
      const speaker = segmentCountRef.current % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
      const existing = useSessionStore.getState().transcript;
      const prefix = existing ? '\n\n' : '';
      appendTranscript(`${prefix}**${speaker}:** ${text}`);
      setInterimText('');
      setInterimTranscript('');
    },
    onCommittedTranscriptWithTimestamps: (data: unknown) => {
      const text = pickText(data).trim();
      console.log('[Scribe] CommittedWithTimestamps:', text);
      if (!text) return;

      segmentCountRef.current += 1;
      const speaker = segmentCountRef.current % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
      const existing = useSessionStore.getState().transcript;
      const prefix = existing ? '\n\n' : '';
      appendTranscript(`${prefix}**${speaker}:** ${text}`);
      setInterimText('');
      setInterimTranscript('');
    },
    onError: (err: unknown) => {
      console.error('[Scribe] Error:', err);
    },
  });

  const startTranscription = useCallback(async () => {
    if (!isSupported || scribe.isConnected) return;

    try {
      console.log('[Scribe] Fetching token...');
      const { data, error } = await supabase.functions.invoke('openai-realtime-token');
      if (error || !data?.token) {
        console.error('[Scribe] Failed to get token:', error);
        return;
      }
      console.log('[Scribe] Token received, connecting...');

      segmentCountRef.current = 0;
      setInterimText('');
      setInterimTranscript('');
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('[Scribe] connect() resolved, isConnected:', scribe.isConnected);
    } catch (err) {
      console.error('[Scribe] Failed to start:', err);
    }
  }, [isSupported, scribe]);

  const stopTranscription = useCallback(async () => {
    if (scribe.isConnected || connectedRef.current) {
      console.log('[Scribe] Stopping - committing final segment...');
      try { scribe.commit(); } catch {}
      await wait(500);
      scribe.disconnect();
    }
    setInterimText('');
    setInterimTranscript('');
  }, [scribe, setInterimTranscript]);

  const pauseTranscription = useCallback(() => {
    if (scribe.isConnected) {
      try { scribe.commit(); } catch {}
      scribe.disconnect();
    }
    setInterimText('');
    setInterimTranscript('');
  }, [scribe, setInterimTranscript]);

  const resumeTranscription = useCallback(async () => {
    await wait(150);
    await startTranscription();
  }, [startTranscription]);

  return {
    isTranscribing: scribe.isConnected,
    interimText,
    isSupported,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  };
}

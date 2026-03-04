import { useRef, useCallback, useState } from 'react';
import { useScribe } from '@elevenlabs/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const setInterimTranscript = useSessionStore((s) => s.setInterimTranscript);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  const segmentCountRef = useRef(0);

  const pickText = (data: any): string => {
    if (!data) return '';
    if (typeof data.text === 'string') return data.text;
    if (typeof data.transcript === 'string') return data.transcript;
    if (typeof data.content === 'string') return data.content;
    return '';
  };

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    onPartialTranscript: (data: unknown) => {
      const text = pickText(data).trim();
      setInterimText(text);
      setInterimTranscript(text);
    },
    onCommittedTranscript: (data: unknown) => {
      const text = pickText(data).trim();
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
      console.error('ElevenLabs transcription error:', err);
    },
  });

  const startTranscription = useCallback(async () => {
    if (!isSupported || scribe.isConnected) return;

    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-token');
      if (error || !data?.token) {
        console.error('Failed to get ElevenLabs token:', error);
        return;
      }

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
    } catch (err) {
      console.error('Failed to start ElevenLabs transcription:', err);
    }
  }, [isSupported, scribe]);

  const stopTranscription = useCallback(async () => {
    if (scribe.isConnected) {
      await wait(350);
      (scribe as any).commit?.();
      await wait(250);
      scribe.disconnect();
    }
    setInterimText('');
    setInterimTranscript('');
  }, [scribe, setInterimTranscript]);

  const pauseTranscription = useCallback(() => {
    if (scribe.isConnected) {
      (scribe as any).commit?.();
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


import { useRef, useCallback, useState } from 'react';
import { useScribe } from '@elevenlabs/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time speech-to-text using ElevenLabs Scribe (scribe_v2_realtime).
 * Uses WebSocket-based transcription with VAD for automatic commit.
 * Prefixes each committed segment with speaker labels.
 */

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(true);
  const connectedRef = useRef(false);
  const segmentCountRef = useRef(0);
  const lastSpeakerRef = useRef<string>('');

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: 'vad' as any,
    onPartialTranscript: (data) => {
      setInterimText(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        segmentCountRef.current += 1;
        const segNum = segmentCountRef.current;
        // Alternate speakers heuristically - odd segments = Speaker 1, even = Speaker 2
        // The AI model will later determine who is vet vs patient
        const speaker = segNum % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
        
        const existing = useSessionStore.getState().transcript;
        const prefix = existing ? '\n\n' : '';
        appendTranscript(`${prefix}**${speaker}:** ${data.text.trim()}`);
        lastSpeakerRef.current = speaker;
      }
      setInterimText('');
    },
  });

  const startTranscription = useCallback(async (_lang?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token');
      if (error || !data?.token) {
        console.error('Failed to get scribe token:', error);
        return;
      }

      segmentCountRef.current = 0;
      lastSpeakerRef.current = '';

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      connectedRef.current = true;
      setIsTranscribing(true);
    } catch (err) {
      console.error('Failed to start ElevenLabs transcription:', err);
    }
  }, [scribe, appendTranscript]);

  const stopTranscription = useCallback(() => {
    if (connectedRef.current) {
      scribe.disconnect();
      connectedRef.current = false;
    }
    setIsTranscribing(false);
    setInterimText('');
  }, [scribe]);

  const pauseTranscription = useCallback(() => {
    if (connectedRef.current) {
      scribe.disconnect();
      connectedRef.current = false;
    }
    setIsTranscribing(false);
  }, [scribe]);

  const resumeTranscription = useCallback(async (lang?: string) => {
    await startTranscription(lang);
  }, [startTranscription]);

  return {
    isTranscribing,
    interimText,
    isSupported,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  };
}

import { useRef, useCallback, useState } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const getSpeechRecognitionCtor = (): (new () => BrowserSpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const setInterimTranscript = useSessionStore((s) => s.setInterimTranscript);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(
    typeof window !== 'undefined' && (!!navigator.mediaDevices?.getUserMedia || !!getSpeechRecognitionCtor())
  );
  const segmentCountRef = useRef(0);
  const connectedRef = useRef(false);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const usingBrowserFallbackRef = useRef(false);
  const browserShouldRestartRef = useRef(false);

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

  const appendSpeakerSegment = useCallback((text: string) => {
    if (!text.trim()) return;
    segmentCountRef.current += 1;
    const speaker = segmentCountRef.current % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
    const existing = useSessionStore.getState().transcript;
    const prefix = existing ? '\n\n' : '';
    appendTranscript(`${prefix}**${speaker}:** ${text.trim()}`);
    setInterimText('');
    setInterimTranscript('');
  }, [appendTranscript, setInterimTranscript]);

  const stopBrowserFallback = useCallback((clearInterim = true) => {
    browserShouldRestartRef.current = false;
    usingBrowserFallbackRef.current = false;
    const recognition = browserRecognitionRef.current;
    browserRecognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      // no-op
    }
    if (clearInterim) {
      setInterimText('');
      setInterimTranscript('');
    }
  }, [setInterimTranscript]);

  const startBrowserFallback = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor || usingBrowserFallbackRef.current) return false;

    try {
      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = (result?.[0]?.transcript || '').trim();
          if (!text) continue;
          if (result.isFinal) appendSpeakerSegment(text);
          else interim += `${text} `;
        }

        const interimTextValue = interim.trim();
        setInterimText(interimTextValue);
        setInterimTranscript(interimTextValue);
      };

      recognition.onerror = (event: any) => {
        console.warn('[BrowserSpeech] Error:', event?.error || event);
      };

      recognition.onend = () => {
        if (browserShouldRestartRef.current && usingBrowserFallbackRef.current) {
          try {
            recognition.start();
          } catch {
            // no-op
          }
        }
      };

      browserRecognitionRef.current = recognition;
      usingBrowserFallbackRef.current = true;
      browserShouldRestartRef.current = true;
      recognition.start();
      console.log('[Transcription] Browser speech fallback active');
      return true;
    } catch (err) {
      console.error('[Transcription] Failed to start browser speech fallback:', err);
      return false;
    }
  }, [appendSpeakerSegment, setInterimTranscript]);

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onConnect: () => {
      console.log('[Scribe] Connected to ElevenLabs realtime');
      connectedRef.current = true;
      stopBrowserFallback(false);
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
      setInterimText(text);
      setInterimTranscript(text);
    },
    onCommittedTranscript: (data: unknown) => {
      const text = pickText(data).trim();
      if (!text) return;
      appendSpeakerSegment(text);
    },
    onCommittedTranscriptWithTimestamps: (data: unknown) => {
      const text = pickText(data).trim();
      if (!text) return;
      appendSpeakerSegment(text);
    },
    onError: (err: unknown) => {
      console.error('[Scribe] Error:', err);
      if (!usingBrowserFallbackRef.current) {
        startBrowserFallback();
      }
    },
  });

  const startTranscription = useCallback(async () => {
    if (!isSupported || scribe.isConnected || connectedRef.current || usingBrowserFallbackRef.current) return;

    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-token');
      if (error || !data?.token) {
        throw new Error(error?.message || 'Failed to get realtime token');
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
      console.warn('[Scribe] Realtime unavailable, switching to browser speech fallback:', err);
      const started = startBrowserFallback();
      if (!started) {
        console.error('[Transcription] No realtime transcription provider available');
      }
    }
  }, [isSupported, scribe, setInterimTranscript, startBrowserFallback]);

  const stopTranscription = useCallback(async () => {
    if (scribe.isConnected || connectedRef.current) {
      try { scribe.commit(); } catch {}
      await wait(500);
      scribe.disconnect();
    }
    stopBrowserFallback(true);
    setInterimText('');
    setInterimTranscript('');
  }, [scribe, setInterimTranscript, stopBrowserFallback]);

  const pauseTranscription = useCallback(() => {
    if (scribe.isConnected) {
      try { scribe.commit(); } catch {}
      scribe.disconnect();
    }
    stopBrowserFallback(true);
    setInterimText('');
    setInterimTranscript('');
  }, [scribe, setInterimTranscript, stopBrowserFallback]);

  const resumeTranscription = useCallback(async () => {
    await wait(150);
    await startTranscription();
  }, [startTranscription]);

  return {
    isTranscribing: scribe.isConnected || usingBrowserFallbackRef.current,
    interimText,
    isSupported,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  };
}


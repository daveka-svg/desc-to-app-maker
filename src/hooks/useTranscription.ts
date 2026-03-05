import { useRef, useCallback, useState, useEffect } from 'react';
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

  // Keep stable refs for callbacks used inside useScribe config
  const appendTranscriptRef = useRef(appendTranscript);
  const setInterimTranscriptRef = useRef(setInterimTranscript);
  useEffect(() => {
    appendTranscriptRef.current = appendTranscript;
    setInterimTranscriptRef.current = setInterimTranscript;
  }, [appendTranscript, setInterimTranscript]);

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

  const commitSegment = (text: string) => {
    if (!text.trim()) return;
    segmentCountRef.current += 1;
    const speaker = segmentCountRef.current % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
    const existing = useSessionStore.getState().transcript;
    const prefix = existing ? '\n\n' : '';
    appendTranscriptRef.current(`${prefix}**${speaker}:** ${text.trim()}`);
    setInterimText('');
    setInterimTranscriptRef.current('');
  };

  // useScribe MUST be called at a stable position in the hook list
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onConnect: () => {
      console.log('[Scribe] Connected');
      connectedRef.current = true;
      // Stop browser fallback if scribe connects
      browserShouldRestartRef.current = false;
      usingBrowserFallbackRef.current = false;
      try { browserRecognitionRef.current?.stop(); } catch {}
      browserRecognitionRef.current = null;
    },
    onDisconnect: () => {
      console.log('[Scribe] Disconnected');
      connectedRef.current = false;
    },
    onSessionStarted: () => {
      console.log('[Scribe] Session started');
    },
    onPartialTranscript: (data: unknown) => {
      const text = pickText(data).trim();
      setInterimText(text);
      setInterimTranscriptRef.current(text);
    },
    onCommittedTranscript: (data: unknown) => {
      commitSegment(pickText(data));
    },
    onCommittedTranscriptWithTimestamps: (data: unknown) => {
      commitSegment(pickText(data));
    },
    onError: (err: unknown) => {
      console.error('[Scribe] Error:', err);
    },
  });

  const startBrowserFallback = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || usingBrowserFallbackRef.current) return false;
    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          const t = (r?.[0]?.transcript || '').trim();
          if (!t) continue;
          if (r.isFinal) commitSegment(t);
          else interim += `${t} `;
        }
        const iv = interim.trim();
        setInterimText(iv);
        setInterimTranscriptRef.current(iv);
      };

      recognition.onerror = (e: any) => console.warn('[BrowserSpeech] Error:', e?.error || e);

      recognition.onend = () => {
        if (browserShouldRestartRef.current && usingBrowserFallbackRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      browserRecognitionRef.current = recognition;
      usingBrowserFallbackRef.current = true;
      browserShouldRestartRef.current = true;
      recognition.start();
      console.log('[Transcription] Browser speech fallback active');
      return true;
    } catch (err) {
      console.error('[Transcription] Browser fallback failed:', err);
      return false;
    }
  }, []);

  const stopBrowserFallback = useCallback(() => {
    browserShouldRestartRef.current = false;
    usingBrowserFallbackRef.current = false;
    try { browserRecognitionRef.current?.stop(); } catch {}
    browserRecognitionRef.current = null;
  }, []);

  const startTranscription = useCallback(async () => {
    if (!isSupported || scribe.isConnected || connectedRef.current || usingBrowserFallbackRef.current) return;

    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-token');
      if (error || !data?.token) throw new Error(error?.message || 'No token');

      segmentCountRef.current = 0;
      setInterimText('');
      setInterimTranscriptRef.current('');
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      console.warn('[Scribe] Unavailable, using browser fallback:', err);
      startBrowserFallback();
    }
  }, [isSupported, scribe, startBrowserFallback]);

  const stopTranscription = useCallback(async () => {
    if (scribe.isConnected || connectedRef.current) {
      try { scribe.commit(); } catch {}
      await wait(500);
      scribe.disconnect();
    }
    stopBrowserFallback();
    setInterimText('');
    setInterimTranscriptRef.current('');
  }, [scribe, stopBrowserFallback]);

  const pauseTranscription = useCallback(() => {
    if (scribe.isConnected) {
      try { scribe.commit(); } catch {}
      scribe.disconnect();
    }
    stopBrowserFallback();
    setInterimText('');
    setInterimTranscriptRef.current('');
  }, [scribe, stopBrowserFallback]);

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

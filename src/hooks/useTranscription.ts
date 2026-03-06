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
  const setTranscriptionConnectionState = useSessionStore((s) => s.setTranscriptionConnectionState);
  const connectionState = useSessionStore((s) => s.transcriptionConnectionState);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(
    typeof window !== 'undefined' && (!!navigator.mediaDevices?.getUserMedia || !!getSpeechRecognitionCtor())
  );
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const usingBrowserFallbackRef = useRef(false);
  const browserShouldRestartRef = useRef(false);
  const shouldStayActiveRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const startTranscriptionRef = useRef<(() => Promise<void>) | null>(null);
  const recentCommittedSegmentsRef = useRef<Map<string, number>>(new Map());
  const lastCommittedSegmentRef = useRef<{ normalized: string; at: number }>({
    normalized: '',
    at: 0,
  });

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

  const normalizeSegment = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const pickSpeakerLabel = (data: any): string => {
    const fromPayload = data?.speaker ?? data?.speaker_id ?? data?.speaker_label ?? data?.speakerLabel;
    if (typeof fromPayload === 'number' && Number.isFinite(fromPayload)) {
      return `Speaker ${Math.max(1, fromPayload + 1)}`;
    }
    if (typeof fromPayload === 'string' && fromPayload.trim()) {
      const cleaned = fromPayload.trim();
      if (/^speaker\s*\d+$/i.test(cleaned)) {
        const digits = cleaned.match(/\d+/)?.[0] || '1';
        return `Speaker ${digits}`;
      }
      return cleaned;
    }
    return 'Speaker 1';
  };

  const isFillerOnly = (text: string): boolean => {
    const cleaned = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Common filler sounds / non-words to ignore
    const fillers = new Set([
      'uh', 'um', 'erm', 'er', 'ah', 'hmm', 'hm', 'mm', 'mhm', 'uhh', 'umm',
      'ahh', 'ehh', 'eh', 'oh', 'ooh', 'shh', 'huh', 'ugh',
    ]);
    const words = cleaned.split(' ').filter(Boolean);
    return words.length > 0 && words.every((w) => fillers.has(w));
  };

  const commitSegment = (data: unknown) => {
    const text = pickText(data).trim();
    if (!text) return;
    if (isFillerOnly(text)) return;
    const normalized = normalizeSegment(text);
    const now = Date.now();

    // Guard against duplicated committed chunks that can arrive from diarization callbacks.
    for (const [segment, seenAt] of recentCommittedSegmentsRef.current.entries()) {
      if (now - seenAt > 30000) {
        recentCommittedSegmentsRef.current.delete(segment);
      }
    }
    if (normalized && recentCommittedSegmentsRef.current.has(normalized)) {
      return;
    }

    if (
      normalized &&
      normalized === lastCommittedSegmentRef.current.normalized &&
      now - lastCommittedSegmentRef.current.at < 8000
    ) {
      return;
    }
    if (normalized) {
      recentCommittedSegmentsRef.current.set(normalized, now);
    }
    lastCommittedSegmentRef.current = { normalized, at: now };
    const speaker = pickSpeakerLabel(data);
    const existing = useSessionStore.getState().transcript;
    const prefix = existing ? '\n\n' : '';
    appendTranscriptRef.current(`${prefix}**${speaker}:** ${text.trim()}`);
    setInterimText('');
    setInterimTranscriptRef.current('');
  };

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const queueReconnect = useCallback((reason: string) => {
    if (!shouldStayActiveRef.current || usingBrowserFallbackRef.current || reconnectTimerRef.current !== null) {
      return;
    }
    const delayMs = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 8000);
    setTranscriptionConnectionState('reconnecting');
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptRef.current += 1;
      console.log(`[Scribe] Reconnect attempt ${reconnectAttemptRef.current} (${reason})`);
      startTranscriptionRef.current?.().catch((err) => {
        console.warn('[Scribe] Reconnect failed:', err);
      });
    }, delayMs);
  }, [setTranscriptionConnectionState]);

  // useScribe MUST be called at a stable position in the hook list
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onConnect: () => {
      console.log('[Scribe] Connected');
      connectedRef.current = true;
      connectingRef.current = false;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      setTranscriptionConnectionState('connected');
      // Stop browser fallback if scribe connects
      browserShouldRestartRef.current = false;
      usingBrowserFallbackRef.current = false;
      try { browserRecognitionRef.current?.stop(); } catch {}
      browserRecognitionRef.current = null;
    },
    onDisconnect: () => {
      console.log('[Scribe] Disconnected');
      connectedRef.current = false;
      connectingRef.current = false;
      if (shouldStayActiveRef.current && !usingBrowserFallbackRef.current) {
        setTranscriptionConnectionState('reconnecting');
        queueReconnect('disconnect');
      } else if (!usingBrowserFallbackRef.current) {
        setTranscriptionConnectionState('disconnected');
      }
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
      commitSegment(data);
    },
    onCommittedTranscriptWithTimestamps: (data: unknown) => {
      commitSegment(data);
    },
    onError: (err: unknown) => {
      console.error('[Scribe] Error:', err);
      if (shouldStayActiveRef.current && !usingBrowserFallbackRef.current) {
        setTranscriptionConnectionState('reconnecting');
        queueReconnect('error');
      }
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
          if (r.isFinal) commitSegment({ text: t, speaker: 'Speaker 1' });
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
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      setTranscriptionConnectionState('connected');
      recognition.start();
      console.log('[Transcription] Browser speech fallback active');
      return true;
    } catch (err) {
      console.error('[Transcription] Browser fallback failed:', err);
      return false;
    }
  }, [clearReconnectTimer, setTranscriptionConnectionState]);

  const stopBrowserFallback = useCallback(() => {
    browserShouldRestartRef.current = false;
    usingBrowserFallbackRef.current = false;
    try { browserRecognitionRef.current?.stop(); } catch {}
    browserRecognitionRef.current = null;
  }, []);

  const startTranscription = useCallback(async () => {
    shouldStayActiveRef.current = true;
    if (
      !isSupported ||
      scribe.isConnected ||
      connectedRef.current ||
      usingBrowserFallbackRef.current ||
      connectingRef.current
    ) {
      return;
    }
    connectingRef.current = true;
    setTranscriptionConnectionState('reconnecting');

    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-token');
      if (error || !data?.token) throw new Error(error?.message || 'No token');

      lastCommittedSegmentRef.current = { normalized: '', at: 0 };
      recentCommittedSegmentsRef.current.clear();
      setInterimText('');
      setInterimTranscriptRef.current('');
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      reconnectAttemptRef.current = 0;
    } catch (err) {
      connectedRef.current = false;
      connectingRef.current = false;
      console.warn('[Scribe] Unavailable, using browser fallback:', err);
      const fallbackStarted = startBrowserFallback();
      if (!fallbackStarted) {
        queueReconnect('connect-failure');
      }
    } finally {
      if (!connectedRef.current && !usingBrowserFallbackRef.current) {
        connectingRef.current = false;
      }
    }
  }, [isSupported, scribe, queueReconnect, setTranscriptionConnectionState, startBrowserFallback]);

  const stopTranscription = useCallback(async () => {
    shouldStayActiveRef.current = false;
    clearReconnectTimer();
    if (scribe.isConnected || connectedRef.current) {
      try { scribe.commit(); } catch {}
      await wait(500);
      scribe.disconnect();
    }
    connectingRef.current = false;
    connectedRef.current = false;
    stopBrowserFallback();
    setInterimText('');
    setInterimTranscriptRef.current('');
    setTranscriptionConnectionState('disconnected');
  }, [clearReconnectTimer, scribe, setTranscriptionConnectionState, stopBrowserFallback]);

  const pauseTranscription = useCallback(() => {
    shouldStayActiveRef.current = false;
    clearReconnectTimer();
    if (scribe.isConnected) {
      try { scribe.commit(); } catch {}
      scribe.disconnect();
    }
    connectingRef.current = false;
    connectedRef.current = false;
    stopBrowserFallback();
    setInterimText('');
    setInterimTranscriptRef.current('');
    setTranscriptionConnectionState('disconnected');
  }, [clearReconnectTimer, scribe, setTranscriptionConnectionState, stopBrowserFallback]);

  const resumeTranscription = useCallback(async () => {
    await wait(150);
    await startTranscription();
  }, [startTranscription]);

  useEffect(() => {
    startTranscriptionRef.current = startTranscription;
  }, [startTranscription]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && shouldStayActiveRef.current && !connectedRef.current && !usingBrowserFallbackRef.current) {
        queueReconnect('visibility');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearReconnectTimer();
    };
  }, [clearReconnectTimer, queueReconnect]);

  return {
    isTranscribing: scribe.isConnected || usingBrowserFallbackRef.current,
    connectionState,
    interimText,
    isSupported,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  };
}

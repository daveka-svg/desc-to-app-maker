import { useRef, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';

/**
 * Real-time speech-to-text using the Web Speech API (SpeechRecognition).
 * Falls back gracefully if the browser doesn't support it.
 *
 * How it works:
 * - Starts continuous recognition when recording begins
 * - Interim results appear immediately (grey text in TranscriptPanel)
 * - Final results are committed to the store's transcript
 * - Handles pauses, restarts, and error recovery automatically
 */

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const recognitionRef = useRef<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(() => !!SpeechRecognition);
  const shouldRestartRef = useRef(false);

  const startTranscription = useCallback((lang: string = 'en-GB') => {
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    // Clean up any existing instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsTranscribing(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }

      // Commit final text to the store
      if (finalTranscript) {
        const existing = useSessionStore.getState().transcript;
        const separator = existing && !existing.endsWith('\n') && !existing.endsWith(' ') ? ' ' : '';
        appendTranscript(separator + finalTranscript);
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('Speech recognition error:', event.error);
      // Auto-restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        if (shouldRestartRef.current) {
          setTimeout(() => {
            try { recognition.start(); } catch {}
          }, 500);
        }
      } else if (event.error === 'aborted') {
        // User or system aborted — don't restart
        setIsTranscribing(false);
      } else if (event.error === 'not-allowed') {
        setIsTranscribing(false);
      }
    };

    recognition.onend = () => {
      // Restart if we should still be transcribing (browser cuts off after ~60s silence)
      if (shouldRestartRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsTranscribing(false);
        setInterimText('');
      }
    };

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  }, [appendTranscript]);

  const stopTranscription = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
    setInterimText('');
  }, []);

  const pauseTranscription = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsTranscribing(false);
  }, []);

  const resumeTranscription = useCallback((lang: string = 'en-GB') => {
    shouldRestartRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch {}
    } else {
      startTranscription(lang);
    }
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

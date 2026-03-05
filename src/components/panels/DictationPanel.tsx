import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

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
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export default function DictationPanel() {
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const [isDictating, setIsDictating] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const supported = useMemo(
    () => typeof window !== 'undefined' && !!getSpeechRecognitionCtor(),
    []
  );

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  const startDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // no-op
      }
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event: any) => {
      let interim = '';
      const finalChunks: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result?.[0]?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) finalChunks.push(text);
        else interim += `${text} `;
      }

      setInterimText(interim.trim());
      if (finalChunks.length > 0) {
        const finalBlock = finalChunks.join(' ').trim();
        const existingNotes = useSessionStore.getState().notes;
        setNotes((existingNotes ? `${existingNotes.trim()}\n\n` : '') + finalBlock);
      }
    };

    recognition.onerror = () => {
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  };

  const stopDictation = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
    setIsDictating(false);
    setInterimText('');
  };

  if (!supported) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
        Dictation is not available in this browser.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border-light flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-bark">Dictate Notes</h2>
          <p className="text-xs text-text-muted">Use microphone dictation to append to consultation notes.</p>
        </div>
        {isDictating ? (
          <button
            onClick={stopDictation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error text-primary-foreground text-xs font-semibold"
          >
            <MicOff size={14} />
            Stop Dictation
          </button>
        ) : (
          <button
            onClick={startDictation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-forest text-primary-foreground text-xs font-semibold"
          >
            <Mic size={14} />
            Start Dictation
          </button>
        )}
      </div>

      <div className="p-5 overflow-y-auto flex-1">
        {interimText && (
          <div className="mb-3 rounded-md border border-border-light bg-sand px-3 py-2 text-xs text-text-secondary italic">
            {interimText}
          </div>
        )}
        <textarea
          className="w-full min-h-[420px] px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary focus:border-bark-muted"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dictated and edited notes will appear here..."
        />
      </div>
    </div>
  );
}

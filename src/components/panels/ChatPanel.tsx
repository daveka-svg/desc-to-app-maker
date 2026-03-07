import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Loader2, Mic, MicOff, Send } from 'lucide-react';
import { useAskETV } from '@/hooks/useAskETV';
import { useSessionStore } from '@/stores/useSessionStore';
import { useToast } from '@/hooks/use-toast';

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

const quickStarters = [
  'Generate chart summary from this consultation.',
  'Generate follow-up letter for this consultation.',
  'Interpret the uploaded lab results in clinical terms.',
  'Draft concise owner update and next-step plan.',
];

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const { sendMessage, isChatStreaming } = useAskETV();
  const chatMessages = useSessionStore((s) => s.chatMessages);
  const supplementalContext = useSessionStore((s) => s.supplementalContext);
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationInterim, setDictationInterim] = useState('');
  const canDictate = useMemo(
    () => typeof window !== 'undefined' && !!getSpeechRecognitionCtor(),
    []
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isChatStreaming) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
  };

  const runStarter = async (text: string) => {
    if (isChatStreaming) return;
    setInput('');
    await sendMessage(text);
  };

  const startDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || isChatStreaming) return;
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
      const finalParts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result?.[0]?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) finalParts.push(text);
        else interim += `${text} `;
      }
      setDictationInterim(interim.trim());
      if (finalParts.length > 0) {
        setInput((prev) => `${prev} ${finalParts.join(' ')}`.trim());
      }
    };

    recognition.onerror = () => {
      setIsDictating(false);
      setDictationInterim('');
    };

    recognition.onend = () => {
      setIsDictating(false);
      setDictationInterim('');
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
    setDictationInterim('');
  };

  const copyMessage = async (messageId: string, content: string) => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1800);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the message text.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-3 bg-card border-b border-border-light">
        <h2 className="text-[14px] font-semibold text-bark">Chat With Consultation</h2>
        <p className="text-xs text-text-muted">
          Source of truth: transcript first, then additional uploaded context, then generated notes.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickStarters.map((prompt) => (
            <button
              key={prompt}
              onClick={() => runStarter(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-sand hover:bg-sand-dark text-text-secondary"
              disabled={isChatStreaming}
            >
              {prompt}
            </button>
          ))}
        </div>
        {supplementalContext.trim() && (
          <div className="mt-2 text-[11px] text-text-muted bg-sand rounded-md px-2 py-1 border border-border-light">
            Uploaded context is included in chat reasoning.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-cream">
        {chatMessages.length === 0 ? (
          <div className="text-xs text-text-muted text-center py-8">
            Ask a question to start the consultation chat.
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-forest text-primary-foreground' : 'bg-card text-text-primary border border-border-light'
                }`}
              >
                {msg.content ? (
                  <>
                    {msg.content}
                    {msg.role === 'assistant' && (
                      <div className="mt-1.5 flex justify-end">
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border bg-sand hover:bg-sand-dark text-text-muted"
                          title="Copy response"
                        >
                          {copiedMessageId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                          {copiedMessageId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </>
                ) : isChatStreaming && msg.role === 'assistant' ? (
                  <TypingIndicator />
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex items-center gap-2.5 px-5 py-2.5 bg-card border-t border-border">
        {canDictate ? (
          <button
            onClick={isDictating ? stopDictation : startDictation}
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center ${
              isDictating ? 'bg-error' : 'bg-sand border border-border'
            }`}
            title={isDictating ? 'Stop dictation' : 'Dictate in chat'}
          >
            {isDictating ? <MicOff size={15} className="text-primary-foreground" /> : <Mic size={15} className="text-text-primary" />}
          </button>
        ) : null}
        <input
          className="flex-1 px-3.5 py-2.5 border border-border rounded-md text-[13px] outline-none bg-sand text-text-primary placeholder:text-text-muted focus:border-bark-muted focus:bg-card transition-colors"
          placeholder="Ask about this consultation..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isChatStreaming}
        />
        <button
          onClick={handleSend}
          disabled={isChatStreaming || !input.trim()}
          className="w-[34px] h-[34px] rounded-full bg-forest flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-40"
        >
          {isChatStreaming ? (
            <Loader2 size={16} className="text-primary-foreground animate-spin" />
          ) : (
            <Send size={16} className="text-primary-foreground" />
          )}
        </button>
      </div>
      {dictationInterim && (
        <div className="px-5 py-1.5 text-[11px] text-text-muted italic bg-card border-t border-border-light">
          {dictationInterim}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 py-1">
      <span className="text-[11px] text-text-muted">Thinking</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}

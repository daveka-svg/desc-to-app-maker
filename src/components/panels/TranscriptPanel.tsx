import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { Mic, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TranscriptPanel() {
  const transcript = useSessionStore((s) => s.transcript);
  const interimTranscript = useSessionStore((s) => s.interimTranscript);
  const isRecording = useSessionStore((s) => s.isRecording);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Transcript copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2 bg-card border-b border-border-light shrink-0">
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-forest">
              <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse-dot" />
              Listening...
            </span>
          )}
          {wordCount > 0 && (
            <span className="text-[11px] text-text-muted">{wordCount} words</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={!transcript}
            className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark cursor-pointer hover:bg-sand-dark disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Content - Read only */}
      <div className="flex-1 overflow-y-auto p-6">
        {!transcript && !interimTranscript && !isRecording ? (
          <div className="max-w-[720px] text-sm text-text-muted py-12 text-center mx-auto">
            <div className="w-12 h-12 bg-sand rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic size={20} className="text-text-muted" />
            </div>
            <p className="mb-2 font-medium">No transcript yet.</p>
            <p>Start recording from the <strong className="text-bark">Context</strong> tab to capture speech in real-time.</p>
          </div>
        ) : null}

        {/* Read-only transcript display */}
        {transcript && (
          <div className="w-full max-w-[720px] text-sm leading-[1.85] text-text-primary whitespace-pre-wrap">
            {transcript.split('\n\n').map((segment, i) => {
              const isSpeaker1 = segment.startsWith('**Speaker 1:**');
              const isSpeaker2 = segment.startsWith('**Speaker 2:**');
              const speakerLabel = isSpeaker1 ? 'Speaker 1' : isSpeaker2 ? 'Speaker 2' : null;
              const text = speakerLabel ? segment.replace(/^\*\*Speaker \d:\*\*\s*/, '') : segment;

              return (
                <div key={i} className="mb-4">
                  {speakerLabel && (
                    <span className={`text-xs font-bold mr-2 px-2 py-0.5 rounded-full ${
                      isSpeaker1
                        ? 'bg-[#e8f0e5] text-forest'
                        : 'bg-[#e5ecf5] text-[#3565a0]'
                    }`}>
                      {speakerLabel}
                    </span>
                  )}
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        )}

        {isRecording && interimTranscript && (
          <div className="w-full max-w-[720px] text-sm leading-[1.85] text-text-muted italic mt-1">
            {interimTranscript}
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-forest mt-2 max-w-[720px]">
            <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse-dot" />
            Listening - speak clearly for best results
          </div>
        )}
      </div>
    </div>
  );
}


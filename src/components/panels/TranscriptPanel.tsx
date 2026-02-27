import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { Mic, Pen, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TranscriptPanel() {
  const transcript = useSessionStore((s) => s.transcript);
  const setTranscript = useSessionStore((s) => s.setTranscript);
  const isRecording = useSessionStore((s) => s.isRecording);
  const [editing, setEditing] = useState(false);
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
          {editing && (
            <span className="flex items-center gap-1 text-[11px] text-forest font-semibold"><Pen size={12} /> Editing</span>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!transcript && !isRecording ? (
          <div className="max-w-[720px] text-sm text-text-muted py-12 text-center mx-auto">
            <div className="w-12 h-12 bg-sand rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic size={20} className="text-text-muted" />
            </div>
            <p className="mb-2 font-medium">No transcript yet.</p>
            <p>Start recording from the <strong className="text-bark">Context</strong> tab to capture speech in real-time, or paste a transcript below to get started.</p>
          </div>
        ) : null}

        {/* Editable transcript area */}
        <textarea
          className="w-full max-w-[720px] min-h-[200px] text-sm leading-[1.85] text-text-primary bg-transparent outline-none resize-none rounded-md p-2 transition-colors duration-150 hover:bg-bark/[0.02] focus:bg-card focus:shadow-[0_0_0_2px_hsl(var(--sand-deeper))]"
          placeholder={isRecording ? 'Transcript will appear here as you speak...' : 'Paste or type transcript here...'}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          spellCheck
        />

        {/* Recording indicator at the bottom of transcript */}
        {isRecording && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-forest mt-2 max-w-[720px]">
            <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse-dot" />
            Listening — speak clearly for best results
          </div>
        )}
      </div>
    </div>
  );
}

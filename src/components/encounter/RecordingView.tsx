import { Pause, Play, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Button } from '@/components/ui/button';
import PEForm from '@/components/pe-form/PEForm';

export default function RecordingView({ onStopRecording }: { onStopRecording: () => void }) {
  const transcript = useSessionStore((s) => s.transcript);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const togglePE = useSessionStore((s) => s.togglePE);
  const patientName = useSessionStore((s) => s.patientName);
  const { isPaused, timerSeconds, waveformData, pauseRecording, resumeRecording } = useAudioRecorder();
  const [peOpen, setPeOpen] = useState(false);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Recording header */}
      <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-error animate-pulse-dot" />
          <span className="font-mono text-2xl font-semibold" style={{ color: 'hsl(var(--text))' }}>
            {formatTime(timerSeconds)}
          </span>
          {patientName && (
            <span className="text-sm ml-2" style={{ color: 'hsl(var(--text-muted))' }}>— {patientName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button variant="outline" size="sm" onClick={resumeRecording} className="gap-1.5">
              <Play size={14} /> Resume
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={pauseRecording} className="gap-1.5">
              <Pause size={14} /> Pause
            </Button>
          )}
          <Button size="sm" onClick={onStopRecording} className="gap-1.5 bg-error hover:bg-error/90 text-primary-foreground">
            <Square size={14} /> End Session
          </Button>
        </div>
      </div>

      {/* Waveform */}
      <div className="flex items-center justify-center gap-[2px] h-20 bg-card border-b border-border px-6">
        {waveformData.map((v, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-forest transition-all duration-75"
            style={{ height: `${Math.max(4, v * 60)}px` }}
          />
        ))}
        {waveformData.length === 0 && (
          <p className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
            {isPaused ? 'Recording paused' : 'Waiting for audio...'}
          </p>
        )}
      </div>

      {/* Live transcript */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--text-muted))' }}>
          Live Transcript
        </h3>
        {transcript ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'hsl(var(--text))' }}>
            {transcript}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: 'hsl(var(--text-muted))' }}>
            Speak to see your transcript appear here...
          </p>
        )}
      </div>

      {/* PE form collapsible */}
      <div className="border-t border-border bg-card">
        <button
          onClick={() => { if (!peEnabled) togglePE(); setPeOpen(!peOpen); }}
          className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium hover:bg-sand transition-colors"
          style={{ color: 'hsl(var(--text-secondary))' }}
        >
          Physical Examination
          {peOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {peOpen && peEnabled && (
          <div className="max-h-[300px] overflow-y-auto px-6 pb-4">
            <PEForm />
          </div>
        )}
      </div>
    </div>
  );
}

import type { ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useEncounterController } from '@/components/encounter/EncounterControllerProvider';
import PEForm from '@/components/pe-form/PEForm';

const connectionMeta: Record<
  'connected' | 'reconnecting' | 'disconnected',
  { label: string; className: string; icon: React.ReactNode }
> = {
  connected: {
    label: 'Live transcription connected',
    className: 'text-forest',
    icon: <Wifi size={13} />,
  },
  reconnecting: {
    label: 'Reconnecting live transcription',
    className: 'text-warning',
    icon: <Loader2 size={13} className="animate-spin" />,
  },
  disconnected: {
    label: 'Live transcription disconnected',
    className: 'text-error',
    icon: <WifiOff size={13} />,
  },
};

export default function ContextPanel() {
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const togglePE = useSessionStore((s) => s.togglePE);
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const availableTemplates = useSessionStore((s) => s.availableTemplates);
  const supplementalContext = useSessionStore((s) => s.supplementalContext);
  const setSupplementalContext = useSessionStore((s) => s.setSupplementalContext);
  const appendSupplementalContext = useSessionStore((s) => s.appendSupplementalContext);
  const encounterStatus = useSessionStore((s) => s.encounterStatus);
  const processingSteps = useSessionStore((s) => s.processingSteps);
  const {
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    isSupported,
    transcriptionConnectionState,
    startEncounter,
    pauseEncounter,
    resumeEncounter,
    stopEncounter,
  } = useEncounterController();

  const isProcessing = encounterStatus === 'processing';

  const handleContextFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const text = await file.text();
      const clipped = text.trim().slice(0, 7000);
      if (!clipped) continue;
      appendSupplementalContext(`Source: ${file.name}\n${clipped}`);
    }

    event.target.value = '';
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const connectionUi = connectionMeta[transcriptionConnectionState];

  return (
    <div className="p-5 overflow-y-auto flex-1">
      <div className="mb-3.5 rounded-lg border border-border-light bg-card p-3.5">
        <div className="text-[12px] font-bold text-bark mb-1">Quick start</div>
        <div className="text-[12px] text-text-secondary leading-relaxed">
          1) Add patient details and template below.
          <br />
          2) Press Start Recording.
          <br />
          3) Press End session to auto-generate transcript, notes, and tasks.
        </div>
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">Recording</div>
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold ${connectionUi.className}`}>
            {connectionUi.icon}
            {isSupported ? connectionUi.label : 'Live transcription unavailable in this browser'}
          </div>
        </div>

        {!isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[32px] font-semibold text-bark tracking-wide flex items-center gap-2.5">
              {isRecording && !isPaused && <span className="w-[9px] h-[9px] rounded-full bg-error animate-pulse-dot" />}
              {isPaused && <span className="w-[9px] h-[9px] rounded-full bg-warning" />}
              {!isRecording && <span className="w-[9px] h-[9px] rounded-full bg-text-muted" />}
              {formatTime(timerSeconds)}
            </div>

            <div className="flex items-center justify-center gap-[2px] h-16 w-full max-w-[360px]">
              {waveformData.map((h, i) => (
                <div
                  key={i}
                  className={`w-[3px] rounded-sm transition-all duration-75 ${
                    isRecording && !isPaused ? 'bg-forest opacity-80' : 'bg-text-muted opacity-20'
                  }`}
                  style={{ height: `${Math.min(h, 56)}px` }}
                />
              ))}
            </div>

            <div className="flex gap-2.5">
              {!isRecording ? (
                <button
                  onClick={startEncounter}
                  className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-forest bg-forest text-primary-foreground cursor-pointer hover:bg-forest-dark transition-all duration-[120ms]"
                >
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={isPaused ? resumeEncounter : pauseEncounter}
                    className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-warning cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopEncounter}
                    className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-error cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                  >
                    End session
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-bark">Finalizing transcript and generating output...</div>
            <div className="space-y-2">
              {processingSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-2 text-[13px]">
                  {step.status === 'done' ? (
                    <CheckCircle2 size={15} className="text-success" />
                  ) : step.status === 'active' ? (
                    <Loader2 size={15} className="animate-spin text-forest" />
                  ) : step.status === 'error' ? (
                    <AlertTriangle size={15} className="text-error" />
                  ) : (
                    <span className="w-[15px] h-[15px] rounded-full border border-border" />
                  )}
                  <span className={step.status === 'active' ? 'font-semibold text-text-primary' : 'text-text-secondary'}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">Session details</div>
        <div className="flex gap-2.5 mt-1">
          <input
            type="text"
            placeholder="Patient name (optional)"
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            disabled={isProcessing}
          />
          <select
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            disabled={isProcessing}
          >
            {availableTemplates.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-semibold text-text-secondary">Additional Context (lab/results)</label>
            <div className="flex items-center gap-2">
              <label className="px-2.5 py-1 text-[11px] font-semibold bg-sand border border-border rounded-md cursor-pointer hover:bg-sand-dark">
                Upload text file
                <input
                  type="file"
                  accept=".txt,.md,.csv,.log,.json"
                  multiple
                  className="hidden"
                  onChange={handleContextFileUpload}
                  disabled={isProcessing}
                />
              </label>
              <button
                onClick={() => setSupplementalContext('')}
                disabled={!supplementalContext.trim() || isProcessing}
                className="px-2.5 py-1 text-[11px] font-semibold bg-card border border-border rounded-md disabled:opacity-40 hover:bg-sand"
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            value={supplementalContext}
            onChange={(e) => setSupplementalContext(e.target.value)}
            disabled={isProcessing}
            placeholder="Paste lab findings, external notes, or uploaded text context used during summary generation."
            className="w-full min-h-[96px] px-3 py-2 border border-border rounded-md text-[12px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted resize-y"
          />
        </div>

        <div className="flex items-center justify-between mt-3 px-3.5 py-2.5 bg-sand rounded-md">
          <span className="text-[13px] font-medium text-text-secondary flex items-center gap-[7px]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="opacity-50"
            >
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
            </svg>
            Physical Examination
          </span>
          <div
            className={`relative w-[38px] h-5 rounded-[10px] cursor-pointer transition-colors duration-200 ${
              peEnabled ? 'bg-forest' : 'bg-sand-deeper'
            }`}
            onClick={() => {
              if (!isProcessing) togglePE();
            }}
          >
            <div
              className={`absolute top-[2px] w-4 h-4 bg-card rounded-full transition-[left] duration-200 shadow-sm ${
                peEnabled ? 'left-5' : 'left-[2px]'
              }`}
            />
          </div>
        </div>
      </div>

      {peEnabled && <PEForm />}
    </div>
  );
}

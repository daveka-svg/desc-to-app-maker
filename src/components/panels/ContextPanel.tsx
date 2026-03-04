import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useToast } from '@/hooks/use-toast';
import PEForm from '@/components/pe-form/PEForm';

const templates = ['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check', 'Discharge Summary', 'Referral Letter', 'Follow-up Update'];

export default function ContextPanel() {
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const togglePE = useSessionStore((s) => s.togglePE);
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const setIsRecording = useSessionStore((s) => s.setIsRecording);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const { isRecording, isPaused, timerSeconds, waveformData, startRecording, pauseRecording, resumeRecording, stopRecording } = useAudioRecorder();
  const { isSupported, startTranscription, stopTranscription, pauseTranscription, resumeTranscription } = useTranscription();
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const { toast } = useToast();

  const handleStart = async () => {
    await startRecording();
    setIsRecording(true);
    if (isSupported) {
      startTranscription('en-GB');
    }
  };

  const handlePause = () => {
    pauseRecording();
    pauseTranscription();
  };

  const handleResume = () => {
    resumeRecording();
    resumeTranscription('en-GB');
  };

  const handleStop = async () => {
    const blobPromise = stopRecording();
    await stopTranscription();
    const blob = await blobPromise;
    setIsRecording(false);
    if (blob) {
      console.log('Recording stopped. Audio blob size:', blob.size);
    }

    const transcript = useSessionStore.getState().transcript;
    if (!transcript.trim()) {
      toast({ title: 'No transcript', description: 'No speech was detected during recording.', variant: 'destructive' });
      return;
    }

    try {
      toast({ title: 'Generating...', description: 'Creating clinical notes from transcript.' });
      setActiveTab('notes');
      await generateNote();
      toast({ title: 'Notes generated', description: 'Extracting tasks...' });

      try { await extractTasks(); } catch { /* non-critical */ }

      await saveCurrentSession();
      toast({ title: 'Session saved', description: 'Notes and tasks saved.' });
      window.dispatchEvent(new Event('session-saved'));
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="p-5 overflow-y-auto flex-1">
      {/* Recording */}
      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">Recording</div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="font-mono text-[32px] font-semibold text-bark tracking-wide flex items-center gap-2.5">
            {isRecording && !isPaused && <span className="w-[9px] h-[9px] rounded-full bg-error animate-pulse-dot" />}
            {isPaused && <span className="w-[9px] h-[9px] rounded-full bg-warning" />}
            {!isRecording && <span className="w-[9px] h-[9px] rounded-full bg-text-muted" />}
            {formatTime(timerSeconds)}
          </div>
          {/* Waveform - taller, more prominent */}
          <div className="flex items-center justify-center gap-[2px] h-16 w-full max-w-[360px]">
            {waveformData.map((h, i) => (
              <div
                key={i}
                className={`w-[3px] rounded-sm transition-all duration-75 ${isRecording && !isPaused ? 'bg-forest opacity-80' : 'bg-text-muted opacity-20'}`}
                style={{ height: `${Math.min(h, 56)}px` }}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            {!isRecording ? (
              <button
                onClick={handleStart}
                className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-forest bg-forest text-primary-foreground cursor-pointer hover:bg-forest-dark transition-all duration-[120ms]"
              >
                🎙 Start Recording
              </button>
            ) : (
              <>
                <button
                  onClick={isPaused ? handleResume : handlePause}
                  className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-warning cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  onClick={handleStop}
                  className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-error cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                >
                  ⏹ End session
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Session details */}
      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">Session details</div>
        <div className="flex gap-2.5 mt-1">
          <input
            type="text"
            placeholder="Patient name (optional)"
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <select
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* PE toggle */}
        <div className="flex items-center justify-between mt-3 px-3.5 py-2.5 bg-sand rounded-md">
          <span className="text-[13px] font-medium text-text-secondary flex items-center gap-[7px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
            </svg>
            Physical Examination
          </span>
          <div
            className={`relative w-[38px] h-5 rounded-[10px] cursor-pointer transition-colors duration-200 ${peEnabled ? 'bg-forest' : 'bg-sand-deeper'}`}
            onClick={togglePE}
          >
            <div
              className={`absolute top-[2px] w-4 h-4 bg-card rounded-full transition-[left] duration-200 shadow-sm ${peEnabled ? 'left-5' : 'left-[2px]'}`}
            />
          </div>
        </div>
      </div>

      {/* PE Form */}
      {peEnabled && <PEForm />}
    </div>
  );
}

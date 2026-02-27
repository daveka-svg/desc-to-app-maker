import { Calendar, Globe } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useClientInstructions } from '@/hooks/useClientInstructions';
import { useToast } from '@/hooks/use-toast';

export default function TopBar() {
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const isRecording = useSessionStore((s) => s.isRecording);
  const setIsRecording = useSessionStore((s) => s.setIsRecording);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);
  const { isRecording: audioRecording, timerSeconds, startRecording, stopRecording } = useAudioRecorder();
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const { generateInstructions } = useClientInstructions();
  const { toast } = useToast();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleCreate = async () => {
    try {
      toast({ title: 'Generating...', description: 'Creating clinical notes from transcript.' });
      setActiveTab('notes');
      await generateNote();
      toast({ title: 'Notes generated', description: 'Clinical notes are ready. Extracting tasks...' });

      // Auto-extract tasks after notes
      try {
        await extractTasks();
        toast({ title: 'Tasks extracted', description: 'Tasks have been extracted from notes.' });
      } catch { /* non-critical */ }

      // Auto-generate client instructions
      try {
        await generateInstructions();
      } catch { /* non-critical */ }

      saveCurrentSession();
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border min-h-[48px]">
      <div className="flex items-center gap-2.5">
        <input
          className="text-[15px] font-medium text-text-primary border-none outline-none bg-transparent w-[220px] placeholder:text-text-muted"
          placeholder="Add patient details"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Calendar size={13} className="opacity-50" /> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Globe size={13} className="opacity-50" /> English
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        {audioRecording && (
          <div className="font-mono text-[13px] text-text-secondary flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-error animate-pulse-dot" />
            {formatTime(timerSeconds)}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer px-2 py-1 rounded-md hover:bg-sand">
          Default — Microphone
          <div className="flex items-end gap-[1.5px] h-4">
            {[6, 10, 14, 8, 12].map((h, i) => (
              <div key={i} className="w-[3px] rounded-sm bg-forest animate-mic-bar" style={{ animationDelay: `${i * 0.15}s`, height: `${h}px` }} />
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={isGeneratingNotes}
          className="bg-forest text-primary-foreground border-none px-[18px] py-2 rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-forest-dark transition-colors disabled:opacity-50"
        >
          {isGeneratingNotes ? (
            <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg> Creating...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg> Create</>
          )}
        </button>

        <button className="bg-sand text-bark border border-border px-4 py-[7px] rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-sand-dark transition-colors">
          <div className="flex gap-[1.5px] items-center">
            {[1,2,3,4].map(i => (<span key={i} className="w-[3px] h-[10px] bg-bark rounded-sm" />))}
          </div>
          Resume
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
    </div>
  );
}

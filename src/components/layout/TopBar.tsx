import { Calendar, Globe, Loader2 } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useToast } from '@/hooks/use-toast';

export default function TopBar() {
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const sessionTitle = useSessionStore((s) => s.sessionTitle);
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const encounterStatus = useSessionStore((s) => s.encounterStatus);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const { toast } = useToast();

  const fallbackConsultationTitle = `${selectedTemplate} Consultation`;

  const handleCreate = async () => {
    try {
      toast({ title: 'Generating...', description: 'Creating clinical notes from transcript.' });
      setActiveTab('notes');
      await generateNote();
      toast({ title: 'Notes generated', description: 'Clinical notes are ready. Extracting tasks...' });

      try {
        await extractTasks();
        toast({ title: 'Tasks extracted' });
      } catch {
        // non-critical
      }

      await saveCurrentSession();
      window.dispatchEvent(new Event('session-saved'));
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'Could not generate notes.',
        variant: 'destructive',
      });
    }
  };

  const handleSessionTitleBlur = async () => {
    if (!activeSessionId) return;
    try {
      await saveCurrentSession();
      window.dispatchEvent(new Event('session-saved'));
    } catch {
      // no-op
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border min-h-[52px] gap-3">
      <div className="flex items-center gap-2.5 min-w-[220px]">
        <input
          className="text-[14px] font-medium text-text-primary border-none outline-none bg-transparent w-[220px] placeholder:text-text-muted"
          placeholder="Patient details"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          disabled={encounterStatus === 'processing'}
        />
      </div>

      <div className="flex-1 min-w-0 max-w-[420px]">
        <input
          className="w-full text-[13px] font-semibold text-bark border border-border rounded-md px-3 py-1.5 outline-none bg-sand focus:border-bark-muted"
          placeholder={fallbackConsultationTitle}
          value={sessionTitle}
          onChange={(e) => setSessionTitle(e.target.value)}
          onBlur={handleSessionTitleBlur}
          disabled={encounterStatus === 'processing'}
        />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Calendar size={13} className="opacity-50" /> {dateStr}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Globe size={13} className="opacity-50" /> English
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <button
          onClick={handleCreate}
          disabled={isGeneratingNotes || encounterStatus === 'processing'}
          className="bg-sand text-bark border border-border px-[18px] py-2 rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-sand-dark transition-colors disabled:opacity-50"
        >
          {isGeneratingNotes ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Generating...
            </>
          ) : (
            <>Generate Summary</>
          )}
        </button>
      </div>
    </div>
  );
}

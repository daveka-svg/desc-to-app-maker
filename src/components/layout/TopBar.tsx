import { useEffect, useState } from 'react';
import { Calendar, Globe } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function TopBar() {
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const { toast } = useToast();
  const [consultationLabel, setConsultationLabel] = useState('New Consultation');

  useEffect(() => {
    let cancelled = false;

    const loadSessionMeta = async () => {
      if (!activeSessionId) {
        setConsultationLabel('New Consultation');
        return;
      }

      const { data } = await supabase
        .from('sessions')
        .select('session_type, created_at')
        .eq('id', activeSessionId)
        .maybeSingle();

      if (cancelled) return;

      if (!data) {
        setConsultationLabel(selectedTemplate);
        return;
      }

      const dt = new Date(data.created_at);
      const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      setConsultationLabel(`${data.session_type || selectedTemplate} · ${date} ${time}`);
    };

    loadSessionMeta();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, selectedTemplate]);

  const handleCreate = async () => {
    try {
      toast({ title: 'Generating...', description: 'Creating clinical notes from transcript.' });
      setActiveTab('notes');
      await generateNote();
      toast({ title: 'Notes generated', description: 'Clinical notes are ready. Extracting tasks...' });

      try { await extractTasks(); toast({ title: 'Tasks extracted' }); } catch { /* non-critical */ }

      await saveCurrentSession();
      window.dispatchEvent(new Event('session-saved'));
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border min-h-[48px] gap-3">
      <div className="flex items-center gap-2.5 min-w-[220px]">
        <input
          className="text-[15px] font-medium text-text-primary border-none outline-none bg-transparent w-[220px] placeholder:text-text-muted"
          placeholder="Add patient details"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
        />
      </div>

      <div className="text-[12px] font-semibold text-text-secondary truncate max-w-[340px] text-center">
        {consultationLabel}
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
          disabled={isGeneratingNotes}
          className="bg-sand text-bark border border-border px-[18px] py-2 rounded-md text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-sand-dark transition-colors disabled:opacity-50"
        >
          {isGeneratingNotes ? (
            <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg> Generating...</>
          ) : (
            <>Generate Summary</>
          )}
        </button>
      </div>
    </div>
  );
}


import { Calendar, Globe } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

const statusHelp: Record<string, string> = {
  idle: 'Open Context and press Start Recording.',
  recording: 'Recording live. Press End session to finalize transcript and auto-generate notes.',
  processing: 'Processing audio and generating consultation output...',
  reviewing: 'Session ready. Switch template in Notes to regenerate.',
};

export default function TopBar() {
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const sessionTitle = useSessionStore((s) => s.sessionTitle);
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const encounterStatus = useSessionStore((s) => s.encounterStatus);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);

  const fallbackConsultationTitle = `${selectedTemplate} Consultation`;

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

      <div className="px-3 py-1.5 rounded-md border border-border bg-sand text-[11px] text-text-secondary max-w-[420px] truncate">
        {statusHelp[encounterStatus] || statusHelp.idle}
      </div>
    </div>
  );
}

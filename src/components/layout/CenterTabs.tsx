import { useSessionStore, type TabId } from '@/stores/useSessionStore';
import { useEncounterController } from '@/components/encounter/EncounterControllerProvider';
import { LayoutGrid, Activity, Pen, ClipboardList, MessagesSquare, Loader2 } from 'lucide-react';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'context', label: 'Context', icon: <LayoutGrid size={15} /> },
  { id: 'transcript', label: 'Transcript', icon: <Activity size={15} /> },
  { id: 'notes', label: 'Notes', icon: <Pen size={15} /> },
  { id: 'tasks', label: 'Tasks', icon: <ClipboardList size={15} /> },
  { id: 'chat', label: 'Chat', icon: <MessagesSquare size={15} /> },
];

export default function CenterTabs() {
  const {
    activeTab,
    setActiveTab,
    encounterStatus,
    finalTranscriptionStatus,
    transcript,
    interimTranscript,
    notes,
    activeSessionId,
  } = useSessionStore();
  const activeGenerationJob = useSessionStore((s) =>
    s.activeSessionId ? s.sessionGenerationJobs[s.activeSessionId] : null
  );
  const { isRecording, finalizeConsultation } = useEncounterController();
  const isFinalizing = encounterStatus === 'processing';
  const isGeneratingCurrentSession = activeGenerationJob?.status === 'running';
  const canFinalize =
    isRecording ||
    finalTranscriptionStatus === 'running' ||
    Boolean(activeSessionId && (transcript.trim() || interimTranscript.trim()));
  const hasGeneratedNotes = Boolean(notes.trim());
  const finalizeLabel = isRecording
    ? 'Finish Consultation'
    : hasGeneratedNotes
      ? 'Regenerate'
      : 'Finalize Consultation';

  return (
    <div className="flex items-center gap-0 px-5 bg-card border-b border-border">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-4 py-[11px] text-[13px] cursor-pointer border-b-2 transition-all duration-[120ms] ${
              isActive
                ? 'text-bark border-bark font-semibold'
                : 'text-text-muted border-transparent font-medium hover:text-text-primary'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={isActive ? 'opacity-80' : 'opacity-50'}>{tab.icon}</span>
            {tab.label}
          </div>
        );
      })}

      {/* Consultation finalization */}
      <div className="ml-auto flex items-center gap-1.5 px-2 py-[11px]">
        <button
          onClick={() => {
            void finalizeConsultation();
          }}
          disabled={!canFinalize || isFinalizing || isGeneratingCurrentSession}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border border-forest bg-forest text-primary-foreground hover:bg-forest-dark disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-[120ms]"
          title="Stop recording if needed, finish transcription, then generate notes and tasks"
        >
          {isFinalizing || finalTranscriptionStatus === 'running' || isGeneratingCurrentSession ? (
            <Loader2 size={13} className="animate-spin" />
          ) : null}
          {isFinalizing
            ? 'Finalizing...'
            : isGeneratingCurrentSession
              ? 'Regenerating...'
              : finalTranscriptionStatus === 'running'
              ? 'Finalize after transcript'
              : finalizeLabel}
        </button>
      </div>
    </div>
  );
}

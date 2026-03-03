import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomBar from '@/components/layout/BottomBar';
import CenterTabs from '@/components/layout/CenterTabs';
import TranscriptPanel from '@/components/panels/TranscriptPanel';
import NotesPanel from '@/components/panels/NotesPanel';
import ClientInstructionsPanel from '@/components/panels/ClientInstructionsPanel';
import TasksSidebar from '@/components/tasks/TasksSidebar';
import IdleView from '@/components/encounter/IdleView';
import RecordingView from '@/components/encounter/RecordingView';
import ProcessingView from '@/components/encounter/ProcessingView';
import { useSessionStore } from '@/stores/useSessionStore';
import { useEncounterPipeline } from '@/hooks/useEncounterPipeline';

const Index = () => {
  const { encounterStatus, activeTab, tasksOpen, toggleTasks } = useSessionStore();
  const { steps, startEncounter, endEncounter } = useEncounterPipeline();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {encounterStatus === 'reviewing' && <TopBar />}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-cream">
            {encounterStatus === 'idle' && (
              <IdleView onStartRecording={startEncounter} />
            )}
            {encounterStatus === 'recording' && (
              <RecordingView onStopRecording={endEncounter} />
            )}
            {encounterStatus === 'processing' && (
              <ProcessingView steps={steps} />
            )}
            {encounterStatus === 'reviewing' && (
              <>
                <CenterTabs />
                {activeTab === 'transcript' && <TranscriptPanel />}
                {activeTab === 'notes' && <NotesPanel />}
                {activeTab === 'client' && <ClientInstructionsPanel />}
              </>
            )}
          </div>
          {encounterStatus === 'reviewing' && tasksOpen && <TasksSidebar onClose={toggleTasks} />}
        </div>
        {encounterStatus === 'reviewing' && <BottomBar />}
      </div>
    </div>
  );
};

export default Index;

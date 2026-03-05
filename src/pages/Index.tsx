import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomBar from '@/components/layout/BottomBar';
import CenterTabs from '@/components/layout/CenterTabs';
import ContextPanel from '@/components/panels/ContextPanel';
import TranscriptPanel from '@/components/panels/TranscriptPanel';
import NotesPanel from '@/components/panels/NotesPanel';
import AllTasksPanel from '@/components/panels/AllTasksPanel';
import ChatPanel from '@/components/panels/ChatPanel';
import DictationPanel from '@/components/panels/DictationPanel';
import { useSessionStore } from '@/stores/useSessionStore';
import { EncounterControllerProvider } from '@/components/encounter/EncounterControllerProvider';

const Index = () => {
  const { activeTab } = useSessionStore();

  return (
    <EncounterControllerProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 bg-cream">
              <CenterTabs />
              {activeTab === 'context' && <ContextPanel />}
              {activeTab === 'transcript' && <TranscriptPanel />}
              {activeTab === 'notes' && <NotesPanel />}
              {activeTab === 'tasks' && <AllTasksPanel />}
              {activeTab === 'chat' && <ChatPanel />}
              {activeTab === 'dictation' && <DictationPanel />}
            </div>
          </div>
          <BottomBar />
        </div>
      </div>
    </EncounterControllerProvider>
  );
};

export default Index;

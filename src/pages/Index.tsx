import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomBar from '@/components/layout/BottomBar';
import CenterTabs from '@/components/layout/CenterTabs';
import ContextPanel from '@/components/panels/ContextPanel';
import TranscriptPanel from '@/components/panels/TranscriptPanel';
import NotesPanel from '@/components/panels/NotesPanel';
import ClientInstructionsPanel from '@/components/panels/ClientInstructionsPanel';
import TasksSidebar from '@/components/tasks/TasksSidebar';
import { useSessionStore } from '@/stores/useSessionStore';

const Index = () => {
  const { activeTab, tasksOpen, toggleTasks } = useSessionStore();

  return (
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
            {activeTab === 'client' && <ClientInstructionsPanel />}
          </div>
          {tasksOpen && <TasksSidebar onClose={toggleTasks} />}
        </div>
        <BottomBar />
      </div>
    </div>
  );
};

export default Index;

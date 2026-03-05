import { useSessionStore, type TabId } from '@/stores/useSessionStore';
import { LayoutGrid, Activity, Pen, ClipboardList, MessagesSquare, Mic } from 'lucide-react';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'context', label: 'Context', icon: <LayoutGrid size={15} /> },
  { id: 'transcript', label: 'Transcript', icon: <Activity size={15} /> },
  { id: 'notes', label: 'Notes', icon: <Pen size={15} /> },
  { id: 'tasks', label: 'Tasks', icon: <ClipboardList size={15} /> },
  { id: 'chat', label: 'Chat', icon: <MessagesSquare size={15} /> },
  { id: 'dictation', label: 'Dictation', icon: <Mic size={15} /> },
];

export default function CenterTabs() {
  const { activeTab, setActiveTab, selectedTemplate } = useSessionStore();

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

      {/* Template indicator */}
      <div className="ml-auto flex items-center gap-1.5 px-2 py-[11px]">
        <span className="text-[12px] font-medium text-text-muted">{selectedTemplate}</span>
      </div>
    </div>
  );
}

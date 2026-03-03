import { useSessionStore, type TabId } from '@/stores/useSessionStore';
import { LayoutGrid, Activity, Pen, FileText } from 'lucide-react';

const templates = ['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check'];

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'context', label: 'Context', icon: <LayoutGrid size={15} /> },
  { id: 'transcript', label: 'Transcript', icon: <Activity size={15} /> },
  { id: 'notes', label: '', icon: <Pen size={15} /> }, // Template dropdown
  { id: 'client', label: 'Client Instructions', icon: <FileText size={15} /> },
];

export default function CenterTabs() {
  const { activeTab, setActiveTab, selectedTemplate, setSelectedTemplate } = useSessionStore();

  return (
    <div className="flex items-center gap-0 px-5 bg-card border-b border-border">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        if (tab.id === 'notes') {
          return (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-[11px] text-[13px] cursor-pointer border-b-2 transition-all duration-[120ms] ${
                isActive
                  ? 'text-bark border-bark font-semibold'
                  : 'text-text-muted border-transparent font-medium hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('notes')}
            >
              <span className={isActive ? 'opacity-80' : 'opacity-50'}>{tab.icon}</span>
              <select
                className="appearance-none bg-transparent border-none outline-none text-[13px] font-semibold text-bark cursor-pointer pr-4"
                value={selectedTemplate}
                onChange={(e) => { e.stopPropagation(); setSelectedTemplate(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
              >
                {templates.map((t) => (
                  <option key={t} className="font-medium">{t}</option>
                ))}
              </select>
              <svg className="w-[10px] h-[10px] text-bark-muted -ml-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          );
        }
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
      <div className="px-3 py-[11px] text-base text-text-muted cursor-pointer hover:text-text-primary">+</div>
    </div>
  );
}

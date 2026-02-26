import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Task {
  text: string;
  assignee: 'VET' | 'NURSE' | 'ADMIN';
  done: boolean;
}

interface TaskSection {
  icon: string;
  title: string;
  tasks: Task[];
}

const initialSections: TaskSection[] = [
  {
    icon: '💊', title: 'Prescriptions',
    tasks: [
      { text: 'Maropitant injection — given today', assignee: 'VET', done: true },
      { text: 'Omeprazole 1 tab PO BID x5 days', assignee: 'VET', done: false },
    ],
  },
  {
    icon: '🔬', title: 'Diagnostics',
    tasks: [
      { text: 'In-house haematology and biochemistry', assignee: 'NURSE', done: false },
      { text: 'Abdominal ultrasound', assignee: 'VET', done: false },
    ],
  },
  {
    icon: '📅', title: 'Follow-up',
    tasks: [
      { text: 'Recheck in 24 hours — hydration and appetite', assignee: 'VET', done: false },
      { text: 'Further diagnostics if symptoms persist >48hrs', assignee: 'VET', done: false },
    ],
  },
  {
    icon: '📝', title: 'Admin',
    tasks: [
      { text: 'Prepare estimate: bloods, ultrasound, hospitalisation', assignee: 'ADMIN', done: false },
      { text: 'Monitor in hospital min 24 hrs', assignee: 'NURSE', done: false },
    ],
  },
];

const assigneeColors: Record<string, string> = {
  VET: 'bg-[#e8f0e5] text-forest',
  NURSE: 'bg-[#e5ecf5] text-[#3565a0]',
  ADMIN: 'bg-[#f5e8ec] text-[#a03555]',
};

export default function TasksSidebar({ onClose }: { onClose: () => void }) {
  const [sections, setSections] = useState(initialSections);

  const toggleTask = (sIdx: number, tIdx: number) => {
    setSections((prev) =>
      prev.map((s, si) =>
        si === sIdx
          ? { ...s, tasks: s.tasks.map((t, ti) => (ti === tIdx ? { ...t, done: !t.done } : t)) }
          : s
      )
    );
  };

  return (
    <div className="w-[300px] bg-card border-l border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-bark">Tasks</span>
          <span className="text-[9px] font-bold bg-sand text-text-muted px-[7px] py-0.5 rounded uppercase tracking-[0.3px]">Beta</span>
        </div>
        <button
          onClick={onClose}
          className="bg-transparent border-none cursor-pointer text-text-muted text-lg p-1 rounded hover:bg-sand hover:text-text-primary"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {sections.map((section, sIdx) => (
          <div key={section.title} className="mb-4">
            <div className="flex items-center gap-[7px] mb-1.5 px-1">
              <span className="text-[13px]">{section.icon}</span>
              <span className="text-xs font-bold text-bark">{section.title}</span>
              <span className="text-[11px] text-text-muted ml-auto">{section.tasks.length}</span>
            </div>
            {section.tasks.map((task, tIdx) => (
              <div key={tIdx} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-sand transition-colors duration-100 cursor-default">
                <div
                  className={`w-4 h-4 border-2 rounded mt-px flex items-center justify-center cursor-pointer transition-all duration-100 shrink-0 ${
                    task.done ? 'bg-forest border-forest' : 'border-border'
                  }`}
                  onClick={() => toggleTask(sIdx, tIdx)}
                >
                  {task.done && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                </div>
                <span className={`text-xs flex-1 leading-[1.4] ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {task.text}
                </span>
                <span className={`text-[9px] font-bold px-[7px] py-0.5 rounded-[10px] shrink-0 mt-px uppercase tracking-[0.3px] ${assigneeColors[task.assignee]}`}>
                  {task.assignee}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="px-3 pb-2">
        <button className="flex items-center gap-1.5 px-3 py-2 w-full bg-sand border border-dashed border-border rounded-md text-xs font-medium text-text-muted cursor-pointer hover:bg-sand-dark hover:text-text-primary hover:border-solid transition-all">
          <Plus size={14} /> New task
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border-light text-[11px] text-text-muted text-center">
        Stale tasks will be archived in 30 days
      </div>
    </div>
  );
}

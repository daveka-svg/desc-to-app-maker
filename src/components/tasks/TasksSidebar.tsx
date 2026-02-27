import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useSessionStore, type Task } from '@/stores/useSessionStore';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';

const categoryConfig = [
  { key: 'prescriptions', icon: '💊', title: 'Prescriptions' },
  { key: 'diagnostics', icon: '🔬', title: 'Diagnostics' },
  { key: 'followup', icon: '📅', title: 'Follow-up' },
  { key: 'admin', icon: '📝', title: 'Admin' },
] as const;

const assigneeColors: Record<string, string> = {
  Vet: 'bg-[#e8f0e5] text-forest',
  Nurse: 'bg-[#e5ecf5] text-[#3565a0]',
  Admin: 'bg-[#f5e8ec] text-[#a03555]',
};

export default function TasksSidebar({ onClose }: { onClose: () => void }) {
  const tasks = useSessionStore((s) => s.tasks);
  const toggleTask = useSessionStore((s) => s.toggleTask);
  const addTask = useSessionStore((s) => s.addTask);
  const { extractTasks, isExtractingTasks } = useTaskExtraction();
  const [newTaskText, setNewTaskText] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);

  const grouped = categoryConfig.map((cat) => ({
    ...cat,
    tasks: tasks.filter((t) => t.category === cat.key),
  }));

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    addTask({ text: newTaskText, category: 'admin', assignee: 'Vet', done: false });
    setNewTaskText('');
    setShowNewTask(false);
  };

  return (
    <div className="w-[300px] bg-card border-l border-border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border-light">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-bark">Tasks</span>
          <span className="text-[9px] font-bold bg-sand text-text-muted px-[7px] py-0.5 rounded uppercase tracking-[0.3px]">Beta</span>
        </div>
        <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-muted text-lg p-1 rounded hover:bg-sand hover:text-text-primary">×</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {tasks.length === 0 && !isExtractingTasks ? (
          <div className="text-center py-8 text-xs text-text-muted">
            <p className="mb-3">No tasks yet.</p>
            <p>Generate notes first, then tasks will be auto-extracted.</p>
          </div>
        ) : isExtractingTasks ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-forest font-semibold">
            <Loader2 size={14} className="animate-spin" /> Extracting tasks...
          </div>
        ) : (
          grouped.filter((g) => g.tasks.length > 0).map((section) => (
            <div key={section.key} className="mb-4">
              <div className="flex items-center gap-[7px] mb-1.5 px-1">
                <span className="text-[13px]">{section.icon}</span>
                <span className="text-xs font-bold text-bark">{section.title}</span>
                <span className="text-[11px] text-text-muted ml-auto">{section.tasks.length}</span>
              </div>
              {section.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-sand transition-colors duration-100 cursor-default">
                  <div
                    className={`w-4 h-4 border-2 rounded mt-px flex items-center justify-center cursor-pointer transition-all duration-100 shrink-0 ${
                      task.done ? 'bg-forest border-forest' : 'border-border'
                    }`}
                    onClick={() => toggleTask(task.id)}
                  >
                    {task.done && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                  </div>
                  <span className={`text-xs flex-1 leading-[1.4] ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{task.text}</span>
                  <span className={`text-[9px] font-bold px-[7px] py-0.5 rounded-[10px] shrink-0 mt-px uppercase tracking-[0.3px] ${assigneeColors[task.assignee] || ''}`}>{task.assignee}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="px-3 pb-2">
        {showNewTask ? (
          <div className="flex gap-1.5">
            <input
              className="flex-1 px-2.5 py-1.5 border border-border rounded-md text-xs outline-none bg-card focus:border-bark-muted"
              placeholder="New task..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              autoFocus
            />
            <button onClick={handleAddTask} className="px-2.5 py-1.5 bg-forest text-primary-foreground rounded-md text-xs font-semibold">Add</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1.5 px-3 py-2 w-full bg-sand border border-dashed border-border rounded-md text-xs font-medium text-text-muted cursor-pointer hover:bg-sand-dark hover:text-text-primary hover:border-solid transition-all"
          >
            <Plus size={14} /> New task
          </button>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border-light text-[11px] text-text-muted text-center">
        Stale tasks will be archived in 30 days
      </div>
    </div>
  );
}

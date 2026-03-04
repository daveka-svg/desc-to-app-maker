import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore } from '@/stores/useSessionStore';

interface DBTask {
  id: string;
  text: string;
  category: string | null;
  assignee: string | null;
  done: boolean | null;
  session_id: string;
  created_at: string;
  session?: { patient_name: string | null; session_type: string | null };
}

const categoryConfig = [
  { key: 'prescriptions', icon: '💊', title: 'Prescriptions' },
  { key: 'diagnostics', icon: '🔬', title: 'Diagnostics' },
  { key: 'followup', icon: '📅', title: 'Follow-up' },
  { key: 'admin', icon: '📝', title: 'Admin' },
] as const;

const assigneeColors: Record<string, string> = {
  Vet: 'bg-sand text-bark',
  Nurse: 'bg-sand-dark text-text-primary',
  Admin: 'bg-sand-deeper text-text-primary',
};

export default function AllTasksPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'prescriptions' | 'diagnostics' | 'followup' | 'admin'>('admin');
  const [newTaskAssignee, setNewTaskAssignee] = useState<'Vet' | 'Nurse' | 'Admin'>('Vet');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    fetchAllTasks();
    const handler = () => fetchAllTasks();
    window.addEventListener('session-saved', handler);
    return () => window.removeEventListener('session-saved', handler);
  }, []);

  const fetchAllTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*, sessions!tasks_session_id_fkey(patient_name, session_type)')
      .order('created_at', { ascending: false });

    if (data) {
      setTasks(data.map((t: any) => ({ ...t, session: t.sessions })));
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string, currentDone: boolean) => {
    await supabase.from('tasks').update({ done: !currentDone }).eq('id', taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: !currentDone } : t)));
  };

  const addManualTask = async () => {
    if (!newTaskText.trim() || !activeSessionId) return;

    setIsAddingTask(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setIsAddingTask(false);
      return;
    }

    const { error } = await supabase.from('tasks').insert({
      user_id: userId,
      session_id: activeSessionId,
      text: newTaskText.trim(),
      category: newTaskCategory,
      assignee: newTaskAssignee,
      done: false,
    });

    setIsAddingTask(false);
    if (!error) {
      setNewTaskText('');
      await fetchAllTasks();
      window.dispatchEvent(new Event('session-saved'));
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'pending') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const grouped = categoryConfig.map((cat) => ({
    ...cat,
    tasks: filtered.filter((t) => (t.category || 'admin') === cat.key),
  }));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4 p-3 rounded-lg border border-border-light bg-card space-y-2">
        <div className="text-xs font-semibold text-text-secondary">Add task manually</div>
        <input
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder={activeSessionId ? 'Type a task…' : 'Open a consultation first to add tasks'}
          disabled={!activeSessionId || isAddingTask}
          className="w-full px-3 py-2 border border-border rounded-md text-xs bg-sand text-text-primary disabled:opacity-50"
        />
        <div className="grid grid-cols-3 gap-2">
          <select
            value={newTaskCategory}
            onChange={(e) => setNewTaskCategory(e.target.value as any)}
            disabled={!activeSessionId || isAddingTask}
            className="px-2 py-2 border border-border rounded-md text-xs bg-sand"
          >
            {categoryConfig.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
          </select>
          <select
            value={newTaskAssignee}
            onChange={(e) => setNewTaskAssignee(e.target.value as any)}
            disabled={!activeSessionId || isAddingTask}
            className="px-2 py-2 border border-border rounded-md text-xs bg-sand"
          >
            <option value="Vet">Vet</option>
            <option value="Nurse">Nurse</option>
            <option value="Admin">Admin</option>
          </select>
          <button
            onClick={addManualTask}
            disabled={!activeSessionId || !newTaskText.trim() || isAddingTask}
            className="px-3 py-2 text-xs font-semibold rounded-md bg-forest text-primary-foreground disabled:opacity-50"
          >
            {isAddingTask ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-bark">All Tasks</h2>
        <div className="flex gap-1">
          {(['all', 'pending', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f ? 'bg-forest text-primary-foreground' : 'bg-sand text-text-muted hover:text-text-primary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs text-text-muted">
          <p>No tasks found.</p>
        </div>
      ) : (
        grouped
          .filter((g) => g.tasks.length > 0)
          .map((section) => (
            <div key={section.key} className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[14px]">{section.icon}</span>
                <span className="text-[13px] font-bold text-bark">{section.title}</span>
                <span className="text-[11px] text-text-muted ml-auto">{section.tasks.length}</span>
              </div>
              <div className="space-y-1">
                {section.tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-sand transition-colors bg-card border border-border-light">
                    <div
                      className={`w-4 h-4 border-2 rounded mt-0.5 flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                        task.done ? 'bg-forest border-forest' : 'border-border'
                      }`}
                      onClick={() => toggleTask(task.id, !!task.done)}
                    >
                      {task.done && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs leading-relaxed ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {task.text}
                      </span>
                      {task.session && (
                        <div className="text-[10px] text-text-muted mt-0.5">{task.session.patient_name || task.session.session_type || 'Session'}</div>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-[10px] shrink-0 mt-0.5 uppercase tracking-[0.3px] ${assigneeColors[task.assignee || 'Vet'] || ''}`}>
                      {task.assignee || 'Vet'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

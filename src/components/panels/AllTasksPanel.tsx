import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore } from '@/stores/useSessionStore';
import { useToast } from '@/hooks/use-toast';

type Assignee = 'Vet' | 'Nurse' | 'Admin';
type TaskCategory = 'prescriptions' | 'diagnostics' | 'followup' | 'admin';

interface SessionMeta {
  id: string;
  title: string | null;
  patient_name: string | null;
  session_type: string | null;
  created_at: string;
  duration_seconds: number | null;
}

interface DBTask {
  id: string;
  text: string;
  category: TaskCategory | null;
  assignee: Assignee | null;
  done: boolean | null;
  deadline_at: string | null;
  session_id: string;
  created_at: string;
  order_index: number | null;
  session?: SessionMeta | null;
}

interface EditingTaskState {
  id: string;
  text: string;
  assignee: Assignee;
  category: TaskCategory;
  deadline: string;
}

const categoryLabel: Record<TaskCategory, string> = {
  prescriptions: 'Prescription',
  diagnostics: 'Diagnostic',
  followup: 'Follow-up',
  admin: 'Admin',
};

const assigneeTagClass: Record<Assignee, string> = {
  Vet: 'bg-[#e8f0e5] text-forest',
  Nurse: 'bg-[#e5ecf5] text-[#3565a0]',
  Admin: 'bg-[#f5e8ec] text-[#a03555]',
};

const sortByOrder = (a: DBTask, b: DBTask) => {
  const aOrder = a.order_index ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.order_index ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
};

const toIsoOrNull = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toInputDateTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDeadline = (deadline: string | null): string | null => {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const sessionLabel = (session: SessionMeta | null | undefined): string => {
  if (!session) return 'Session';
  if (session.title?.trim()) return session.title.trim();
  const date = new Date(session.created_at);
  const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const timeLabel = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const prefix = session.patient_name || session.session_type || 'Consultation';
  return `${prefix} - ${dateLabel} ${timeLabel}`;
};

export default function AllTasksPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { toast } = useToast();
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('admin');
  const [newTaskAssignee, setNewTaskAssignee] = useState<Assignee>('Vet');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<EditingTaskState | null>(null);

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
      .select('id, text, category, assignee, done, deadline_at, session_id, created_at, order_index, sessions!tasks_session_id_fkey(id, title, patient_name, session_type, created_at, duration_seconds)')
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = data.map((task: any) => ({
        ...task,
        assignee: (task.assignee || 'Vet') as Assignee,
        category: (task.category || 'admin') as TaskCategory,
        session: task.sessions || null,
      })) as DBTask[];
      setTasks(mapped.sort(sortByOrder));
    }
    setLoading(false);
  };

  const updateTaskDone = async (taskId: string, nextDone: boolean) => {
    const { error } = await supabase.from('tasks').update({ done: nextDone }).eq('id', taskId);
    if (error) {
      toast({
        title: 'Task update failed',
        description: 'Could not update task status.',
        variant: 'destructive',
      });
      return;
    }
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, done: nextDone } : task)));
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete task.',
        variant: 'destructive',
      });
      return;
    }
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    window.dispatchEvent(new Event('session-saved'));
  };

  const deleteVisibleTasks = async () => {
    if (visibleTasks.length === 0) return;
    const confirmed = window.confirm(`Delete ${visibleTasks.length} visible task(s)? This cannot be undone.`);
    if (!confirmed) return;

    const ids = visibleTasks.map((task) => task.id);
    const { error } = await supabase.from('tasks').delete().in('id', ids);
    if (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete the selected tasks.',
        variant: 'destructive',
      });
      return;
    }
    setTasks((prev) => prev.filter((task) => !ids.includes(task.id)));
    window.dispatchEvent(new Event('session-saved'));
  };

  const addManualTask = async () => {
    if (!newTaskText.trim() || !activeSessionId) return;
    setIsAddingTask(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsAddingTask(false);
      return;
    }

    const sessionTasks = tasks.filter((task) => task.session_id === activeSessionId);
    const nextOrderIndex =
      sessionTasks.length > 0
        ? Math.max(...sessionTasks.map((task) => task.order_index || 0)) + 1
        : 1;

    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      session_id: activeSessionId,
      text: newTaskText.trim(),
      category: newTaskCategory,
      assignee: newTaskAssignee,
      done: false,
      order_index: nextOrderIndex,
      deadline_at: toIsoOrNull(newTaskDeadline),
    });

    setIsAddingTask(false);
    if (!error) {
      setNewTaskText('');
      setNewTaskDeadline('');
      await fetchAllTasks();
      window.dispatchEvent(new Event('session-saved'));
    } else {
      toast({
        title: 'Add task failed',
        description: error.message || 'Could not add task.',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (task: DBTask) => {
    setEditingTask({
      id: task.id,
      text: task.text,
      assignee: (task.assignee || 'Vet') as Assignee,
      category: (task.category || 'admin') as TaskCategory,
      deadline: toInputDateTime(task.deadline_at),
    });
  };

  const cancelEditing = () => setEditingTask(null);

  const saveEdit = async () => {
    if (!editingTask) return;
    const trimmedText = editingTask.text.trim();
    if (!trimmedText) {
      toast({
        title: 'Task text required',
        description: 'Please enter task text before saving.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      text: trimmedText,
      assignee: editingTask.assignee,
      category: editingTask.category,
      deadline_at: toIsoOrNull(editingTask.deadline),
    };

    const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
    if (error) {
      toast({
        title: 'Save failed',
        description: error.message || 'Could not save task edits.',
        variant: 'destructive',
      });
      return;
    }
    setTasks((prev) =>
      prev.map((task) =>
        task.id === editingTask.id
          ? {
              ...task,
              text: payload.text,
              assignee: payload.assignee,
              category: payload.category,
              deadline_at: payload.deadline_at,
            }
          : task
      )
    );
    setEditingTask(null);
    window.dispatchEvent(new Event('session-saved'));
  };

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === 'pending') return !task.done;
      if (filter === 'done') return !!task.done;
      return true;
    });
  }, [filter, tasks]);

  const groupedBySession = useMemo(() => {
    const map = new Map<string, { session: SessionMeta | null; tasks: DBTask[] }>();
    for (const task of visibleTasks) {
      const key = task.session_id;
      if (!map.has(key)) {
        map.set(key, {
          session: task.session || null,
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(task);
    }

    return Array.from(map.entries())
      .map(([sessionId, group]) => ({
        sessionId,
        session: group.session,
        tasks: group.tasks.sort(sortByOrder),
      }))
      .sort((a, b) => {
        const aTime = a.session?.created_at ? new Date(a.session.created_at).getTime() : 0;
        const bTime = b.session?.created_at ? new Date(b.session.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [visibleTasks]);

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
          onChange={(event) => setNewTaskText(event.target.value)}
          placeholder={activeSessionId ? 'Type a task...' : 'Open a consultation first to add tasks'}
          disabled={!activeSessionId || isAddingTask}
          className="w-full px-3 py-2 border border-border rounded-md text-xs bg-sand text-text-primary disabled:opacity-50"
        />
        <div className="grid grid-cols-5 gap-2">
          <select
            value={newTaskCategory}
            onChange={(event) => setNewTaskCategory(event.target.value as TaskCategory)}
            disabled={!activeSessionId || isAddingTask}
            className="px-2 py-2 border border-border rounded-md text-xs bg-sand"
          >
            <option value="prescriptions">Prescriptions</option>
            <option value="diagnostics">Diagnostics</option>
            <option value="followup">Follow-up</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={newTaskAssignee}
            onChange={(event) => setNewTaskAssignee(event.target.value as Assignee)}
            disabled={!activeSessionId || isAddingTask}
            className="px-2 py-2 border border-border rounded-md text-xs bg-sand"
          >
            <option value="Vet">Vet</option>
            <option value="Nurse">Nurse</option>
            <option value="Admin">Admin</option>
          </select>
          <input
            type="datetime-local"
            value={newTaskDeadline}
            onChange={(event) => setNewTaskDeadline(event.target.value)}
            disabled={!activeSessionId || isAddingTask}
            className="px-2 py-2 border border-border rounded-md text-xs bg-sand"
            title="Optional deadline"
          />
          <div className="text-[10px] text-text-muted flex items-center">Deadline optional</div>
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
        <h2 className="text-[15px] font-bold text-bark">Tasks by Appointment</h2>
        <div className="flex gap-1.5 items-center">
          <button
            onClick={deleteVisibleTasks}
            disabled={visibleTasks.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-border bg-card text-error hover:bg-sand disabled:opacity-40"
            title="Delete all visible tasks"
          >
            <Trash2 size={12} />
            Delete All
          </button>
          {(['all', 'pending', 'done'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === value
                  ? 'bg-forest text-primary-foreground'
                  : 'bg-sand text-text-muted hover:text-text-primary'
              }`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {groupedBySession.length === 0 ? (
        <div className="rounded-lg border border-border-light bg-card px-4 py-6 text-xs text-text-muted text-center">
          No tasks available for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySession.map((group) => (
            <section key={group.sessionId} className="rounded-lg border border-border-light bg-card">
              <header className="px-3 py-2 border-b border-border-light">
                <div className="text-[13px] font-semibold text-text-primary">{sessionLabel(group.session)}</div>
                <div className="text-[11px] text-text-muted">
                  {group.session?.session_type || 'General Consult'} •{' '}
                  {group.session?.created_at
                    ? new Date(group.session.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unknown time'} • {formatDuration(group.session?.duration_seconds ?? 0)}
                </div>
              </header>

              <div className="p-2 space-y-2">
                {group.tasks.map((task) => {
                  const isEditing = editingTask?.id === task.id;
                  const assignee = (task.assignee || 'Vet') as Assignee;
                  const category = (task.category || 'admin') as TaskCategory;
                  return (
                    <div key={task.id} className="rounded-md border border-border-light bg-sand px-2.5 py-2 text-xs">
                      {isEditing && editingTask ? (
                        <div className="space-y-2">
                          <input
                            value={editingTask.text}
                            onChange={(event) => setEditingTask({ ...editingTask, text: event.target.value })}
                            className="w-full px-2 py-1.5 rounded-md border border-border bg-card"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              value={editingTask.assignee}
                              onChange={(event) =>
                                setEditingTask({ ...editingTask, assignee: event.target.value as Assignee })
                              }
                              className="px-2 py-1.5 rounded-md border border-border bg-card"
                            >
                              <option value="Vet">Vet</option>
                              <option value="Nurse">Nurse</option>
                              <option value="Admin">Admin</option>
                            </select>
                            <select
                              value={editingTask.category}
                              onChange={(event) =>
                                setEditingTask({ ...editingTask, category: event.target.value as TaskCategory })
                              }
                              className="px-2 py-1.5 rounded-md border border-border bg-card"
                            >
                              <option value="prescriptions">Prescriptions</option>
                              <option value="diagnostics">Diagnostics</option>
                              <option value="followup">Follow-up</option>
                              <option value="admin">Admin</option>
                            </select>
                            <input
                              type="datetime-local"
                              value={editingTask.deadline}
                              onChange={(event) => setEditingTask({ ...editingTask, deadline: event.target.value })}
                              className="px-2 py-1.5 rounded-md border border-border bg-card"
                            />
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={cancelEditing}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-card"
                            >
                              <X size={11} /> Cancel
                            </button>
                            <button
                              onClick={saveEdit}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-forest text-primary-foreground"
                            >
                              <Save size={11} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!task.done}
                            onChange={() => updateTaskDone(task.id, !task.done)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`leading-relaxed ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                              {task.text}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${assigneeTagClass[assignee]}`}>
                                {assignee}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border text-text-muted">
                                {categoryLabel[category]}
                              </span>
                              {task.deadline_at && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#fff5ea] border border-[#f0c89a] text-warning">
                                  Due {formatDeadline(task.deadline_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              title="Edit task"
                              onClick={() => startEditing(task)}
                              className="p-1 rounded hover:bg-card"
                            >
                              <Pencil size={12} className="text-text-muted" />
                            </button>
                            <button
                              title="Delete task"
                              onClick={() => deleteTask(task.id)}
                              className="p-1 rounded hover:bg-card"
                            >
                              <Trash2 size={12} className="text-error" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}



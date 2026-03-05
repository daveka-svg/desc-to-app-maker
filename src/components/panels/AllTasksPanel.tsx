import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore } from '@/stores/useSessionStore';

type Assignee = 'Vet' | 'Nurse' | 'Admin';

interface DBTask {
  id: string;
  text: string;
  category: string | null;
  assignee: Assignee | null;
  done: boolean | null;
  session_id: string;
  created_at: string;
  order_index: number | null;
  session?: { patient_name: string | null; session_type: string | null };
}

const assigneeColumns: Array<{ assignee: Assignee; title: string; accent: string }> = [
  { assignee: 'Vet', title: 'Vet', accent: 'border-forest' },
  { assignee: 'Nurse', title: 'Nurse', accent: 'border-[#3565a0]' },
  { assignee: 'Admin', title: 'Admin', accent: 'border-bark-muted' },
];

const categoryLabel: Record<string, string> = {
  prescriptions: 'Prescriptions',
  diagnostics: 'Diagnostics',
  followup: 'Follow-up',
  admin: 'Admin',
};

const sortByOrder = (a: DBTask, b: DBTask) => {
  const aOrder = a.order_index ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.order_index ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
};

export default function AllTasksPanel() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'prescriptions' | 'diagnostics' | 'followup' | 'admin'>('admin');
  const [newTaskAssignee, setNewTaskAssignee] = useState<Assignee>('Vet');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

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
      .order('created_at', { ascending: true });

    if (data) {
      const mapped = data.map((task: any) => ({
        ...task,
        assignee: (task.assignee || 'Vet') as Assignee,
        session: task.sessions,
      })) as DBTask[];
      setTasks(mapped.sort(sortByOrder));
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string, currentDone: boolean) => {
    await supabase.from('tasks').update({ done: !currentDone }).eq('id', taskId);
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, done: !currentDone } : task)));
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
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

    const assigneeTasks = tasks.filter((task) => (task.assignee || 'Vet') === newTaskAssignee);
    const nextOrderIndex =
      assigneeTasks.length > 0
        ? Math.max(...assigneeTasks.map((task) => task.order_index || 0)) + 1
        : 1;

    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      session_id: activeSessionId,
      text: newTaskText.trim(),
      category: newTaskCategory,
      assignee: newTaskAssignee,
      done: false,
      order_index: nextOrderIndex,
    });

    setIsAddingTask(false);
    if (!error) {
      setNewTaskText('');
      await fetchAllTasks();
      window.dispatchEvent(new Event('session-saved'));
    }
  };

  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        if (filter === 'pending') return !task.done;
        if (filter === 'done') return !!task.done;
        return true;
      }),
    [filter, tasks]
  );

  const getColumnTasks = (assignee: Assignee) =>
    filtered.filter((task) => (task.assignee || 'Vet') === assignee).sort(sortByOrder);

  const persistOrder = async (nextTasks: DBTask[], assignees: Assignee[]) => {
    const updates: Array<PromiseLike<any>> = [];
    for (const assignee of assignees) {
      const columnTasks = nextTasks
        .filter((task) => (task.assignee || 'Vet') === assignee)
        .sort(sortByOrder)
        .map((task, index) => ({ ...task, assignee, order_index: index + 1 }));

      for (const task of columnTasks) {
        const p = supabase
          .from('tasks')
          .update({ assignee: task.assignee, order_index: task.order_index } as any)
          .eq('id', task.id)
          .then();
        updates.push(p);
      }
    }
    await Promise.all(updates);
  };

  const moveTaskToAssignee = async (taskId: string, targetAssignee: Assignee) => {
    const draggedTask = tasks.find((task) => task.id === taskId);
    if (!draggedTask) return;

    const sourceAssignee = (draggedTask.assignee || 'Vet') as Assignee;
    const currentTargetTasks = tasks
      .filter((task) => (task.assignee || 'Vet') === targetAssignee && task.id !== taskId)
      .sort(sortByOrder);
    const nextOrderIndex =
      currentTargetTasks.length > 0
        ? (currentTargetTasks[currentTargetTasks.length - 1].order_index || currentTargetTasks.length) + 1
        : 1;

    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, assignee: targetAssignee, order_index: nextOrderIndex } : task
    );
    setTasks(nextTasks.sort(sortByOrder));

    await persistOrder(nextTasks, sourceAssignee === targetAssignee ? [targetAssignee] : [sourceAssignee, targetAssignee]);
  };

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
        <div className="grid grid-cols-4 gap-2">
          <select
            value={newTaskCategory}
            onChange={(event) => setNewTaskCategory(event.target.value as any)}
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
          <div />
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
        <h2 className="text-[15px] font-bold text-bark">Team Tasks Board</h2>
        <div className="flex gap-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {assigneeColumns.map((column) => {
          const columnTasks = getColumnTasks(column.assignee);
          return (
            <div
              key={column.assignee}
              onDragOver={(event) => event.preventDefault()}
              onDrop={async () => {
                if (!draggingTaskId) return;
                await moveTaskToAssignee(draggingTaskId, column.assignee);
                setDraggingTaskId(null);
                setNewTaskAssignee(column.assignee);
              }}
              className={`rounded-lg border ${column.accent} bg-card min-h-[260px]`}
            >
              <div className="px-3 py-2 border-b border-border-light flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">{column.title}</span>
                <span className="text-[11px] text-text-muted">{columnTasks.length}</span>
              </div>
              <div className="p-2 space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="text-[11px] text-text-muted text-center py-6">Drop tasks here</div>
                ) : (
                  columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggingTaskId(task.id)}
                      onDragEnd={() => setDraggingTaskId(null)}
                      className="rounded-md border border-border-light bg-sand px-2.5 py-2 text-xs cursor-grab"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={!!task.done}
                          onChange={() => toggleTask(task.id, !!task.done)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`leading-relaxed ${task.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                            {task.text}
                          </div>
                          <div className="mt-1 text-[10px] text-text-muted flex items-center justify-between gap-2">
                            <span>{categoryLabel[task.category || 'admin'] || 'General'}</span>
                            <span className="truncate">
                              {task.session?.patient_name || task.session?.session_type || 'Session'}
                            </span>
                          </div>
                        </div>
                        <button
                          title="Delete task"
                          onClick={() => deleteTask(task.id)}
                          className="p-1 rounded hover:bg-card"
                        >
                          <Trash2 size={12} className="text-error" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

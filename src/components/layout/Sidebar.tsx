import { Pen, ClipboardList, Book, Settings } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';

export default function Sidebar() {
  const tasksOpen = useSessionStore((s) => s.tasksOpen);
  const toggleTasks = useSessionStore((s) => s.toggleTasks);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSession = useSessionStore((s) => s.loadSession);
  const newSession = useSessionStore((s) => s.newSession);
  const tasks = useSessionStore((s) => s.tasks);

  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const d = new Date(s.createdAt).toLocaleDateString('en-GB');
    (acc[d] ||= []).push(s);
    return acc;
  }, {});

  return (
    <aside className="w-[220px] bg-card border-r border-border flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3.5">
        <img src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg" alt="ETV" className="h-[26px]" />
        <span className="text-[9px] font-bold bg-sand text-bark-muted px-1.5 py-0.5 rounded tracking-wide uppercase">Scribe</span>
      </div>

      <button onClick={newSession} className="mx-3 mb-3 py-2.5 px-4 bg-forest text-primary-foreground border-none rounded-md text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-forest-dark transition-colors duration-150">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        New session
      </button>

      <nav className="px-2 flex flex-col gap-px">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer bg-sand-dark text-bark">
          <Pen size={17} className="opacity-100 shrink-0" /> Scribe
        </div>
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand hover:text-text-primary transition-all duration-100" onClick={toggleTasks}>
          <ClipboardList size={17} className="opacity-65 shrink-0" /> Tasks
          {tasks.length > 0 && <span className="ml-auto text-[10px] font-bold bg-etv-pink text-bark px-[7px] py-px rounded-[10px]">{tasks.length}</span>}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto border-t border-border-light mt-2.5">
        <div className="flex px-4 pt-2.5 gap-0">
          <div className="px-3.5 py-1.5 text-xs font-semibold text-text-muted cursor-pointer border-b-2 border-transparent">Upcoming</div>
          <div className="px-3.5 py-1.5 text-xs font-semibold text-bark cursor-pointer border-b-2 border-bark">Past</div>
        </div>
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-xs text-text-muted text-center">No sessions yet.<br />Click "New session" to start.</div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase">{date}</div>
              {items.map((s) => (
                <div key={s.id} className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors duration-100 ${s.id === activeSessionId ? 'bg-sand-dark' : 'hover:bg-sand'}`} onClick={() => loadSession(s.id)}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.id === activeSessionId ? 'bg-etv-olive' : 'bg-text-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text-primary truncate">{s.patientName || s.consultType || 'Session'}</div>
                    <div className="text-[11px] text-text-muted">{new Date(s.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border-light">
        <nav className="px-2 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted px-2.5 pt-3 pb-1">Library</div>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100"><Book size={17} className="opacity-65 shrink-0" /> Templates</div>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100"><Settings size={17} className="opacity-65 shrink-0" /> Settings</div>
        </nav>
        <div className="px-3.5 py-3 border-t border-border-light flex items-center gap-2.5 cursor-pointer hover:bg-sand">
          <div className="w-[30px] h-[30px] rounded-full bg-lavender flex items-center justify-center text-[11px] font-bold text-primary-foreground">VE</div>
          <div>
            <div className="text-[13px] font-semibold text-text-primary">Veronika Efimova</div>
            <div className="text-[11px] text-text-muted truncate max-w-[140px]">veronika@everytailvets.c...</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Pen, ClipboardList, Book, Settings, LogOut } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface DBSession {
  id: string;
  patient_name: string | null;
  session_type: string | null;
  created_at: string;
  status: string | null;
}

interface UserProfile {
  display_name: string | null;
  email: string | null;
}

export default function Sidebar() {
  const tasks = useSessionStore((s) => s.tasks);
  const newSession = useSessionStore((s) => s.newSession);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const setEncounterStatus = useSessionStore((s) => s.setEncounterStatus);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const setNotes = useSessionStore((s) => s.setNotes);
  const setTranscript = useSessionStore((s) => s.setTranscript);
  const setTasks = useSessionStore((s) => s.setTasks);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);

  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const pendingCount = tasks.filter((t) => !t.done).length;

  useEffect(() => {
    fetchSessions();
    fetchProfile();

    const handleRefresh = () => fetchSessions();
    window.addEventListener('session-saved', handleRefresh);
    return () => window.removeEventListener('session-saved', handleRefresh);
  }, []);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('id, patient_name, session_type, created_at, status')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setSessions(data);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', user.id)
      .single();
    if (data) setProfile(data);
  };

  const loadDBSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setPatientName(session.patient_name || '');
      setSelectedTemplate(session.session_type || 'General Consult');
    }

    const { data: noteData } = await supabase
      .from('notes')
      .select('content, transcript')
      .eq('session_id', sessionId)
      .single();
    if (noteData) {
      setNotes(noteData.content || '');
      setTranscript(noteData.transcript || '');
    }

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('session_id', sessionId);
    if (taskData) {
      setTasks(taskData.map(t => ({
        id: t.id,
        text: t.text,
        category: (t.category || 'admin') as any,
        assignee: (t.assignee || 'Vet') as any,
        done: t.done || false,
      })));
    }

    setEncounterStatus('reviewing');
    setActiveTab('notes');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const grouped: Record<string, DBSession[]> = {};
  for (const s of sessions) {
    const date = new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(s);
  }

  const getSessionLabel = (s: DBSession) => {
    if (s.patient_name) return s.patient_name;
    const time = new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${s.session_type || 'Session'} · ${time}`;
  };

  return (
    <aside className="w-[220px] bg-card border-r border-border flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3.5">
        <img src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg" alt="ETV" className="h-[26px]" />
        <span className="text-[9px] font-bold bg-sand text-bark-muted px-1.5 py-0.5 rounded tracking-wide uppercase">Scribe</span>
      </div>

      <button onClick={() => { newSession(); }} className="mx-3 mb-3 py-2.5 px-4 bg-forest text-primary-foreground border-none rounded-md text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-forest-dark transition-colors duration-150">
        <Plus size={16} /> New session
      </button>

      <nav className="px-2 flex flex-col gap-px">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer bg-sand-dark text-bark">
          <Pen size={17} className="opacity-100 shrink-0" /> Scribe
        </div>
        <div
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand hover:text-text-primary transition-all duration-100"
          onClick={() => setActiveTab('tasks')}
        >
          <ClipboardList size={17} className="opacity-65 shrink-0" /> Tasks
          {pendingCount > 0 && <span className="ml-auto text-[10px] font-bold bg-etv-pink text-bark px-[7px] py-px rounded-[10px]">{pendingCount}</span>}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto border-t border-border-light mt-2.5">
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-xs text-text-muted text-center">No sessions yet.<br />Start a new encounter!</div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase">{date}</div>
              {items.map((s) => (
                <div key={s.id} className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors duration-100 ${s.id === activeSessionId ? 'bg-sand-dark' : 'hover:bg-sand'}`} onClick={() => loadDBSession(s.id)}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.id === activeSessionId ? 'bg-etv-olive' : 'bg-text-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-text-primary truncate">{getSessionLabel(s)}</div>
                    <div className="text-[11px] text-text-muted">{s.session_type || 'General Consult'}</div>
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
          <Link to="/settings" className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100 no-underline"><Settings size={17} className="opacity-65 shrink-0" /> Settings</Link>
        </nav>
        <div className="px-3.5 py-3 border-t border-border-light flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-full bg-lavender flex items-center justify-center text-[11px] font-bold text-primary-foreground">
            {(profile?.display_name || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-text-primary truncate">{profile?.display_name || 'Loading...'}</div>
            <div className="text-[11px] text-text-muted truncate max-w-[140px]">{profile?.email || ''}</div>
          </div>
          <button onClick={handleSignOut} className="p-1 rounded hover:bg-sand transition-colors" title="Sign out">
            <LogOut size={14} className="text-text-muted" />
          </button>
        </div>
      </div>
    </aside>
  );
}

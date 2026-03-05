import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Book,
  ClipboardList,
  Loader2,
  LogOut,
  Pen,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
} from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AllTasksPanel from '@/components/panels/AllTasksPanel';
import { useToast } from '@/hooks/use-toast';
import {
  bootstrapUserTemplates,
  createTemplate,
  deleteTemplate,
  type UserTemplate,
  updateTemplate,
} from '@/lib/templatePrompts';

interface DBSession {
  id: string;
  title: string | null;
  patient_name: string | null;
  session_type: string | null;
  created_at: string;
  duration_seconds: number | null;
  status: string | null;
  archived_at: string | null;
}

interface UserProfile {
  display_name: string | null;
  email: string | null;
}

const sortTemplates = (templates: UserTemplate[]) =>
  [...templates].sort((a, b) => a.name.localeCompare(b.name));

const formatDurationLabel = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

export default function Sidebar() {
  const newSession = useSessionStore((s) => s.newSession);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const setEncounterStatus = useSessionStore((s) => s.setEncounterStatus);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const setNotes = useSessionStore((s) => s.setNotes);
  const setTranscript = useSessionStore((s) => s.setTranscript);
  const setInterimTranscript = useSessionStore((s) => s.setInterimTranscript);
  const setSupplementalContext = useSessionStore((s) => s.setSupplementalContext);
  const setTranscriptMergeWarning = useSessionStore((s) => s.setTranscriptMergeWarning);
  const setTasks = useSessionStore((s) => s.setTasks);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const setAvailableTemplates = useSessionStore((s) => s.setAvailableTemplates);
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle);
  const setSessionDurationSeconds = useSessionStore((s) => s.setSessionDurationSeconds);

  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
  const [templatesSheetOpen, setTemplatesSheetOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const { toast } = useToast();

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) || null,
    [activeTemplateId, templates]
  );

  useEffect(() => {
    fetchProfile();
    fetchSessions();
    fetchTemplates();

    const handleRefresh = () => fetchSessions();
    window.addEventListener('session-saved', handleRefresh);
    return () => window.removeEventListener('session-saved', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const fetchSessions = async () => {
    let query = supabase
      .from('sessions')
      .select('id, title, patient_name, session_type, created_at, duration_seconds, status, archived_at')
      .order('created_at', { ascending: false })
      .limit(100);

    query = showArchived
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null);

    const { data } = await query;
    if (data) setSessions(data);
  };

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', user.id)
      .single();
    if (data) setProfile(data);
  };

  const fetchTemplates = async () => {
    try {
      const rows = sortTemplates(await bootstrapUserTemplates());
      setTemplates(rows);
      setAvailableTemplates(rows.map((row) => row.name));

      if (!activeTemplateId || !rows.some((row) => row.id === activeTemplateId)) {
        const selected = rows.find((row) => row.name === selectedTemplate);
        setActiveTemplateId(selected?.id || rows[0]?.id || null);
      }
      if (!rows.some((row) => row.name === selectedTemplate) && rows[0]) {
        setSelectedTemplate(rows[0].name);
      }
    } catch (error) {
      console.error('Template fetch failed:', error);
      toast({
        title: 'Could not load templates',
        description: 'Falling back to your currently selected template.',
        variant: 'destructive',
      });
    }
  };

  const upsertTemplateDraft = (templateId: string, patch: Partial<UserTemplate>) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, ...patch } : template
      )
    );
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    const trimmedPrompt = activeTemplate.systemPrompt.trim();
    if (!trimmedPrompt) {
      toast({
        title: 'Template is empty',
        description: 'Please enter a prompt before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const saved = await updateTemplate(activeTemplate.id, {
        systemPrompt: trimmedPrompt,
      });
      upsertTemplateDraft(saved.id, saved);
      toast({
        title: 'Template saved',
        description: `${saved.name} prompt updated.`,
      });
    } catch (error) {
      console.error('Template save failed:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save template prompt.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleAddTemplate = async () => {
    const name = window.prompt('New template name');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (templates.some((template) => template.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: 'Template exists',
        description: 'Please choose a different template name.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingTemplate(true);
    try {
      const created = await createTemplate(
        trimmed,
        `Write concise veterinary notes for ${trimmed}. Use UK English and include only facts present in the transcript.`
      );
      const next = sortTemplates([...templates, created]);
      setTemplates(next);
      setAvailableTemplates(next.map((template) => template.name));
      setActiveTemplateId(created.id);
      setSelectedTemplate(created.name);
      setActiveTab('notes');
      toast({
        title: 'Template created',
        description: `${created.name} is ready to edit.`,
      });
    } catch (error) {
      console.error('Template create failed:', error);
      toast({
        title: 'Could not create template',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingTemplate(false);
    }
  };

  const handleRenameTemplate = async (template: UserTemplate) => {
    const nextName = window.prompt('Rename template', template.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === template.name) return;
    if (templates.some((item) => item.id !== template.id && item.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: 'Template exists',
        description: 'Please choose a unique template name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const renamed = await updateTemplate(template.id, { name: trimmed });
      const next = sortTemplates(
        templates.map((item) => (item.id === renamed.id ? renamed : item))
      );
      setTemplates(next);
      setAvailableTemplates(next.map((item) => item.name));
      if (selectedTemplate === template.name) {
        setSelectedTemplate(renamed.name);
      }
      toast({
        title: 'Template renamed',
        description: `${template.name} is now ${renamed.name}.`,
      });
    } catch (error) {
      console.error('Template rename failed:', error);
      toast({
        title: 'Rename failed',
        description: 'Could not rename template.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (template: UserTemplate) => {
    if (templates.length <= 1) {
      toast({
        title: 'At least one template is required',
        description: 'Create another template before deleting this one.',
        variant: 'destructive',
      });
      return;
    }
    if (!window.confirm(`Delete template "${template.name}" permanently?`)) return;

    try {
      await deleteTemplate(template.id);
      const next = templates.filter((item) => item.id !== template.id);
      setTemplates(next);
      setAvailableTemplates(next.map((item) => item.name));

      const nextActive = next[0] || null;
      setActiveTemplateId(nextActive?.id || null);
      if (selectedTemplate === template.name && nextActive) {
        setSelectedTemplate(nextActive.name);
      }
      toast({
        title: 'Template deleted',
        description: `${template.name} was removed.`,
      });
    } catch (error) {
      console.error('Template delete failed:', error);
      toast({
        title: 'Delete failed',
        description: 'Could not delete template.',
        variant: 'destructive',
      });
    }
  };

  const renameSession = async (session: DBSession) => {
    const currentName = session.title || '';
    const nextName = window.prompt('Session name', currentName);
    if (nextName === null) return;
    const trimmed = nextName.trim();

    const { error } = await supabase
      .from('sessions')
      .update({ title: trimmed || null })
      .eq('id', session.id);

    if (error) {
      toast({
        title: 'Rename failed',
        description: 'Could not update session name.',
        variant: 'destructive',
      });
      return;
    }

    setSessions((prev) =>
      prev.map((item) => (item.id === session.id ? { ...item, title: trimmed || null } : item))
    );
    if (activeSessionId === session.id) {
      setSessionTitle(trimmed);
    }
  };

  const toggleArchiveSession = async (session: DBSession) => {
    const nextArchivedAt = session.archived_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from('sessions')
      .update({ archived_at: nextArchivedAt })
      .eq('id', session.id);

    if (error) {
      toast({
        title: 'Archive update failed',
        description: 'Could not update archive state.',
        variant: 'destructive',
      });
      return;
    }

    if (!showArchived && !session.archived_at) {
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
    } else if (showArchived && session.archived_at) {
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
    } else {
      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id ? { ...item, archived_at: nextArchivedAt } : item
        )
      );
    }
  };

  const deleteSession = async (session: DBSession) => {
    if (!window.confirm('Delete this session permanently? This cannot be undone.')) return;

    const { error } = await supabase.from('sessions').delete().eq('id', session.id);
    if (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete this session.',
        variant: 'destructive',
      });
      return;
    }

    setSessions((prev) => prev.filter((item) => item.id !== session.id));
    if (activeSessionId === session.id) {
      newSession();
    }
  };

  const loadDBSession = async (session: DBSession) => {
    setActiveSessionId(session.id);
    setSessionTitle(session.title || '');
    setPatientName(session.patient_name || '');
    setSelectedTemplate(session.session_type || 'General Consult');
    setSessionDurationSeconds(session.duration_seconds || 0);

    const { data: noteData } = await supabase
      .from('notes')
      .select('content, transcript, supplemental_context')
      .eq('session_id', session.id)
      .single();
    if (noteData) {
      setNotes(noteData.content || '');
      setTranscript(noteData.transcript || '');
      setSupplementalContext(noteData.supplemental_context || '');
    } else {
      setNotes('');
      setTranscript('');
      setSupplementalContext('');
    }
    setInterimTranscript('');
    setTranscriptMergeWarning(null);

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('session_id', session.id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (taskData) {
      setTasks(
        taskData.map((task) => ({
          id: task.id,
          text: task.text,
          category: (task.category || 'admin') as any,
          assignee: (task.assignee || 'Vet') as any,
          done: task.done || false,
          orderIndex: task.order_index ?? null,
        }))
      );
    } else {
      setTasks([]);
    }

    setEncounterStatus('reviewing');
    setActiveTab('notes');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const groupedSessions = useMemo(() => {
    const grouped: Record<string, DBSession[]> = {};
    for (const session of sessions) {
      const date = new Date(session.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(session);
    }
    return grouped;
  }, [sessions]);

  const getSessionLabel = (session: DBSession) => {
    if (session.title?.trim()) return session.title.trim();
    const date = new Date(session.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
    const time = new Date(session.created_at).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const duration = formatDurationLabel(session.duration_seconds);
    if (session.patient_name) {
      return `${session.patient_name} - ${date} ${time} - ${duration}`;
    }
    return `${session.session_type || 'Consult'} - ${date} ${time} - ${duration}`;
  };

  const getSessionMeta = (session: DBSession) => {
    const time = new Date(session.created_at).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const duration = formatDurationLabel(session.duration_seconds);
    const status = session.status === 'recording' ? 'Recording' : null;
    const bits = [session.session_type || 'General Consult', time, duration];
    if (status) bits.push(status);
    return bits.join(' - ');
  };

  return (
    <>
      <aside className="w-[250px] bg-card border-r border-border flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3.5">
          <img
            src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg"
            alt="ETV"
            className="h-[26px]"
          />
          <span className="text-[9px] font-bold bg-sand text-bark-muted px-1.5 py-0.5 rounded tracking-wide uppercase">
            Scribe
          </span>
        </div>

        <button
          onClick={() => {
            newSession();
            setActiveTab('context');
          }}
          className="mx-3 mb-3 py-2.5 px-4 bg-forest text-primary-foreground border-none rounded-md text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-forest-dark transition-colors duration-150"
        >
          <Plus size={16} /> New Session
        </button>

        <nav className="px-2 flex flex-col gap-px">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-semibold cursor-pointer bg-sand-dark text-bark">
            <Pen size={17} className="opacity-100 shrink-0" /> Scribe
          </div>
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand hover:text-text-primary transition-all duration-100"
            onClick={() => setTasksSheetOpen(true)}
          >
            <ClipboardList size={17} className="opacity-65 shrink-0" /> Tasks
          </div>
        </nav>

        <div className="mt-2.5 border-t border-border-light px-3 pt-2">
          <button
            onClick={() => setShowArchived((prev) => !prev)}
            className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md px-2 py-1.5 border transition-colors ${
              showArchived
                ? 'bg-sand-dark border-bark-muted text-bark'
                : 'bg-card border-border text-text-muted hover:bg-sand'
            }`}
          >
            {showArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
            {showArchived ? 'Viewing Archived' : 'Show Archived'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border-light mt-2">
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-xs text-text-muted text-center">
              {showArchived ? 'No archived sessions.' : 'No sessions yet.\nStart a new encounter!'}
            </div>
          ) : (
            Object.entries(groupedSessions).map(([date, items]) => (
              <div key={date}>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase">
                  {date}
                </div>
                {items.map((session) => (
                  <div
                    key={session.id}
                    className={`group px-3 py-1.5 ${
                      session.id === activeSessionId ? 'bg-sand-dark' : 'hover:bg-sand'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => loadDBSession(session)}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          session.id === activeSessionId ? 'bg-etv-olive' : 'bg-text-muted'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-text-primary truncate">
                          {getSessionLabel(session)}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {getSessionMeta(session)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 pl-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="Rename session"
                        onClick={(event) => {
                          event.stopPropagation();
                          renameSession(session);
                        }}
                        className="p-1 rounded hover:bg-card"
                      >
                        <Pencil size={12} className="text-text-muted" />
                      </button>
                      <button
                        title={session.archived_at ? 'Restore' : 'Archive'}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleArchiveSession(session);
                        }}
                        className="p-1 rounded hover:bg-card"
                      >
                        {session.archived_at ? (
                          <ArchiveRestore size={12} className="text-text-muted" />
                        ) : (
                          <Archive size={12} className="text-text-muted" />
                        )}
                      </button>
                      <button
                        title="Delete permanently"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteSession(session);
                        }}
                        className="p-1 rounded hover:bg-card"
                      >
                        <Trash2 size={12} className="text-error" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border-light">
          <nav className="px-2 pb-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-text-muted px-2.5 pt-3 pb-1">
              Library
            </div>
            <button
              onClick={() => {
                fetchTemplates();
                setTemplatesSheetOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100"
            >
              <Book size={17} className="opacity-65 shrink-0" /> Templates
            </button>
            <Link
              to="/settings"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer text-text-secondary hover:bg-sand transition-all duration-100 no-underline"
            >
              <Settings size={17} className="opacity-65 shrink-0" /> Settings
            </Link>
          </nav>
          <div className="px-3.5 py-3 border-t border-border-light flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-lavender flex items-center justify-center text-[11px] font-bold text-primary-foreground">
              {(profile?.display_name || profile?.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-text-primary truncate">
                {profile?.display_name || 'Loading...'}
              </div>
              <div className="text-[11px] text-text-muted truncate max-w-[140px]">{profile?.email || ''}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1 rounded hover:bg-sand transition-colors"
              title="Sign out"
            >
              <LogOut size={14} className="text-text-muted" />
            </button>
          </div>
        </div>
      </aside>

      <Sheet open={tasksSheetOpen} onOpenChange={setTasksSheetOpen}>
        <SheetContent side="left" className="w-[480px] sm:w-[540px] p-0">
          <SheetHeader className="px-5 py-4 border-b border-border-light">
            <SheetTitle className="text-[15px] font-bold text-bark">All Tasks</SheetTitle>
            <SheetDescription className="sr-only">
              View and manage tasks from all consultations.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto h-[calc(100vh-60px)]">
            <AllTasksPanel />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={templatesSheetOpen} onOpenChange={setTemplatesSheetOpen}>
        <SheetContent side="left" className="w-[96vw] max-w-[1200px] sm:max-w-[1200px] p-0">
          <SheetHeader className="px-5 py-4 border-b border-border-light">
            <SheetTitle className="text-[15px] font-bold text-bark">Templates</SheetTitle>
            <SheetDescription className="sr-only">
              Edit, create, rename, and delete note-generation templates.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-[280px_minmax(0,1fr)] h-[calc(100vh-64px)]">
            <div className="border-r border-border-light p-3 space-y-2 overflow-y-auto">
              <button
                onClick={handleAddTemplate}
                disabled={isAddingTemplate}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border bg-sand text-xs font-semibold hover:bg-sand-dark disabled:opacity-50"
              >
                {isAddingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add template
              </button>

              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-md border ${
                    template.id === activeTemplateId
                      ? 'bg-sand-dark border-bark-muted'
                      : 'bg-card border-border'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveTemplateId(template.id);
                      setSelectedTemplate(template.name);
                      setActiveTab('notes');
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                  >
                    {template.name}
                  </button>
                  <div className="flex items-center justify-end gap-1 px-2 pb-2">
                    <button
                      title="Rename"
                      onClick={() => handleRenameTemplate(template)}
                      className="p-1 rounded hover:bg-card"
                    >
                      <Pencil size={13} className="text-text-muted" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-1 rounded hover:bg-card"
                    >
                      <Trash2 size={13} className="text-error" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 flex flex-col gap-3 min-w-0">
              {activeTemplate ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-bark">{activeTemplate.name}</div>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={isSavingTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-forest text-primary-foreground disabled:opacity-50"
                    >
                      {isSavingTemplate ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save template
                    </button>
                  </div>
                  <textarea
                    value={activeTemplate.systemPrompt}
                    onChange={(event) =>
                      upsertTemplateDraft(activeTemplate.id, { systemPrompt: event.target.value })
                    }
                    className="flex-1 w-full border border-border rounded-md bg-card text-text-primary text-[13px] leading-relaxed p-3 outline-none focus:border-bark-muted resize-none"
                    placeholder="Write the full template prompt used for summary generation..."
                  />
                </>
              ) : (
                <div className="text-sm text-text-muted">Create a template to start editing prompts.</div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Undo2, Redo2, RefreshCw, Pen, ClipboardList, Star, Loader2, Check, Copy, Stethoscope } from 'lucide-react';
import { compilePEReport } from '@/lib/prompts';
import { useToast } from '@/hooks/use-toast';

export default function NotesPanel() {
  const peIncludeInNotes = useSessionStore((s) => s.peIncludeInNotes);
  const togglePEInNotes = useSessionStore((s) => s.togglePEInNotes);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const availableTemplates = useSessionStore((s) => s.availableTemplates);
  const tasks = useSessionStore((s) => s.tasks);
  const toggleTask = useSessionStore((s) => s.toggleTask);
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSwitchRegenerating, setIsSwitchRegenerating] = useState(false);
  const { toast } = useToast();
  const noteRef = useRef<HTMLDivElement>(null);
  const { canUndo, canRedo, undo, redo, pushState } = useUndoRedo();

  useEffect(() => {
    if (notes) pushState(notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerate = async () => {
    try {
      await generateNote();
      toast({ title: 'Notes generated', description: 'Clinical notes have been generated from the transcript.' });
      try {
        await extractTasks();
      } catch (error) {
        console.warn('Task extraction after note generation failed:', error);
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  const handleTemplateChange = async (templateName: string) => {
    if (!templateName || templateName === selectedTemplate) return;
    setSelectedTemplate(templateName);
    setIsSwitchRegenerating(true);
    try {
      await generateNote(templateName);
      try {
        await extractTasks();
      } catch (error) {
        console.warn('Task extraction after template switch failed:', error);
      }
      toast({ title: 'Template applied', description: `Notes regenerated using ${templateName}.` });
    } catch (err: any) {
      toast({
        title: 'Template regeneration failed',
        description: err?.message || 'Could not regenerate notes for this template.',
        variant: 'destructive',
      });
    } finally {
      setIsSwitchRegenerating(false);
    }
  };

  const peReport = peEnabled ? compilePEReport(peData) : '';

  const handleCopy = async () => {
    let text = noteRef.current?.innerText || notes;
    if (peIncludeInNotes && peReport.trim()) {
      text = `${text}\n\n${peReport}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Notes copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  const handleNoteInput = () => {
    if (noteRef.current) {
      const text = noteRef.current.innerText;
      setNotes(text);
      pushState(text);
    }
  };

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev !== undefined) setNotes(prev);
  }, [undo, setNotes]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next !== undefined) setNotes(next);
  }, [redo, setNotes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border-light shrink-0">
        <div className="flex items-center gap-1.5">
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="px-3 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark min-w-[220px]"
          >
            {availableTemplates.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
          {isSwitchRegenerating && (
            <span className="inline-flex items-center gap-1 text-[11px] text-forest font-semibold">
              <Loader2 size={12} className="animate-spin" />
              Applying template...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn title="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}><Undo2 size={16} /></ToolBtn>
          <ToolBtn title="Redo (Ctrl+Y)" onClick={handleRedo} disabled={!canRedo}><Redo2 size={16} /></ToolBtn>
          <button
            title="Regenerate with AI"
            onClick={handleRegenerate}
            disabled={isGeneratingNotes}
            className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer text-text-muted bg-transparent border-none hover:bg-sand hover:text-text-primary transition-all duration-100 disabled:opacity-50"
          >
            {isGeneratingNotes ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          {editing && (
            <span className="flex items-center gap-1 text-[11px] text-forest font-semibold"><Pen size={12} /> Editing</span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark cursor-pointer hover:bg-sand-dark"
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Notes</>}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 overflow-y-auto p-6">
          {isGeneratingNotes && (
            <div className="flex items-center gap-2 mb-3 text-xs text-forest font-semibold">
              <Loader2 size={14} className="animate-spin" /> Generating clinical notes...
            </div>
          )}
          {!notes && !isGeneratingNotes ? (
            <div className="max-w-[720px] text-sm text-text-muted py-12 text-center">
              <p className="mb-2">No notes yet.</p>
              <p>Record a consultation and notes will be generated automatically.</p>
            </div>
          ) : (
            <>
              <div
                ref={noteRef}
                className="max-w-[720px] text-sm leading-[1.85] text-text-primary outline-none rounded-md p-1 transition-colors duration-150 hover:bg-bark/[0.02] focus:bg-card focus:shadow-[0_0_0_2px_hsl(var(--sand-deeper))]"
                contentEditable
                suppressContentEditableWarning
                spellCheck
                onFocus={() => setEditing(true)}
                onBlur={() => { setEditing(false); handleNoteInput(); }}
              >
                {notes.split('\n\n').map((para, i) => (
                  <p key={i} className="mb-3.5">
                    {(() => {
                      const splitIndex = para.indexOf(':');
                      if (splitIndex <= 0) return para;
                      const label = para.slice(0, splitIndex).trim();
                      const normalized = label.toUpperCase();
                      const highlightedLabels = new Set([
                        'CE',
                        'PE',
                        'PLAN',
                        'ASSESSMENT',
                        'TREATMENT',
                        'OBJECTIVE',
                        'COMMUNICATION',
                      ]);
                      if (!highlightedLabels.has(normalized) && !normalized.startsWith('ADV')) return para;
                      return (
                        <>
                          <span className="text-etv-olive font-bold">{label}:</span>
                          {para.substring(splitIndex + 1)}
                        </>
                      );
                    })()}
                  </p>
                ))}
              </div>
              {peIncludeInNotes && peReport.trim() && (
                <div className="max-w-[720px] mt-4 p-3 rounded-md border border-border-light bg-sand/40">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-bark mb-1.5">
                    <Stethoscope size={13} /> Physical Examination Findings
                  </div>
                  <p className="text-sm leading-[1.85] text-text-primary">{peReport}</p>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="w-[280px] border-l border-border-light bg-card/60 p-4 overflow-y-auto">
          <div className="text-[12px] font-bold uppercase tracking-[0.5px] text-text-muted mb-2">
            Auto Tasks
          </div>
          {tasks.length === 0 ? (
            <div className="text-xs text-text-muted">Tasks will appear here after note generation.</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <label key={task.id} className="flex items-start gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className={task.done ? 'line-through text-text-muted' : ''}>
                      {task.text.length > 110 ? `${task.text.slice(0, 107)}...` : task.text}
                    </span>
                    {task.deadlineAt && (
                      <span className="block text-[10px] text-warning mt-0.5">
                        Due {new Date(task.deadlineAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-card border-t border-border-light flex items-center justify-between text-xs text-text-muted shrink-0">
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-1 text-[11px]"><ClipboardList size={13} className="opacity-50" /> Include PE findings</span>
          <div
            className={`relative w-[34px] h-[18px] rounded-[10px] cursor-pointer transition-colors duration-200 ${peIncludeInNotes ? 'bg-forest' : 'bg-sand-deeper'}`}
            onClick={togglePEInNotes}
          >
            <div className={`absolute top-[2px] w-3.5 h-3.5 bg-card rounded-full transition-[left] duration-200 shadow-sm ${peIncludeInNotes ? 'left-[18px]' : 'left-[2px]'}`} />
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-1"><Star size={13} className="opacity-50" /> Personalisation on</span>
          <span className="flex items-center gap-1"><ClipboardList size={13} className="opacity-50" /> {tasks.length} tasks</span>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer text-text-muted bg-transparent border-none hover:bg-sand hover:text-text-primary transition-all duration-100 disabled:opacity-30 disabled:cursor-default"
    >
      {children}
    </button>
  );
}

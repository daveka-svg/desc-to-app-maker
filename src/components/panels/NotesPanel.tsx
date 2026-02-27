import { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { compilePEReport } from '@/lib/prompts';
import { Mic, ChevronDown, Undo2, Redo2, RefreshCw, Pen, ClipboardList, Star, Loader2, Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NotesPanel() {
  const peIncludeInNotes = useSessionStore((s) => s.peIncludeInNotes);
  const togglePEInNotes = useSessionStore((s) => s.togglePEInNotes);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const tasks = useSessionStore((s) => s.tasks);
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const toggleTasks = useSessionStore((s) => s.toggleTasks);
  const { generateNote, isGeneratingNotes } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const noteRef = useRef<HTMLDivElement>(null);
  const { canUndo, canRedo, undo, redo, pushState } = useUndoRedo();

  // Push initial notes to undo stack on mount
  useEffect(() => {
    if (notes) pushState(notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegenerate = async () => {
    try {
      await generateNote();
      toast({ title: 'Notes generated', description: 'Clinical notes have been generated from the transcript.' });
      try { await extractTasks(); } catch {}
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    const text = noteRef.current?.innerText || notes;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Notes copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  const peText = peEnabled ? compilePEReport(peData) : '';

  const handleNoteInput = () => {
    if (noteRef.current) {
      const text = noteRef.current.innerText;
      setNotes(text);
      pushState(text);
    }
  };

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev !== undefined) {
      setNotes(prev);
    }
  }, [undo, setNotes]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next !== undefined) {
      setNotes(next);
    }
  }, [redo, setNotes]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border-light shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark cursor-pointer hover:bg-sand-dark">
            <span className="w-4 h-4 bg-forest rounded-[3px] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
            </span>
            {selectedTemplate}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4" /></svg>
          </div>
          <button className="flex items-center gap-[5px] px-3 py-1.5 bg-card border border-border rounded-md text-[13px] font-medium text-text-secondary cursor-pointer hover:bg-sand hover:text-bark">
            <Pen size={13} /> Brief
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-border rounded-md cursor-pointer text-text-muted bg-card hover:bg-sand text-base">···</button>
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn title="Dictate — switch to Context" onClick={() => setActiveTab('context')}><Mic size={16} /></ToolBtn>
          <ToolBtn title="Audio"><ChevronDown size={16} /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
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
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Note content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isGeneratingNotes && (
          <div className="flex items-center gap-2 mb-3 text-xs text-forest font-semibold">
            <Loader2 size={14} className="animate-spin" /> Generating clinical notes...
          </div>
        )}
        {!notes && !isGeneratingNotes ? (
          <div className="max-w-[720px] text-sm text-text-muted py-12 text-center">
            <p className="mb-2">No notes yet.</p>
            <p>Record a consultation or add a transcript, then click <strong className="text-forest">"Create"</strong> to generate clinical notes with AI.</p>
          </div>
        ) : (
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
                {para.startsWith('CE:') || para.startsWith('Plan:') || para.startsWith('Adv') || para.startsWith('PE:') ? (
                  <><span className="text-etv-olive font-bold">{para.split(':')[0]}:</span>{para.substring(para.indexOf(':') + 1)}</>
                ) : para}
              </p>
            ))}
            {peIncludeInNotes && peEnabled && peText && (
              <div className="border-t border-dashed border-border pt-3 mt-1.5">
                <p><span className="text-etv-olive font-bold">PE:</span> {peText.substring(3)}</p>
              </div>
            )}
          </div>
        )}
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
          <span className="flex items-center gap-1 cursor-pointer hover:text-bark transition-colors" onClick={toggleTasks}><ClipboardList size={13} className="opacity-50" /> {tasks.length} tasks</span>
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

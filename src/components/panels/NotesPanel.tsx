import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { Mic, ChevronDown, Undo2, Redo2, RefreshCw, Pen, ClipboardList, Star, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const defaultNote = `C/O acute vomiting since yesterday afternoon. 4 episodes total — liquid/yellowish/foamy initially, last bile only. Anorexic since yesterday morning. Drinking, keeping water down. Lethargic, shaky on standing. Last normal faeces yesterday morning.

CE: Lethargic, mild dehydration ~5–7%. HR 120 bpm, RR 30/min, panting. Temp 39.5°C. MM pink, tacky, CRT <2 secs. Cranial abdominal pain on deep palpation, no masses or FB palpable. Peripheral LN NAD. Thoracic auscultation clear.

Adv DDx: acute gastroenteritis, pancreatitis, possible obstruction.

Plan: In-house haematology and biochemistry. Abdominal ultrasound. IVFT if bloods confirm dehydration/inflammation. Anti-emetics. Hospitalisation min 24 hrs for monitoring. NBM 12 hrs, continue offering small amounts water frequently. Return immediately if further vomiting or increased lethargy.

Estimate to be prepared for bloods, ultrasound, hospitalisation.`;

export default function NotesPanel() {
  const { peIncludeInNotes, togglePEInNotes, selectedTemplate, peData, peEnabled, transcript } = useSessionStore();
  const { generatedNote, isGenerating, generateNote, setGeneratedNote } = useNoteGeneration();
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();

  const displayNote = generatedNote || defaultNote;

  const handleRegenerate = async () => {
    if (!transcript.trim()) {
      toast({ title: 'No transcript', description: 'Record a session or add transcript text first.', variant: 'destructive' });
      return;
    }
    try {
      await generateNote(transcript, peEnabled ? peData : undefined);
      toast({ title: 'Notes generated', description: 'Clinical notes have been generated from the transcript.' });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate notes.', variant: 'destructive' });
    }
  };

  const peText = `PE: Temp ${peData.vitals.temp}°C, HR ${peData.vitals.hr} bpm, RR ${peData.vitals.rr}/min. BCS ${peData.bcs}/9. ${peData.mentation}${peData.demeanour ? ', ' + peData.demeanour : ''}. Eyes ${peData.eyes}, Ears ${peData.ears}, Nose ${peData.nose}, Oral ${peData.oral}, PLNs ${peData.plns}. MM ${peData.mmColor}${peData.mmMoisture ? ', ' + peData.mmMoisture : ''}, CRT ${peData.crt}s. Heart ${peData.heart}, Lungs ${peData.lungs}, Pulses ${peData.pulses}.${peData.hydration ? ' ' + peData.hydration : ''}${peData.abdoPalp ? ', ' + peData.abdoPalp : ''}, skin/coat ${peData.skinCoat}.`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border-light shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark cursor-pointer hover:bg-sand-dark">
            <span className="w-4 h-4 bg-forest rounded-[3px] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </span>
            {selectedTemplate}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <button className="flex items-center gap-[5px] px-3 py-1.5 bg-card border border-border rounded-md text-[13px] font-medium text-text-secondary cursor-pointer hover:bg-sand hover:text-bark">
            <Pen size={13} /> Brief
          </button>
          <button className="w-8 h-8 flex items-center justify-center border border-border rounded-md cursor-pointer text-text-muted bg-card hover:bg-sand text-base">
            ···
          </button>
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn title="Dictate"><Mic size={16} /></ToolBtn>
          <ToolBtn title="Audio"><ChevronDown size={16} /></ToolBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolBtn title="Undo"><Undo2 size={16} /></ToolBtn>
          <ToolBtn title="Redo"><Redo2 size={16} /></ToolBtn>
          <button
            title="Regenerate with AI"
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer text-text-muted bg-transparent border-none hover:bg-sand hover:text-text-primary transition-all duration-100 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          {editing && (
            <span className="flex items-center gap-1 text-[11px] text-forest font-semibold">
              <Pen size={12} /> Editing
            </span>
          )}
          <button className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-[13px] font-semibold text-bark cursor-pointer hover:bg-sand-dark">
            Copy <ChevronDown size={10} />
          </button>
        </div>
      </div>

      {/* Note content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isGenerating && (
          <div className="flex items-center gap-2 mb-3 text-xs text-forest font-semibold">
            <Loader2 size={14} className="animate-spin" />
            Generating clinical notes...
          </div>
        )}
        <div
          className="max-w-[720px] text-sm leading-[1.85] text-text-primary outline-none rounded-md p-1 transition-colors duration-150 hover:bg-bark/[0.02] focus:bg-card focus:shadow-[0_0_0_2px_hsl(var(--sand-deeper))]"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        >
          {displayNote.split('\n\n').map((para, i) => (
            <p key={i} className="mb-3.5">
              {para.startsWith('CE:') || para.startsWith('Plan:') ? (
                <>
                  <span className="text-etv-olive font-bold">{para.split(':')[0]}:</span>
                  {para.substring(para.indexOf(':') + 1)}
                </>
              ) : para}
            </p>
          ))}
          {peIncludeInNotes && peEnabled && (
            <div className="border-t border-dashed border-border pt-3 mt-1.5">
              <p>
                <span className="text-etv-olive font-bold">PE:</span> {peText.substring(3)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 bg-card border-t border-border-light flex items-center justify-between text-xs text-text-muted shrink-0">
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-1 text-[11px]">
            <ClipboardList size={13} className="opacity-50" />
            Include PE findings
          </span>
          <div
            className={`relative w-[34px] h-[18px] rounded-[10px] cursor-pointer transition-colors duration-200 ${peIncludeInNotes ? 'bg-forest' : 'bg-sand-deeper'}`}
            onClick={togglePEInNotes}
          >
            <div
              className={`absolute top-[2px] w-3.5 h-3.5 bg-card rounded-full transition-[left] duration-200 shadow-sm ${peIncludeInNotes ? 'left-[18px]' : 'left-[2px]'}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-1">
            <Star size={13} className="opacity-50" /> Personalisation on
          </span>
          <span className="flex items-center gap-1">
            <ClipboardList size={13} className="opacity-50" /> 8 tasks
          </span>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-md cursor-pointer text-text-muted bg-transparent border-none hover:bg-sand hover:text-text-primary transition-all duration-100"
    >
      {children}
    </button>
  );
}

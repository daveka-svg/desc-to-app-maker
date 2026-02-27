import { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useClientInstructions } from '@/hooks/useClientInstructions';
import { exportClientInstructionsPDF } from '@/lib/pdf-export';
import { Loader2, Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ClientInstructionsPanel() {
  const ci = useSessionStore((s) => s.clientInstructions);
  const patientName = useSessionStore((s) => s.patientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setClientInstructions = useSessionStore((s) => s.setClientInstructions);
  const { generateInstructions, isGeneratingCI } = useClientInstructions();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      await generateInstructions();
      toast({ title: 'Instructions generated', description: 'Client discharge instructions are ready.' });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate instructions.', variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    if (!ci) return;
    const text = `Discharge Instructions — ${patientName || 'Patient'}\n\n✅ Things to do:\n${ci.thingsToDo}\n\n⚠️ Things to avoid:\n${ci.thingsToAvoid}\n\n💊 Medication:\n${ci.medication}\n\n🚨 When to contact us:\n${ci.whenToContact}\n\n📅 Follow-up:\n${ci.followUp}\n\n---\nEvery Tail Vets | Emergency: Veteris 020 3808 0100`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Instructions copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handlePDF = () => {
    if (!ci) return;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    exportClientInstructionsPDF({
      patientName: patientName || 'Patient',
      consultType: selectedTemplate,
      date,
      instructions: ci,
    });
    toast({ title: 'PDF export', description: 'Print dialog opened. Choose "Save as PDF" to download.' });
  };

  const handleFieldEdit = (field: keyof typeof ci, value: string) => {
    if (!ci) return;
    setClientInstructions({ ...ci, [field]: value });
  };

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (!ci && !isGeneratingCI) {
    return (
      <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-sand rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--text-muted))" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          </div>
          <p className="text-sm text-text-muted mb-1 font-medium">No client instructions generated yet.</p>
          <p className="text-xs text-text-muted mb-5">Generate notes first, then create discharge instructions for the client.</p>
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 bg-forest text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-forest-dark transition-colors"
          >
            Generate Client Instructions
          </button>
        </div>
      </div>
    );
  }

  if (isGeneratingCI) {
    return (
      <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-forest font-semibold">
          <Loader2 className="animate-spin" size={20} /> Generating discharge instructions...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-7 border border-border-light max-w-[680px] shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <img src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg" alt="ETV" className="h-[22px]" />
        </div>
        <div className="text-lg font-bold text-bark mb-0.5">Discharge Instructions</div>
        <div className="text-xs text-text-muted mb-5">Generated from consultation on {today}</div>

        <div className="flex gap-5 px-4 py-2.5 bg-sand rounded-md mb-5 text-xs">
          {[['Patient', patientName || 'N/A'], ['Date', new Date().toLocaleDateString('en-GB')], ['Type', selectedTemplate]].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase text-text-muted tracking-[0.3px] mb-px">{label}</div>
              <div className="font-semibold text-text-primary">{value}</div>
            </div>
          ))}
        </div>

        {ci && (
          <>
            <CISection
              color="bg-forest" icon="✅" title="Things to do"
              editing={editingField === 'thingsToDo'}
              onEdit={() => setEditingField('thingsToDo')}
              onSave={(v) => { handleFieldEdit('thingsToDo', v); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
            >{ci.thingsToDo}</CISection>
            <CISection
              color="bg-error" icon="⚠️" title="Things to avoid"
              editing={editingField === 'thingsToAvoid'}
              onEdit={() => setEditingField('thingsToAvoid')}
              onSave={(v) => { handleFieldEdit('thingsToAvoid', v); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
            >{ci.thingsToAvoid}</CISection>
            <CISection
              color="bg-forest" icon="💊" title="Medication"
              editing={editingField === 'medication'}
              onEdit={() => setEditingField('medication')}
              onSave={(v) => { handleFieldEdit('medication', v); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
            >{ci.medication}</CISection>
            <CISection
              color="bg-warning" icon="🚨" title="When to contact us immediately"
              editing={editingField === 'whenToContact'}
              onEdit={() => setEditingField('whenToContact')}
              onSave={(v) => { handleFieldEdit('whenToContact', v); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
            >{ci.whenToContact}</CISection>
            <div className="mb-4">
              <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">📅 Follow-up appointment</div>
              {editingField === 'followUp' ? (
                <EditableField
                  value={ci.followUp}
                  onSave={(v) => { handleFieldEdit('followUp', v); setEditingField(null); }}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <p className="text-[13px] leading-[1.75] text-text-secondary cursor-pointer hover:bg-sand/50 rounded px-1 -mx-1 transition-colors" onClick={() => setEditingField('followUp')}>{ci.followUp}</p>
              )}
            </div>
          </>
        )}

        <div className="text-xs text-text-muted border-t border-border-light pt-3.5 mb-5">
          In the event of an emergency outside of our regular operating hours, please contact{' '}
          <strong className="text-text-primary">Veteris Home Emergency Services</strong> at{' '}
          <strong className="text-text-primary">020 3808 0100</strong>. Veteris provides 24/7 mobile veterinary care across Greater London.
        </div>

        <div className="flex gap-2 pt-4 border-t border-border-light">
          <button onClick={handleCopy} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
          <button onClick={handlePDF} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">📥 Download PDF</button>
          <button onClick={handleGenerate} disabled={isGeneratingCI} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors disabled:opacity-50">
            {isGeneratingCI ? <Loader2 size={12} className="animate-spin" /> : '🔄'} Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function CISection({ color, icon, title, children, editing, onEdit, onSave, onCancel }: {
  color: string; icon: string; title: string; children: React.ReactNode;
  editing: boolean; onEdit: () => void; onSave: (v: string) => void; onCancel: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">
        <span>{icon}</span>
        {title}
      </div>
      {editing ? (
        <EditableField value={String(children)} onSave={onSave} onCancel={onCancel} />
      ) : (
        <p className="text-[13px] leading-[1.75] text-text-secondary cursor-pointer hover:bg-sand/50 rounded px-1 -mx-1 transition-colors" onClick={onEdit}>{children}</p>
      )}
    </div>
  );
}

function EditableField({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  return (
    <div>
      <textarea
        className="w-full text-[13px] leading-[1.75] text-text-primary bg-card border border-bark-muted rounded-md p-2 outline-none resize-none min-h-[60px]"
        defaultValue={value}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave((e.target as HTMLTextAreaElement).value);
          }
        }}
        onBlur={(e) => onSave(e.target.value)}
      />
      <div className="text-[10px] text-text-muted mt-1">Ctrl+Enter to save, Esc to cancel</div>
    </div>
  );
}

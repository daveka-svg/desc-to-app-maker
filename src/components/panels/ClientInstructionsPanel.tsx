import { useEffect, useState } from 'react';
import { useSessionStore, type ClientInstructions } from '@/stores/useSessionStore';
import { useClientInstructions } from '@/hooks/useClientInstructions';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function toInstructionsText(ci: ClientInstructions): string {
  return `Discharge Instructions\n\nThings to do:\n${ci.thingsToDo}\n\nThings to avoid:\n${ci.thingsToAvoid}\n\nMedication:\n${ci.medication}\n\nWhen to contact us:\n${ci.whenToContact}\n\nFollow-up:\n${ci.followUp}`;
}

export default function ClientInstructionsPanel() {
  const ci = useSessionStore((s) => s.clientInstructions);
  const setClientInstructions = useSessionStore((s) => s.setClientInstructions);
  const patientName = useSessionStore((s) => s.patientName);
  const { generateInstructions, isGeneratingCI } = useClientInstructions();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ClientInstructions>({
    thingsToDo: '',
    thingsToAvoid: '',
    medication: '',
    whenToContact: '',
    followUp: '',
  });

  useEffect(() => {
    if (ci) setDraft(ci);
  }, [ci]);

  const handleGenerate = async () => {
    try {
      await generateInstructions();
      setIsEditing(false);
      toast({ title: 'Instructions generated', description: 'Client discharge instructions are ready.' });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message || 'Could not generate instructions.', variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    if (!ci) return;
    try {
      await navigator.clipboard.writeText(toInstructionsText(ci));
      toast({ title: 'Copied', description: 'Instructions copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy instructions.', variant: 'destructive' });
    }
  };

  const handleDownloadPdf = () => {
    if (!ci) return;

    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!popup) {
      toast({
        title: 'Pop-up blocked',
        description: 'Allow pop-ups to print or save as PDF.',
        variant: 'destructive',
      });
      return;
    }

    const escape = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br/>');

    const today = new Date().toLocaleDateString('en-GB');

    popup.document.write(`
      <html>
        <head>
          <title>Discharge Instructions</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #2b2b2b; }
            h1 { margin-bottom: 6px; }
            .meta { color: #666; margin-bottom: 16px; }
            h3 { margin: 16px 0 6px; }
            p { line-height: 1.5; margin: 0; }
          </style>
        </head>
        <body>
          <h1>Discharge Instructions</h1>
          <div class="meta">Patient: ${escape(patientName || 'N/A')} | Date: ${escape(today)}</div>
          <h3>Things to do</h3><p>${escape(ci.thingsToDo)}</p>
          <h3>Things to avoid</h3><p>${escape(ci.thingsToAvoid)}</p>
          <h3>Medication</h3><p>${escape(ci.medication)}</p>
          <h3>When to contact us immediately</h3><p>${escape(ci.whenToContact)}</p>
          <h3>Follow-up appointment</h3><p>${escape(ci.followUp)}</p>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleEditToggle = () => {
    if (!ci) return;

    if (!isEditing) {
      setDraft(ci);
      setIsEditing(true);
      return;
    }

    setClientInstructions(draft);
    setIsEditing(false);
    toast({ title: 'Instructions updated', description: 'Edits have been saved to this session.' });
  };

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (!ci && !isGeneratingCI) {
    return (
      <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-text-muted mb-4">No client instructions generated yet.</p>
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

  if (!ci) return null;

  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-7 border border-border-light max-w-[680px] shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <img src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg" alt="ETV" className="h-[22px]" />
        </div>
        <div className="text-lg font-bold text-bark mb-0.5">Discharge Instructions</div>
        <div className="text-xs text-text-muted mb-5">Generated from consultation on {today}</div>

        <div className="flex gap-5 px-4 py-2.5 bg-sand rounded-md mb-5 text-xs">
          {[['Patient', patientName || 'N/A'], ['Date', new Date().toLocaleDateString('en-GB')]].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase text-text-muted tracking-[0.3px] mb-px">{label}</div>
              <div className="font-semibold text-text-primary">{value}</div>
            </div>
          ))}
        </div>

        {isEditing ? (
          <div className="space-y-3 mb-4">
            <EditableSection title="Things to do" value={draft.thingsToDo} onChange={(v) => setDraft((s) => ({ ...s, thingsToDo: v }))} />
            <EditableSection title="Things to avoid" value={draft.thingsToAvoid} onChange={(v) => setDraft((s) => ({ ...s, thingsToAvoid: v }))} />
            <EditableSection title="Medication" value={draft.medication} onChange={(v) => setDraft((s) => ({ ...s, medication: v }))} />
            <EditableSection title="When to contact us immediately" value={draft.whenToContact} onChange={(v) => setDraft((s) => ({ ...s, whenToContact: v }))} />
            <EditableSection title="Follow-up appointment" value={draft.followUp} onChange={(v) => setDraft((s) => ({ ...s, followUp: v }))} />
          </div>
        ) : (
          <>
            <CISection color="bg-forest" title="Things to do">{ci.thingsToDo}</CISection>
            <CISection color="bg-error" title="Things to avoid">{ci.thingsToAvoid}</CISection>
            <CISection color="bg-forest" title="Medication">{ci.medication}</CISection>
            <CISection color="bg-warning" title="When to contact us immediately">{ci.whenToContact}</CISection>
            <div className="mb-4">
              <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">Follow-up appointment</div>
              <p className="text-[13px] leading-[1.75] text-text-secondary">{ci.followUp}</p>
            </div>
          </>
        )}

        <div className="text-xs text-text-muted border-t border-border-light pt-3.5 mb-5">
          In the event of an emergency outside of our regular operating hours, please contact{' '}
          <strong className="text-text-primary">Veteris Home Emergency Services</strong> at{' '}
          <strong className="text-text-primary">020 3808 0100</strong>. Veteris provides 24/7 mobile veterinary care across Greater London.
        </div>

        <div className="flex gap-2 pt-4 border-t border-border-light">
          <button onClick={handleCopy} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">Copy</button>
          <button onClick={handleDownloadPdf} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">Download PDF</button>
          <button onClick={handleEditToggle} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">{isEditing ? 'Save' : 'Edit'}</button>
          {isEditing && (
            <button
              onClick={() => { setDraft(ci); setIsEditing(false); }}
              className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors"
            >
              Cancel
            </button>
          )}
          <button onClick={handleGenerate} className="flex items-center gap-[5px] px-3.5 py-1.5 bg-sand border border-border rounded-md text-xs font-semibold text-bark cursor-pointer hover:bg-sand-dark transition-colors">Regenerate</button>
        </div>
      </div>
    </div>
  );
}

function CISection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[13px] font-bold text-bark mb-1.5 flex items-center gap-[7px]">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        {title}
      </div>
      <p className="text-[13px] leading-[1.75] text-text-secondary">{children}</p>
    </div>
  );
}

function EditableSection({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-bark">{title}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-text-primary outline-none focus:border-bark-muted"
      />
    </label>
  );
}

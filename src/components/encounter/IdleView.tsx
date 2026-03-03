import { Mic, Stethoscope } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TEMPLATES = ['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check'];

export default function IdleView({ onStartRecording }: { onStartRecording: () => void }) {
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-forest/10 flex items-center justify-center mx-auto mb-4">
            <Stethoscope size={32} className="text-forest" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'hsl(var(--text))' }}>New Encounter</h1>
          <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
            Start recording to capture the consultation
          </p>
        </div>

        <div className="space-y-4 bg-card p-6 rounded-xl border border-border">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'hsl(var(--text-secondary))' }}>Patient Name (optional)</label>
            <Input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Bella — Golden Retriever"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'hsl(var(--text-secondary))' }}>Template</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={onStartRecording}
            className="w-full h-14 text-base font-semibold bg-forest hover:bg-forest-dark gap-2"
          >
            <Mic size={20} />
            Start Recording
          </Button>
        </div>
      </div>
    </div>
  );
}

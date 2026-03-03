import { Check, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export default function ProcessingView({ steps }: { steps: Step[] }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-forest/10 flex items-center justify-center mx-auto mb-4">
            <Loader2 size={32} className="text-forest animate-spin" />
          </div>
          <h2 className="text-xl font-semibold" style={{ color: 'hsl(var(--text))' }}>Processing Session</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>Generating your clinical notes...</p>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {step.status === 'done' ? (
                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0">
                  <Check size={14} className="text-primary-foreground" />
                </div>
              ) : step.status === 'active' ? (
                <div className="w-6 h-6 rounded-full bg-forest flex items-center justify-center shrink-0">
                  <Loader2 size={14} className="text-primary-foreground animate-spin" />
                </div>
              ) : step.status === 'error' ? (
                <div className="w-6 h-6 rounded-full bg-error flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground text-xs font-bold">!</span>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-sand border border-border shrink-0" />
              )}
              <span
                className="text-sm"
                style={{
                  color: step.status === 'done' ? 'hsl(var(--text-muted))' :
                         step.status === 'active' ? 'hsl(var(--text))' :
                         'hsl(var(--text-muted))',
                  fontWeight: step.status === 'active' ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

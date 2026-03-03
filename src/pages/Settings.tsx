import { useState } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface AppSettings {
  language: string;
  autoTranscribe: boolean;
  autoSave: boolean;
  clinicName: string;
  clinicPhone: string;
  clinicEmail: string;
  emergencyContact: string;
  emergencyPhone: string;
  defaultTemplate: string;
  peEnabledByDefault: boolean;
  dataRetentionDays: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en-GB',
  autoTranscribe: true,
  autoSave: true,
  clinicName: 'Every Tail Vets',
  clinicPhone: '',
  clinicEmail: 'hello@everytailvets.com',
  emergencyContact: 'Veteris Home Emergency Services',
  emergencyPhone: '020 3808 0100',
  defaultTemplate: 'General Consult',
  peEnabledByDefault: true,
  dataRetentionDays: 365,
};

const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem('etv-scribe-settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('etv-scribe-settings', JSON.stringify(settings));
    setSaved(true);
    toast({ title: 'Settings saved', description: 'Your preferences have been saved.' });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-screen bg-cream">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold text-forest hover:text-forest-dark transition-colors no-underline">
              <ArrowLeft size={16} /> Back to Scribe
            </Link>
          </div>

          <h1 className="text-[22px] font-bold text-bark mb-1">Settings</h1>
          <p className="text-sm text-text-muted mb-8">Configure your ETV Scribe preferences</p>

          {/* Language & Recording */}
          <Section title="Language & Recording" description="Speech recognition and transcription settings">
            <Field label="Language" description="Language for speech recognition">
              <select value={settings.language} onChange={(e) => update('language', e.target.value)} className="settings-input">
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="en-AU">English (AU)</option>
              </select>
            </Field>
            <Toggle label="Auto-transcribe" description="Automatically transcribe speech when recording starts" checked={settings.autoTranscribe} onChange={(v) => update('autoTranscribe', v)} />
            <Toggle label="Auto-save sessions" description="Automatically save sessions after generating notes" checked={settings.autoSave} onChange={(v) => update('autoSave', v)} />
          </Section>

          {/* Clinic Details */}
          <Section title="Clinic Details" description="Branding for discharge instructions and exports">
            <Field label="Clinic name">
              <input type="text" value={settings.clinicName} onChange={(e) => update('clinicName', e.target.value)} className="settings-input" />
            </Field>
            <Field label="Clinic phone">
              <input type="tel" value={settings.clinicPhone} onChange={(e) => update('clinicPhone', e.target.value)} className="settings-input" placeholder="+44..." />
            </Field>
            <Field label="Clinic email">
              <input type="email" value={settings.clinicEmail} onChange={(e) => update('clinicEmail', e.target.value)} className="settings-input" />
            </Field>
            <Field label="Emergency contact name">
              <input type="text" value={settings.emergencyContact} onChange={(e) => update('emergencyContact', e.target.value)} className="settings-input" />
            </Field>
            <Field label="Emergency phone">
              <input type="text" value={settings.emergencyPhone} onChange={(e) => update('emergencyPhone', e.target.value)} className="settings-input" />
            </Field>
          </Section>

          {/* Session Defaults */}
          <Section title="Session Defaults" description="Default settings for new sessions">
            <Field label="Default template">
              <select value={settings.defaultTemplate} onChange={(e) => update('defaultTemplate', e.target.value)} className="settings-input">
                {['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Toggle label="Enable PE by default" description="Show physical examination form for new sessions" checked={settings.peEnabledByDefault} onChange={(v) => update('peEnabledByDefault', v)} />
          </Section>

          {/* Privacy & Data */}
          <Section title="Privacy & Data" description="Data retention and privacy settings">
            <Field label="Data retention" description="Number of days to keep session data">
              <select value={settings.dataRetentionDays} onChange={(e) => update('dataRetentionDays', Number(e.target.value))} className="settings-input">
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
                <option value={730}>2 years</option>
              </select>
            </Field>
          </Section>

          {/* Save */}
          <div className="flex justify-end py-6">
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-forest text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-forest-dark transition-colors">
              {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save Settings</>}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .settings-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          background: hsl(var(--card));
          color: hsl(var(--text-primary));
          transition: border-color 0.15s;
        }
        .settings-input:focus {
          border-color: hsl(var(--bark-muted));
        }
      `}</style>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 pb-8 border-b border-border-light">
      <h2 className="text-[15px] font-bold text-bark mb-0.5">{title}</h2>
      <p className="text-xs text-text-muted mb-5">{description}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-text-primary block mb-1">{label}</label>
      {description && <p className="text-[11px] text-text-muted mb-1.5">{description}</p>}
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[13px] font-semibold text-text-primary">{label}</div>
        <div className="text-[11px] text-text-muted">{description}</div>
      </div>
      <div
        className={`relative w-[38px] h-5 rounded-[10px] cursor-pointer transition-colors duration-200 ${checked ? 'bg-forest' : 'bg-sand-deeper'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-[2px] w-4 h-4 bg-card rounded-full transition-[left] duration-200 shadow-sm ${checked ? 'left-5' : 'left-[2px]'}`} />
      </div>
    </div>
  );
}

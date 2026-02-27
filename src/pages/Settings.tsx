import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Globe, Mic, Palette, Shield, Save, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface AppSettings {
  mercuryApiKey: string;
  mercuryModel: string;
  mercuryEndpoint: string;
  language: string;
  autoTranscribe: boolean;
  autoSave: boolean;
  theme: 'light' | 'system';
  clinicName: string;
  clinicPhone: string;
  clinicEmail: string;
  emergencyContact: string;
  emergencyPhone: string;
  defaultTemplate: string;
  peEnabledByDefault: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  mercuryApiKey: 'sk_3588270662ab805f24c94201e16f4188',
  mercuryModel: 'mercury-2',
  mercuryEndpoint: 'https://api.inceptionlabs.ai/v1/chat/completions',
  language: 'en-GB',
  autoTranscribe: true,
  autoSave: true,
  theme: 'light',
  clinicName: 'Every Tail Vets',
  clinicPhone: '',
  clinicEmail: 'hello@everytailvets.com',
  emergencyContact: 'Veteris Home Emergency Services',
  emergencyPhone: '020 3808 0100',
  defaultTemplate: 'General Consult',
  peEnabledByDefault: true,
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
      {/* Sidebar */}
      <aside className="w-[220px] bg-card border-r border-border flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3.5">
          <img src="https://static.tildacdn.one/tild3432-6132-4832-b730-356434303630/horizontal-logo-gree.svg" alt="ETV" className="h-[26px]" />
          <span className="text-[9px] font-bold bg-sand text-bark-muted px-1.5 py-0.5 rounded tracking-wide uppercase">Scribe</span>
        </div>
        <Link to="/" className="mx-3 mb-3 py-2.5 px-4 bg-forest text-primary-foreground border-none rounded-md text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-forest-dark transition-colors duration-150 no-underline">
          <ArrowLeft size={16} /> Back to Scribe
        </Link>

        <nav className="px-2 flex flex-col gap-px mt-2">
          <SettingsNavItem icon={<Key size={17} />} label="AI Configuration" active />
          <SettingsNavItem icon={<Globe size={17} />} label="Language & Region" />
          <SettingsNavItem icon={<Mic size={17} />} label="Audio & Recording" />
          <SettingsNavItem icon={<Palette size={17} />} label="Clinic Details" />
          <SettingsNavItem icon={<Shield size={17} />} label="Privacy & Data" />
        </nav>

        <div className="mt-auto px-3.5 py-3 border-t border-border-light">
          <div className="text-[11px] text-text-muted">ETV Scribe v1.0.0</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-8 py-8">
          <h1 className="text-[22px] font-bold text-bark mb-1">Settings</h1>
          <p className="text-sm text-text-muted mb-8">Configure your ETV Scribe preferences</p>

          {/* AI Configuration */}
          <Section title="AI Configuration" description="Mercury AI 2 connection settings">
            <Field label="API Key" description="Your Inception AI API key">
              <input
                type="password"
                value={settings.mercuryApiKey}
                onChange={(e) => update('mercuryApiKey', e.target.value)}
                className="settings-input"
                placeholder="sk_..."
              />
            </Field>
            <Field label="Model" description="AI model to use for note generation">
              <select
                value={settings.mercuryModel}
                onChange={(e) => update('mercuryModel', e.target.value)}
                className="settings-input"
              >
                <option value="mercury-2">Mercury 2 (Recommended)</option>
                <option value="mercury-coder-small">Mercury Coder Small</option>
              </select>
            </Field>
            <Field label="API Endpoint" description="Mercury AI API endpoint URL">
              <input
                type="url"
                value={settings.mercuryEndpoint}
                onChange={(e) => update('mercuryEndpoint', e.target.value)}
                className="settings-input"
                placeholder="https://api.inceptionlabs.ai/v1/chat/completions"
              />
            </Field>
          </Section>

          {/* Language & Recording */}
          <Section title="Language & Recording" description="Speech recognition and transcription settings">
            <Field label="Language" description="Language for speech recognition">
              <select
                value={settings.language}
                onChange={(e) => update('language', e.target.value)}
                className="settings-input"
              >
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="en-AU">English (AU)</option>
              </select>
            </Field>
            <Toggle
              label="Auto-transcribe"
              description="Automatically transcribe speech when recording starts"
              checked={settings.autoTranscribe}
              onChange={(v) => update('autoTranscribe', v)}
            />
            <Toggle
              label="Auto-save sessions"
              description="Automatically save sessions after generating notes"
              checked={settings.autoSave}
              onChange={(v) => update('autoSave', v)}
            />
          </Section>

          {/* Clinic */}
          <Section title="Clinic Details" description="Branding for discharge instructions and exports">
            <Field label="Clinic name">
              <input
                type="text"
                value={settings.clinicName}
                onChange={(e) => update('clinicName', e.target.value)}
                className="settings-input"
              />
            </Field>
            <Field label="Clinic email">
              <input
                type="email"
                value={settings.clinicEmail}
                onChange={(e) => update('clinicEmail', e.target.value)}
                className="settings-input"
              />
            </Field>
            <Field label="Emergency contact name">
              <input
                type="text"
                value={settings.emergencyContact}
                onChange={(e) => update('emergencyContact', e.target.value)}
                className="settings-input"
              />
            </Field>
            <Field label="Emergency phone">
              <input
                type="text"
                value={settings.emergencyPhone}
                onChange={(e) => update('emergencyPhone', e.target.value)}
                className="settings-input"
              />
            </Field>
          </Section>

          {/* Defaults */}
          <Section title="Session Defaults" description="Default settings for new sessions">
            <Field label="Default template">
              <select
                value={settings.defaultTemplate}
                onChange={(e) => update('defaultTemplate', e.target.value)}
                className="settings-input"
              >
                {['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Toggle
              label="Enable PE by default"
              description="Show physical examination form for new sessions"
              checked={settings.peEnabledByDefault}
              onChange={(v) => update('peEnabledByDefault', v)}
            />
          </Section>

          {/* Save */}
          <div className="flex justify-end py-6">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-forest text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-forest-dark transition-colors"
            >
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

function SettingsNavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-all duration-100 ${
      active ? 'bg-sand-dark text-bark font-semibold' : 'text-text-secondary hover:bg-sand hover:text-text-primary'
    }`}>
      <span className={active ? 'opacity-100' : 'opacity-65'}>{icon}</span> {label}
    </div>
  );
}

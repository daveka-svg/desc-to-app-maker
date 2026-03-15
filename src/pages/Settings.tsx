import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Save, Check, Loader2, Upload, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore } from '@/stores/useSessionStore';
import {
  AI_GENERATION_OPTIONS,
  DEFAULT_AI_GENERATION_MODE,
  SETTINGS_STORAGE_KEY,
  type AiGenerationMode,
} from '@/lib/appSettings';
import { DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE } from '@/lib/defaultClinicKnowledgeBase';
import {
  getTaskExtractionPrompt,
  resetTaskExtractionPrompt,
  setTaskExtractionPrompt,
} from '@/lib/promptSettings';
import {
  bootstrapUserTemplates,
  cleanupDuplicateTemplates,
  createTemplate,
  deleteTemplate,
  listUserTemplates,
  syncDefaultTemplatePrompts,
  updateTemplate,
  type UserTemplate,
} from '@/lib/templatePrompts';

interface AppSettings {
  aiGenerationMode: AiGenerationMode;
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
  aiGenerationMode: DEFAULT_AI_GENERATION_MODE,
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

const KNOWLEDGE_BASE_MAX_CHARS = 500000;
const TASK_PROMPT_MAX_CHARS = 40000;
const TEMPLATE_PROMPT_MAX_CHARS = 40000;

const normalizeTemplateName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

const getNextTemplateName = (templates: UserTemplate[]): string => {
  const existingNames = new Set(templates.map((template) => normalizeTemplateName(template.name)));
  let counter = 1;
  while (true) {
    const candidate = counter === 1 ? 'New Template' : `New Template ${counter}`;
    if (!existingNames.has(normalizeTemplateName(candidate))) {
      return candidate;
    }
    counter += 1;
  }
};

const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const isMissingKnowledgeBaseColumn = (message: string): boolean =>
  message.includes('clinic_knowledge_base') && (
    message.includes('column') ||
    message.includes('schema cache')
  );

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [clinicKnowledgeBase, setClinicKnowledgeBase] = useState(DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE);
  const [taskExtractionPrompt, setTaskExtractionPromptState] = useState(getTaskExtractionPrompt);
  const [saved, setSaved] = useState(false);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templatePromptDraft, setTemplatePromptDraft] = useState('');
  const setStoreClinicKnowledgeBase = useSessionStore((s) => s.setClinicKnowledgeBase);
  const setStoreAvailableTemplates = useSessionStore((s) => s.setAvailableTemplates);
  const selectedTemplateInStore = useSessionStore((s) => s.selectedTemplate);
  const setStoreSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const { toast } = useToast();

  const applyTemplateSelection = useCallback((
    nextTemplates: UserTemplate[],
    preferredTemplateId?: string,
    preferredTemplateName?: string
  ) => {
    setTemplates(nextTemplates);
    const templateNames = nextTemplates.map((template) => template.name);
    setStoreAvailableTemplates(templateNames);

    const selected =
      nextTemplates.find((template) => template.id === preferredTemplateId) ||
      nextTemplates.find(
        (template) => normalizeTemplateName(template.name) === normalizeTemplateName(preferredTemplateName || '')
      ) ||
      nextTemplates.find(
        (template) => normalizeTemplateName(template.name) === normalizeTemplateName(selectedTemplateInStore)
      ) ||
      nextTemplates[0] ||
      null;

    if (!selected) {
      setSelectedTemplateId('');
      setTemplateNameDraft('');
      setTemplatePromptDraft('');
      return;
    }

    setSelectedTemplateId(selected.id);
    setTemplateNameDraft(selected.name);
    setTemplatePromptDraft(selected.systemPrompt);
  }, [selectedTemplateInStore, setStoreAvailableTemplates]);

  useEffect(() => {
    const loadKnowledgeBase = async () => {
      setLoadingKnowledge(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoadingKnowledge(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('clinic_knowledge_base' as any)
          .eq('user_id', user.id)
          .single();

        const profileData = data as any;
        if (!error && typeof profileData?.clinic_knowledge_base === 'string' && profileData.clinic_knowledge_base.trim()) {
          setClinicKnowledgeBase(profileData.clinic_knowledge_base);
          setStoreClinicKnowledgeBase(profileData.clinic_knowledge_base);
        } else {
          setClinicKnowledgeBase(DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE);
          setStoreClinicKnowledgeBase(DEFAULT_ETV_CLINIC_KNOWLEDGE_BASE);
        }
      } catch (error) {
        console.warn('Could not load clinic knowledge base:', error);
      } finally {
        setLoadingKnowledge(false);
      }
    };

    loadKnowledgeBase();
  }, [setStoreClinicKnowledgeBase]);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        await cleanupDuplicateTemplates();
        await bootstrapUserTemplates();
        await syncDefaultTemplatePrompts();
        const nextTemplates = await listUserTemplates();
        applyTemplateSelection(nextTemplates);
      } catch (error) {
        console.error('Could not load templates:', error);
        toast({
          title: 'Template load failed',
          description: 'Could not load editable templates from storage.',
          variant: 'destructive',
        });
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [applyTemplateSelection, toast]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleKnowledgeFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    let nextValue = clinicKnowledgeBase.trim();

    for (const file of files) {
      try {
        const raw = await file.text();
        if (!raw.trim()) continue;
        const sourceBlock = `Source: ${file.name}\n${raw.trim()}`;
        nextValue = nextValue
          ? `${nextValue}\n\n${sourceBlock}`
          : sourceBlock;
      } catch (error) {
        console.error(`Could not read ${file.name}:`, error);
      }
    }

    const clipped = nextValue.slice(0, KNOWLEDGE_BASE_MAX_CHARS);
    setClinicKnowledgeBase(clipped);
    setSaved(false);
    event.target.value = '';
  };

  const handleSave = async () => {
    setSavingKnowledge(true);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setTaskExtractionPrompt(taskExtractionPrompt.slice(0, TASK_PROMPT_MAX_CHARS));

    let knowledgeSaved = false;
    let knowledgeColumnMissing = false;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const payload = clinicKnowledgeBase.slice(0, KNOWLEDGE_BASE_MAX_CHARS);
        const { error } = await supabase
          .from('profiles')
          .upsert(
            {
              user_id: user.id,
              clinic_knowledge_base: payload,
            } as any,
            { onConflict: 'user_id' }
          );

        if (error) {
          const message = String(error.message || '');
          if (isMissingKnowledgeBaseColumn(message)) {
            knowledgeColumnMissing = true;
          } else {
            throw error;
          }
        } else {
          setStoreClinicKnowledgeBase(payload);
          knowledgeSaved = true;
        }
      }

      setSaved(true);
      if (knowledgeColumnMissing) {
        toast({
          title: 'Local settings saved',
          description: 'Clinic knowledge base column is missing in Supabase. Run latest migration to enable remote storage.',
          variant: 'destructive',
        });
      } else if (knowledgeSaved || clinicKnowledgeBase.trim().length === 0) {
        toast({
          title: 'Settings saved',
          description: 'Preferences and clinic personalization context have been saved.',
        });
      } else {
        toast({
          title: 'Settings saved',
          description: 'Preferences saved locally.',
        });
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Settings save failed:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save your clinic knowledge base. Local settings were still saved.',
        variant: 'destructive',
      });
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const selected = templates.find((template) => template.id === templateId);
    setSelectedTemplateId(templateId);
    setTemplateSaved(false);
    setTemplateNameDraft(selected?.name || '');
    setTemplatePromptDraft(selected?.systemPrompt || '');
  };

  const handleCreateTemplate = async () => {
    setSavingTemplate(true);
    try {
      const created = await createTemplate(getNextTemplateName(templates), '');
      const nextTemplates = await listUserTemplates();
      applyTemplateSelection(nextTemplates, created.id);
      setTemplateSaved(false);
      toast({
        title: 'Template created',
        description: 'New template added. Edit the name and prompt, then save.',
      });
    } catch (error) {
      console.error('Template creation failed:', error);
      toast({
        title: 'Template creation failed',
        description: error instanceof Error ? error.message : 'Could not create template.',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return;
    const trimmedName = templateNameDraft.trim();
    if (!trimmedName) {
      toast({
        title: 'Template name required',
        description: 'Enter a template name before saving.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTemplate(true);
    try {
      const currentTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
      const updated = await updateTemplate(selectedTemplateId, {
        name: trimmedName,
        systemPrompt: templatePromptDraft.slice(0, TEMPLATE_PROMPT_MAX_CHARS),
      });
      const nextTemplates = await listUserTemplates();
      applyTemplateSelection(nextTemplates, updated.id, updated.name);

      if (settings.defaultTemplate === currentTemplate?.name) {
        setSettings((state) => ({ ...state, defaultTemplate: updated.name }));
      }
      if (normalizeTemplateName(selectedTemplateInStore) === normalizeTemplateName(currentTemplate?.name || '')) {
        setStoreSelectedTemplate(updated.name);
      }

      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2000);
      toast({
        title: 'Template saved',
        description: 'Template name and prompt have been updated.',
      });
    } catch (error) {
      console.error('Template save failed:', error);
      toast({
        title: 'Template save failed',
        description: error instanceof Error ? error.message : 'Could not save template.',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (templates.length <= 1) {
      toast({
        title: 'Cannot delete last template',
        description: 'Keep at least one template available.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTemplate(true);
    try {
      const currentTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
      await deleteTemplate(selectedTemplateId);
      const nextTemplates = await listUserTemplates();
      applyTemplateSelection(nextTemplates);

      if (settings.defaultTemplate === currentTemplate?.name) {
        setSettings((state) => ({
          ...state,
          defaultTemplate: nextTemplates[0]?.name || state.defaultTemplate,
        }));
      }
      if (normalizeTemplateName(selectedTemplateInStore) === normalizeTemplateName(currentTemplate?.name || '')) {
        setStoreSelectedTemplate(nextTemplates[0]?.name || 'General Consult');
      }

      setTemplateSaved(false);
      toast({
        title: 'Template deleted',
        description: 'Template removed from your settings.',
      });
    } catch (error) {
      console.error('Template deletion failed:', error);
      toast({
        title: 'Template delete failed',
        description: error instanceof Error ? error.message : 'Could not delete template.',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="flex h-screen bg-cream">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold text-forest hover:text-forest-dark transition-colors no-underline">
              <ArrowLeft size={16} /> Back to Scribe
            </Link>
          </div>

          <h1 className="text-[22px] font-bold text-bark mb-1">Settings</h1>
          <p className="text-sm text-text-muted mb-8">Configure your ETV Scribe preferences</p>

          <Section title="AI Model" description="Choose the model used for notes, tasks, client text, and chat. Switch and regenerate to compare outputs.">
            <Field label="Generation model">
              <select
                value={settings.aiGenerationMode}
                onChange={(e) => update('aiGenerationMode', e.target.value as AiGenerationMode)}
                className="settings-input"
              >
                {AI_GENERATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="text-[11px] text-text-muted">
              {
                AI_GENERATION_OPTIONS.find((option) => option.value === settings.aiGenerationMode)?.description
              }
            </div>
          </Section>

          <Section title="Clinic Knowledge Base" description="Upload your clinic style guide, contact wording, communication preferences, and reusable policy text. This context is injected separately from templates.">
            {loadingKnowledge ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading clinic context...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-sand cursor-pointer hover:bg-sand-dark">
                    <Upload size={13} />
                    Upload text file
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json,.log"
                      multiple
                      className="hidden"
                      onChange={handleKnowledgeFileUpload}
                    />
                  </label>
                  <button
                    onClick={() => {
                      setClinicKnowledgeBase('');
                      setSaved(false);
                    }}
                    disabled={!clinicKnowledgeBase.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-sand disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    Clear
                  </button>
                </div>

                <textarea
                  value={clinicKnowledgeBase}
                  onChange={(event) => {
                    setClinicKnowledgeBase(event.target.value.slice(0, KNOWLEDGE_BASE_MAX_CHARS));
                    setSaved(false);
                  }}
                  className="settings-textarea"
                  placeholder="Paste your clinic knowledge base here. Example: practice tone, discharge style, clinic contact signatures, emergency wording, and standard care communication patterns."
                />

                <div className="text-[11px] text-text-muted">
                  Stored: {clinicKnowledgeBase.length.toLocaleString()} / {KNOWLEDGE_BASE_MAX_CHARS.toLocaleString()} characters.
                  During generation, the model uses a packed window so 20-30 minute transcripts remain prioritized while still applying clinic context.
                </div>
              </>
            )}
          </Section>

          <Section
            title="Template Settings"
            description="Edit the note templates used for generation. Changes here affect future regenerations."
          >
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading templates...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateTemplate}
                    disabled={savingTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-sand disabled:opacity-40"
                  >
                    <Upload size={13} />
                    Add template
                  </button>
                  <button
                    onClick={handleDeleteTemplate}
                    disabled={savingTemplate || !selectedTemplateId || templates.length <= 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-sand disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    Delete template
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !selectedTemplateId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-forest text-primary-foreground hover:bg-forest-dark disabled:opacity-40"
                  >
                    {savingTemplate ? <Loader2 size={13} className="animate-spin" /> : templateSaved ? <Check size={13} /> : <Save size={13} />}
                    {savingTemplate ? 'Saving...' : templateSaved ? 'Saved' : 'Save template'}
                  </button>
                </div>

                <Field label="Template">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="settings-input"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Template name">
                  <input
                    type="text"
                    value={templateNameDraft}
                    onChange={(e) => {
                      setTemplateNameDraft(e.target.value);
                      setTemplateSaved(false);
                    }}
                    className="settings-input"
                    placeholder="Template name"
                  />
                </Field>

                <Field
                  label="Template prompt"
                  description="This is the editable instruction body stored for this template."
                >
                  <textarea
                    value={templatePromptDraft}
                    onChange={(event) => {
                      setTemplatePromptDraft(event.target.value.slice(0, TEMPLATE_PROMPT_MAX_CHARS));
                      setTemplateSaved(false);
                    }}
                    className="settings-textarea"
                    placeholder="Template prompt"
                  />
                </Field>

                <div className="text-[11px] text-text-muted">
                  Stored: {templatePromptDraft.length.toLocaleString()} / {TEMPLATE_PROMPT_MAX_CHARS.toLocaleString()} characters.
                </div>
              </>
            )}
          </Section>

          <Section
            title="Task Extraction Prompt"
            description="Edit the exact instruction used when AI extracts tasks from generated notes."
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTaskExtractionPromptState(resetTaskExtractionPrompt());
                  setSaved(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-sand"
              >
                <Trash2 size={13} />
                Reset to default
              </button>
            </div>

            <textarea
              value={taskExtractionPrompt}
              onChange={(event) => {
                setTaskExtractionPromptState(event.target.value.slice(0, TASK_PROMPT_MAX_CHARS));
                setSaved(false);
              }}
              className="settings-textarea"
              placeholder="Task extraction prompt"
            />

            <div className="text-[11px] text-text-muted">
              Stored: {taskExtractionPrompt.length.toLocaleString()} / {TASK_PROMPT_MAX_CHARS.toLocaleString()} characters.
            </div>

            <Field
              label="What is sent to AI"
              description="This is the exact structure submitted during task extraction."
            >
              <pre className="settings-codeblock">{`${taskExtractionPrompt.trim() || '(empty prompt)'}

Consultation transcript:
<transcript only, clipped>`}</pre>
            </Field>
          </Section>

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

          <Section title="Session Defaults" description="Default settings for new sessions">
            <Field label="Default template">
              <select value={settings.defaultTemplate} onChange={(e) => update('defaultTemplate', e.target.value)} className="settings-input">
                {(templates.length > 0 ? templates.map((template) => template.name) : ['General Consult', 'Surgical Notes', 'Emergency', 'Vaccination', 'Dental', 'Post-op Check']).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Toggle label="Enable PE by default" description="Show physical examination form for new sessions" checked={settings.peEnabledByDefault} onChange={(v) => update('peEnabledByDefault', v)} />
          </Section>

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

          <div className="flex justify-end py-6">
            <button onClick={handleSave} disabled={savingKnowledge} className="flex items-center gap-2 px-6 py-2.5 bg-forest text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-forest-dark transition-colors disabled:opacity-60">
              {savingKnowledge ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : saved ? (
                <>
                  <Check size={16} /> Saved
                </>
              ) : (
                <>
                  <Save size={16} /> Save Settings
                </>
              )}
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
        .settings-textarea {
          width: 100%;
          min-height: 220px;
          resize: vertical;
          padding: 10px 12px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          font-size: 12px;
          line-height: 1.6;
          outline: none;
          background: hsl(var(--card));
          color: hsl(var(--text-primary));
          transition: border-color 0.15s;
        }
        .settings-textarea:focus {
          border-color: hsl(var(--bark-muted));
        }
        .settings-codeblock {
          white-space: pre-wrap;
          font-size: 11px;
          line-height: 1.5;
          background: hsl(var(--sand));
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          padding: 10px 12px;
          color: hsl(var(--text-secondary));
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

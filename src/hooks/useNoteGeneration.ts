import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { extractLlmText, sanitizePlainClinicalText, upsertSeparatePESection } from '@/lib/llm';
import { getTemplatePrompt } from '@/lib/templatePrompts';
import { buildNotesGenerationInput } from '@/lib/clinicContext';
import { getAiGenerationConfig, getOpenAiGenerationConfig } from '@/lib/appSettings';
import { inferTemplateKind } from '@/lib/templateKind';

interface GenerateNoteOptions {
  forceOpenAI?: boolean;
}

interface NoteGenerationSnapshot {
  sessionId: string | null;
  transcript: string;
  selectedTemplate: string;
  peEnabled: boolean;
  peIncludeInNotes: boolean;
  peData: unknown;
  peAppliedSummary: string;
  vetNotes: string;
  supplementalContext: string;
  clinicKnowledgeBase: string;
  patientName: string;
  sessionTitle: string;
  sessionDurationSeconds: number;
}

const DRAFT_GENERATION_KEY = '__draft__';
const noteGenerationRunsBySession = new Map<string, number>();
const READY_STATUS_MS = 120000;

const clearReadyStatusLater = (sessionId: string) => {
  if (typeof window === 'undefined') return;
  const readyJobUpdatedAt = useSessionStore.getState().sessionGenerationJobs[sessionId]?.updatedAt;
  window.setTimeout(() => {
    const currentJob = useSessionStore.getState().sessionGenerationJobs[sessionId];
    if (currentJob?.status === 'done' && currentJob.updatedAt === readyJobUpdatedAt) {
      useSessionStore.getState().clearSessionGenerationJob(sessionId);
    }
  }, READY_STATUS_MS);
};

const formatDurationLabel = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const resolveSessionTitle = (snapshot: NoteGenerationSnapshot): string => {
  const currentTitle = snapshot.sessionTitle.trim();
  const durationLabel = formatDurationLabel(snapshot.sessionDurationSeconds);
  if (currentTitle && /\b0m$/i.test(currentTitle)) {
    return currentTitle.replace(/\b0m$/i, durationLabel);
  }
  if (currentTitle) return currentTitle;

  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const prefix = snapshot.patientName.trim() || snapshot.selectedTemplate || 'Consultation';
  return `${prefix} - ${date} ${time} - ${durationLabel}`;
};

const persistGeneratedNoteForSession = async (
  snapshot: NoteGenerationSnapshot,
  content: string,
) => {
  if (!snapshot.sessionId) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('sessions')
    .update({
      patient_name: snapshot.patientName || null,
      title: resolveSessionTitle(snapshot),
      session_type: snapshot.selectedTemplate,
      pe_data: snapshot.peEnabled ? (snapshot.peData as any) : null,
      pe_enabled: snapshot.peEnabled,
      duration_seconds: snapshot.sessionDurationSeconds,
      status: 'completed',
    })
    .eq('id', snapshot.sessionId)
    .eq('user_id', user.id);

  await supabase.from('notes').delete().eq('session_id', snapshot.sessionId).eq('user_id', user.id);
  await supabase.from('notes').insert({
    user_id: user.id,
    session_id: snapshot.sessionId,
    content,
    transcript: snapshot.transcript,
    supplemental_context: snapshot.supplementalContext || null,
    vet_notes: snapshot.vetNotes || null,
  });
};

export function useNoteGeneration() {
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const isGeneratingNotes = useSessionStore((s) => s.isGeneratingNotes);
  const setIsGeneratingNotes = useSessionStore((s) => s.setIsGeneratingNotes);

  const generateNote = useCallback(async (templateOverride?: string, options: GenerateNoteOptions = {}) => {
    const state = useSessionStore.getState();
    const snapshot: NoteGenerationSnapshot = {
      sessionId: state.activeSessionId,
      transcript: state.transcript,
      selectedTemplate: templateOverride || state.selectedTemplate,
      peEnabled: state.peEnabled,
      peIncludeInNotes: state.peIncludeInNotes,
      peData: state.peData,
      peAppliedSummary: state.peAppliedSummary,
      vetNotes: state.vetNotes,
      supplementalContext: state.supplementalContext,
      clinicKnowledgeBase: state.clinicKnowledgeBase,
      patientName: state.patientName,
      sessionTitle: state.sessionTitle,
      sessionDurationSeconds: state.sessionDurationSeconds,
    };
    if (!snapshot.transcript.trim()) throw new Error('No transcript available');

    const generationKey = snapshot.sessionId || DRAFT_GENERATION_KEY;
    const runId = (noteGenerationRunsBySession.get(generationKey) || 0) + 1;
    noteGenerationRunsBySession.set(generationKey, runId);
    if (snapshot.sessionId) {
      state.setSessionGenerationJob(snapshot.sessionId, {
        status: 'running',
        message: 'Generating clinical notes...',
      });
    }

    const isLatestRunForSession = () => noteGenerationRunsBySession.get(generationKey) === runId;
    const isActiveRunTarget = () => {
      const current = useSessionStore.getState();
      return (
        isLatestRunForSession() &&
        current.activeSessionId === snapshot.sessionId &&
        current.transcript.trim() === snapshot.transcript.trim()
      );
    };

    setIsGeneratingNotes(true);
    if (isActiveRunTarget()) {
      setNotes('');
    }

    try {
      const templateToUse = snapshot.selectedTemplate;
      const fallbackTemplate = TEMPLATES[templateToUse] || TEMPLATES['General Consult'];
      const templatePrompt = await getTemplatePrompt(templateToUse, fallbackTemplate);
      const templateKind = inferTemplateKind(templateToUse, templatePrompt);
      const includeClinicalContext = snapshot.peEnabled && snapshot.peIncludeInNotes;
      const includeClinicContext = templateKind !== 'general_consult';
      const compiledPEReport = includeClinicalContext ? compilePEReport(snapshot.peData) : '';
      const peReport = includeClinicalContext
        ? (compiledPEReport.trim() || snapshot.peAppliedSummary.trim())
        : '';
      const peReportForPrompt = templateKind === 'general_consult' ? '' : peReport;
      const vetNotesForGeneration = includeClinicalContext ? snapshot.vetNotes : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const aiConfig = options.forceOpenAI ? getOpenAiGenerationConfig() : getAiGenerationConfig();
      const payloadTranscript = buildNotesGenerationInput({
        transcript: snapshot.transcript,
        peReport: peReportForPrompt,
        vetNotes: vetNotesForGeneration,
        supplementalContext: snapshot.supplementalContext,
        clinicKnowledgeBase: snapshot.clinicKnowledgeBase,
        includeClinicContext,
      });

      const response = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: payloadTranscript,
          peData: includeClinicalContext ? snapshot.peData : null,
          templatePrompt: fullPrompt,
          generalConsultTemplatePrompt: templateKind === 'general_consult' ? templatePrompt : null,
          requestType: 'notes',
          templateName: templateToUse,
          templateKind,
          llmProvider: aiConfig.provider,
          llmModel: aiConfig.model,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const rawNotesContent = sanitizePlainClinicalText(await extractLlmText(response.data));
      const notesContent =
        templateKind === 'general_consult'
          ? upsertSeparatePESection(rawNotesContent, peReport)
          : rawNotesContent;
      const generatedAt = Date.now();

      if (isLatestRunForSession()) {
        await persistGeneratedNoteForSession(snapshot, notesContent);
        if (snapshot.sessionId) {
          useSessionStore.getState().setSessionGenerationJob(snapshot.sessionId, {
            status: 'done',
            message: 'Ready',
          });
          clearReadyStatusLater(snapshot.sessionId);
          window.dispatchEvent(new Event('session-saved'));
        }
      }

      if (isActiveRunTarget()) {
        setNotes(notesContent);
        useSessionStore.getState().setNotesGeneratedAt(generatedAt);
        if (includeClinicalContext && compiledPEReport.trim()) {
          useSessionStore.getState().setPEAppliedSnapshot(compiledPEReport);
        }
        return true;
      }

      return false;
    } catch (err) {
      console.error('Note generation error:', err);
      if (snapshot.sessionId && isLatestRunForSession()) {
        useSessionStore.getState().setSessionGenerationJob(snapshot.sessionId, {
          status: 'error',
          message: err instanceof Error ? err.message : 'Note generation failed.',
        });
      }
      throw err;
    } finally {
      if (isActiveRunTarget()) {
        setIsGeneratingNotes(false);
      }
    }
  }, [setNotes, setIsGeneratingNotes]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}


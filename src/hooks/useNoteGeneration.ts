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

export function useNoteGeneration() {
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const isGeneratingNotes = useSessionStore((s) => s.isGeneratingNotes);
  const setIsGeneratingNotes = useSessionStore((s) => s.setIsGeneratingNotes);

  const generateNote = useCallback(async (templateOverride?: string, options: GenerateNoteOptions = {}) => {
    const state = useSessionStore.getState();
    const transcriptToUse = state.transcript;
    if (!transcriptToUse.trim()) throw new Error('No transcript available');

    setIsGeneratingNotes(true);
    setNotes('');

    try {
      const latest = useSessionStore.getState();
      const templateToUse = templateOverride || latest.selectedTemplate;
      const fallbackTemplate = TEMPLATES[templateToUse] || TEMPLATES['General Consult'];
      const templatePrompt = await getTemplatePrompt(templateToUse, fallbackTemplate);
      const templateKind = inferTemplateKind(templateToUse, templatePrompt);
      const includeClinicalContext = latest.peEnabled && latest.peIncludeInNotes;
      const includeClinicContext = templateKind !== 'general_consult';
      const compiledPEReport = includeClinicalContext ? compilePEReport(latest.peData) : '';
      const peReport = includeClinicalContext
        ? (compiledPEReport.trim() || latest.peAppliedSummary.trim())
        : '';
      const peReportForPrompt = templateKind === 'general_consult' ? '' : peReport;
      const vetNotesForGeneration = includeClinicalContext ? latest.vetNotes : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const aiConfig = options.forceOpenAI ? getOpenAiGenerationConfig() : getAiGenerationConfig();
      const payloadTranscript = buildNotesGenerationInput({
        transcript: transcriptToUse,
        peReport: peReportForPrompt,
        vetNotes: vetNotesForGeneration,
        supplementalContext: latest.supplementalContext,
        clinicKnowledgeBase: latest.clinicKnowledgeBase,
        includeClinicContext,
      });

      const response = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: payloadTranscript,
          peData: includeClinicalContext ? latest.peData : null,
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
      setNotes(notesContent);
      if (includeClinicalContext && compiledPEReport.trim()) {
        useSessionStore.getState().setPEAppliedSnapshot(compiledPEReport);
      }
    } catch (err) {
      console.error('Note generation error:', err);
      throw err;
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [setNotes, setIsGeneratingNotes]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}


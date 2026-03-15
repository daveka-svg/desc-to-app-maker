import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { extractLlmText, sanitizePlainClinicalText, upsertSeparatePESection } from '@/lib/llm';
import { getTemplatePrompt } from '@/lib/templatePrompts';
import { buildNotesGenerationInput } from '@/lib/clinicContext';
import { getAiGenerationConfig } from '@/lib/appSettings';
import { inferTemplateKind } from '@/lib/templateKind';

export function useNoteGeneration() {
  const transcript = useSessionStore((s) => s.transcript);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const peIncludeInNotes = useSessionStore((s) => s.peIncludeInNotes);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const vetNotes = useSessionStore((s) => s.vetNotes);
  const clinicKnowledgeBase = useSessionStore((s) => s.clinicKnowledgeBase);
  const peAppliedSummary = useSessionStore((s) => s.peAppliedSummary);
  const setPEAppliedSnapshot = useSessionStore((s) => s.setPEAppliedSnapshot);
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const isGeneratingNotes = useSessionStore((s) => s.isGeneratingNotes);
  const setIsGeneratingNotes = useSessionStore((s) => s.setIsGeneratingNotes);

  const generateNote = useCallback(async (templateOverride?: string) => {
    if (!transcript.trim()) throw new Error('No transcript available');

    setIsGeneratingNotes(true);
    setNotes('');

    try {
      const templateToUse = templateOverride || selectedTemplate;
      const fallbackTemplate = TEMPLATES[templateToUse] || TEMPLATES['General Consult'];
      const templatePrompt = await getTemplatePrompt(templateToUse, fallbackTemplate);
      const templateKind = inferTemplateKind(templateToUse, templatePrompt);
      const includeClinicalContext = peEnabled && peIncludeInNotes;
      const includeClinicContext = templateKind !== 'general_consult';
      const compiledPEReport = includeClinicalContext ? compilePEReport(peData) : '';
      const peReport = includeClinicalContext
        ? (compiledPEReport.trim() || peAppliedSummary.trim())
        : '';
      const peReportForPrompt = templateKind === 'general_consult' ? '' : peReport;
      const vetNotesForGeneration = includeClinicalContext ? vetNotes : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const aiConfig = getAiGenerationConfig();
      const payloadTranscript = buildNotesGenerationInput({
        transcript,
        peReport: peReportForPrompt,
        vetNotes: vetNotesForGeneration,
        clinicKnowledgeBase,
        includeClinicContext,
      });

      const response = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: payloadTranscript,
          peData: includeClinicalContext ? peData : null,
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
        setPEAppliedSnapshot(compiledPEReport);
      }
    } catch (err) {
      console.error('Note generation error:', err);
      throw err;
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [
    transcript,
    peData,
    peEnabled,
    peIncludeInNotes,
    selectedTemplate,
    vetNotes,
    setNotes,
    setIsGeneratingNotes,
    clinicKnowledgeBase,
    peAppliedSummary,
    setPEAppliedSnapshot,
  ]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}


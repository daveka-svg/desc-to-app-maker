import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { extractLlmText, sanitizePlainClinicalText } from '@/lib/llm';
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
      const peReport = includeClinicalContext ? compilePEReport(peData) : '';
      const vetNotesForGeneration = includeClinicalContext ? vetNotes : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const aiConfig = getAiGenerationConfig();
      const payloadTranscript = buildNotesGenerationInput({
        transcript,
        peReport,
        vetNotes: vetNotesForGeneration,
        clinicKnowledgeBase,
        includeClinicContext,
      });

      const response = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: payloadTranscript,
          peData: includeClinicalContext ? peData : null,
          templatePrompt: fullPrompt,
          requestType: 'notes',
          templateName: templateToUse,
          templateKind,
          llmProvider: aiConfig.provider,
          llmModel: aiConfig.model,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const notesContent = sanitizePlainClinicalText(await extractLlmText(response.data));
      setNotes(notesContent);
      if (includeClinicalContext && peReport.trim()) {
        setPEAppliedSnapshot(peReport);
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
    setPEAppliedSnapshot,
  ]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}


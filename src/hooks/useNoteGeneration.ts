import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { extractLlmText } from '@/lib/llm';
import { getTemplatePrompt } from '@/lib/templatePrompts';

export function useNoteGeneration() {
  const transcript = useSessionStore((s) => s.transcript);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
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
      const peReport = peEnabled ? compilePEReport(peData) : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const payloadTranscript = peReport
        ? `${transcript}\n\nPhysical Examination:\n${peReport}`
        : transcript;

      const response = await supabase.functions.invoke('generate-notes', {
        body: { transcript: payloadTranscript, peData: peEnabled ? peData : null, templatePrompt: fullPrompt },
      });

      if (response.error) throw new Error(response.error.message);

      const notesContent = await extractLlmText(response.data);
      setNotes(notesContent);
    } catch (err) {
      console.error('Note generation error:', err);
      throw err;
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [transcript, peData, peEnabled, selectedTemplate, setNotes, setIsGeneratingNotes]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}


import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';

export function useNoteGeneration() {
  const transcript = useSessionStore((s) => s.transcript);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const notes = useSessionStore((s) => s.notes);
  const setNotes = useSessionStore((s) => s.setNotes);
  const isGeneratingNotes = useSessionStore((s) => s.isGeneratingNotes);
  const setIsGeneratingNotes = useSessionStore((s) => s.setIsGeneratingNotes);

  const generateNote = useCallback(async () => {
    if (!transcript.trim()) throw new Error('No transcript available');

    setIsGeneratingNotes(true);
    setNotes('');

    try {
      const templatePrompt = TEMPLATES[selectedTemplate] || TEMPLATES['General Consult'];
      const peReport = peEnabled ? compilePEReport(peData) : '';
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const userContent = `Generate clinical notes from the following consultation transcript:${peReport ? `\n\nPhysical Examination:\n${peReport}` : ''}\n\nTranscript:\n${transcript}`;

      const response = await supabase.functions.invoke('generate-notes', {
        body: { transcript: userContent, peData: peEnabled ? peData : null, templatePrompt: fullPrompt },
      });

      if (response.error) throw new Error(response.error.message);

      const text = typeof response.data === 'string' ? response.data :
                   response.data instanceof Blob ? await response.data.text() :
                   JSON.stringify(response.data);

      let notesContent = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) notesContent += content;
        } catch { /* skip */ }
      }

      if (!notesContent && typeof response.data === 'object' && response.data?.choices) {
        notesContent = response.data.choices[0]?.message?.content || '';
      }
      if (!notesContent) notesContent = text;

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

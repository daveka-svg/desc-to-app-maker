import { useCallback } from 'react';
import { streamMercuryChat, type ChatMessage } from '@/lib/mercury';
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
      const peReport = peEnabled ? compilePEReport(peData) : 'No structured physical examination recorded.';

      const abnDetails: string[] = [];
      for (const f of ['eyes', 'ears', 'nose', 'oral', 'plns', 'heart', 'lungs', 'hydration', 'abdoPalp', 'skinCoat'] as const) {
        const detail = (peData as any)[`${f}Detail`];
        if (detail) abnDetails.push(`${f}: ${detail}`);
      }

      const userContent = `${templatePrompt}\n\n1. Session: ${selectedTemplate} - ${new Date().toLocaleDateString('en-GB')}\n\n2. Structured PE:\n${peReport}${abnDetails.length ? `\n\nAbnormal details:\n${abnDetails.join('\n')}` : ''}\n\n3. Full transcript:\n${transcript}`;

      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ];

      let noteSoFar = '';
      for await (const chunk of streamMercuryChat(messages)) {
        noteSoFar += chunk;
        setNotes(noteSoFar);
      }
    } catch (err) {
      console.error('Note generation error:', err);
      throw err;
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [transcript, peData, peEnabled, selectedTemplate, setNotes, setIsGeneratingNotes]);

  return { notes, isGeneratingNotes, generateNote, setNotes };
}

import { useCallback } from 'react';
import { mercuryChat, type ChatMessage } from '@/lib/mercury';
import { CLIENT_INSTRUCTIONS_PROMPT } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';

export function useClientInstructions() {
  const setClientInstructions = useSessionStore((s) => s.setClientInstructions);
  const isGeneratingCI = useSessionStore((s) => s.isGeneratingCI);
  const setIsGeneratingCI = useSessionStore((s) => s.setIsGeneratingCI);

  const generateInstructions = useCallback(async () => {
    const { notes, transcript } = useSessionStore.getState();
    if (!notes.trim() && !transcript.trim()) throw new Error('No notes or transcript available');

    setIsGeneratingCI(true);
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a veterinary client communication specialist for Every Tail Vets (London, UK). Write in warm, reassuring UK English.' },
        { role: 'user', content: `${CLIENT_INSTRUCTIONS_PROMPT}\n\nClinical Notes:\n${notes}\n\nTranscript:\n${transcript}` },
      ];

      const response = await mercuryChat(messages);

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      setClientInstructions({
        thingsToDo: parsed.thingsToDo || '',
        thingsToAvoid: parsed.thingsToAvoid || '',
        medication: parsed.medication || '',
        whenToContact: parsed.whenToContact || '',
        followUp: parsed.followUp || '',
      });
    } catch (err) {
      console.error('Client instructions generation error:', err);
      throw err;
    } finally {
      setIsGeneratingCI(false);
    }
  }, [setClientInstructions, setIsGeneratingCI]);

  return { generateInstructions, isGeneratingCI };
}

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CLIENT_INSTRUCTIONS_PROMPT } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { buildClientInstructionsInput } from '@/lib/clinicContext';

async function parseSSEText(raw: unknown): Promise<string> {
  const text = typeof raw === 'string'
    ? raw
    : raw instanceof Blob
      ? await raw.text()
      : JSON.stringify(raw);

  let content = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const chunk = parsed.choices?.[0]?.delta?.content;
      if (chunk) content += chunk;
    } catch {
      // noop
    }
  }
  return content || text;
}

export function useClientInstructions() {
  const notes = useSessionStore((s) => s.notes);
  const transcript = useSessionStore((s) => s.transcript);
  const clinicKnowledgeBase = useSessionStore((s) => s.clinicKnowledgeBase);
  const setClientInstructions = useSessionStore((s) => s.setClientInstructions);
  const isGeneratingCI = useSessionStore((s) => s.isGeneratingCI);
  const setIsGeneratingCI = useSessionStore((s) => s.setIsGeneratingCI);

  const generateInstructions = useCallback(async () => {
    if (!notes.trim() && !transcript.trim()) throw new Error('No notes or transcript available');

    setIsGeneratingCI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `${CLIENT_INSTRUCTIONS_PROMPT}\n\n${buildClientInstructionsInput({
            notes,
            transcript,
            clinicKnowledgeBase,
          })}`,
          templatePrompt: 'You are a veterinary client communication specialist for Every Tail Vets (London, UK). Write in warm, reassuring UK English. Return only JSON.',
        },
      });
      if (error) throw new Error(error.message);

      let jsonStr = (await parseSSEText(data)).trim();
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
  }, [notes, transcript, clinicKnowledgeBase, setClientInstructions, setIsGeneratingCI]);

  return { generateInstructions, isGeneratingCI };
}

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ASK_ETV_SYSTEM, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';
import { extractLlmText } from '@/lib/llm';

export function useAskETV() {
  const transcript = useSessionStore((s) => s.transcript);
  const notes = useSessionStore((s) => s.notes);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const patientName = useSessionStore((s) => s.patientName);
  const supplementalContext = useSessionStore((s) => s.supplementalContext);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const updateLastAssistantMessage = useSessionStore((s) => s.updateLastAssistantMessage);
  const isChatStreaming = useSessionStore((s) => s.isChatStreaming);
  const setIsChatStreaming = useSessionStore((s) => s.setIsChatStreaming);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    addChatMessage({ role: 'user', content: userText });
    addChatMessage({ role: 'assistant', content: '' });
    setIsChatStreaming(true);

    try {
      const peReport = peEnabled ? compilePEReport(peData) : '';
      const contextParts: string[] = [];
      if (patientName) contextParts.push(`Patient: ${patientName}`);
      if (transcript) contextParts.push(`Transcript:\n${transcript.slice(0, 3000)}`);
      if (peReport) contextParts.push(`PE Findings:\n${peReport}`);
      if (notes) contextParts.push(`Clinical Notes:\n${notes.slice(0, 3000)}`);
      if (supplementalContext) contextParts.push(`Additional Context:\n${supplementalContext.slice(0, 3000)}`);

      const { data, error } = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: `Current session context:\n${contextParts.join('\n\n')}\n\nUser request:\n${userText}`,
          templatePrompt: ASK_ETV_SYSTEM,
        },
      });

      if (error) throw new Error(error.message);

      const responseText = (await extractLlmText(data)).trim();
      updateLastAssistantMessage(responseText || 'No response generated.');
    } catch (err) {
      console.error('Ask ETV error:', err);
      updateLastAssistantMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsChatStreaming(false);
    }
  }, [transcript, notes, peData, peEnabled, patientName, supplementalContext, addChatMessage, updateLastAssistantMessage, setIsChatStreaming]);

  return { sendMessage, isChatStreaming };
}

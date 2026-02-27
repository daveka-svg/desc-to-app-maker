import { useCallback } from 'react';
import { streamMercuryChat, type ChatMessage as MercuryMessage } from '@/lib/mercury';
import { ASK_ETV_SYSTEM, compilePEReport } from '@/lib/prompts';
import { useSessionStore } from '@/stores/useSessionStore';

export function useAskETV() {
  const transcript = useSessionStore((s) => s.transcript);
  const notes = useSessionStore((s) => s.notes);
  const peData = useSessionStore((s) => s.peData);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const patientName = useSessionStore((s) => s.patientName);
  const chatMessages = useSessionStore((s) => s.chatMessages);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const updateLastAssistantMessage = useSessionStore((s) => s.updateLastAssistantMessage);
  const isChatStreaming = useSessionStore((s) => s.isChatStreaming);
  const setIsChatStreaming = useSessionStore((s) => s.setIsChatStreaming);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    // Add user message
    addChatMessage({ role: 'user', content: userText });

    // Add placeholder assistant message
    addChatMessage({ role: 'assistant', content: '' });

    setIsChatStreaming(true);

    try {
      // Build context
      const peReport = peEnabled ? compilePEReport(peData) : '';
      const contextParts: string[] = [];
      if (patientName) contextParts.push(`Patient: ${patientName}`);
      if (transcript) contextParts.push(`Transcript:\n${transcript.slice(0, 3000)}`);
      if (peReport) contextParts.push(`PE Findings:\n${peReport}`);
      if (notes) contextParts.push(`Clinical Notes:\n${notes.slice(0, 3000)}`);

      const systemMsg = `${ASK_ETV_SYSTEM}\n\nCurrent session context:\n${contextParts.join('\n\n')}`;

      // Build message history
      const currentChat = useSessionStore.getState().chatMessages;
      const mercuryMessages: MercuryMessage[] = [
        { role: 'system', content: systemMsg },
        ...currentChat.slice(0, -1).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      let responseSoFar = '';
      for await (const chunk of streamMercuryChat(mercuryMessages)) {
        responseSoFar += chunk;
        updateLastAssistantMessage(responseSoFar);
      }
    } catch (err) {
      console.error('Ask ETV error:', err);
      updateLastAssistantMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsChatStreaming(false);
    }
  }, [transcript, notes, peData, peEnabled, patientName, chatMessages, addChatMessage, updateLastAssistantMessage, setIsChatStreaming]);

  return { sendMessage, isChatStreaming };
}

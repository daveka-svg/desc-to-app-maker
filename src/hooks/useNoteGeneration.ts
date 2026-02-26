import { useState, useCallback } from 'react';

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`;

interface UseNoteGenerationReturn {
  generatedNote: string;
  isGenerating: boolean;
  generateNote: (transcript: string, peData?: any, templatePrompt?: string) => Promise<void>;
  setGeneratedNote: (note: string) => void;
}

export function useNoteGeneration(): UseNoteGenerationReturn {
  const [generatedNote, setGeneratedNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateNote = useCallback(async (transcript: string, peData?: any, templatePrompt?: string) => {
    setIsGenerating(true);
    setGeneratedNote('');
    let noteSoFar = '';

    try {
      const resp = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ transcript, peData, templatePrompt }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to generate notes (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              noteSoFar += content;
              setGeneratedNote(noteSoFar);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              noteSoFar += content;
              setGeneratedNote(noteSoFar);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Note generation error:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generatedNote, isGenerating, generateNote, setGeneratedNote };
}

import { useRef, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time speech-to-text using OpenAI Realtime API (gpt-4o-transcribe).
 * Uses WebSocket with server VAD for automatic turn detection.
 * Labels each committed segment with speaker labels.
 */

function float32ToPcm16(float32: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function resampleFloat32(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const floor = Math.floor(srcIdx);
    const ceil = Math.min(floor + 1, input.length - 1);
    const frac = srcIdx - floor;
    output[i] = input[floor] * (1 - frac) + input[ceil] * frac;
  }
  return output;
}

export function useTranscription() {
  const appendTranscript = useSessionStore((s) => s.appendTranscript);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const segmentCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startAudioCapture = (ws: WebSocket) => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        streamRef.current = stream;
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        const nativeSampleRate = audioCtx.sampleRate;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const resampled = resampleFloat32(inputData, nativeSampleRate, 24000);
          const pcm16 = float32ToPcm16(resampled);
          const base64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }));
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      })
      .catch((err) => console.error('Failed to start audio capture:', err));
  };

  const startTranscription = useCallback(
    async (_lang?: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('openai-realtime-token');
        if (error || !data?.token) {
          console.error('Failed to get OpenAI realtime token:', error);
          return;
        }

        segmentCountRef.current = 0;

        const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-transcribe', [
          'realtime',
          `openai-insecure-api-key.${data.token}`,
          'openai-beta.realtime-v1',
        ]);

        ws.onopen = () => {
          // Configure transcription session
          ws.send(
            JSON.stringify({
              type: 'transcription_session.update',
              session: {
                input_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'gpt-4o-transcribe',
                  language: _lang || 'en',
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 700,
                },
                input_audio_noise_reduction: { type: 'near_field' },
              },
            })
          );
          startAudioCapture(ws);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'conversation.item.input_audio_transcription.delta') {
              setInterimText((prev) => prev + (msg.delta || ''));
            }

            if (msg.type === 'conversation.item.input_audio_transcription.completed') {
              if (msg.transcript?.trim()) {
                segmentCountRef.current += 1;
                const speaker = segmentCountRef.current % 2 === 1 ? 'Speaker 1' : 'Speaker 2';
                const existing = useSessionStore.getState().transcript;
                const prefix = existing ? '\n\n' : '';
                appendTranscript(`${prefix}**${speaker}:** ${msg.transcript.trim()}`);
              }
              setInterimText('');
            }

            if (msg.type === 'error') {
              console.error('OpenAI Realtime error:', msg.error);
            }
          } catch {
            /* ignore parse errors */
          }
        };

        ws.onerror = (err) => console.error('WebSocket error:', err);
        ws.onclose = () => setIsTranscribing(false);

        wsRef.current = ws;
        setIsTranscribing(true);
      } catch (err) {
        console.error('Failed to start OpenAI transcription:', err);
      }
    },
    [appendTranscript, cleanup]
  );

  const stopTranscription = useCallback(() => {
    cleanup();
    setIsTranscribing(false);
    setInterimText('');
  }, [cleanup]);

  const pauseTranscription = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    setIsTranscribing(false);
  }, []);

  const resumeTranscription = useCallback(
    async (lang?: string) => {
      cleanup();
      await startTranscription(lang);
    },
    [startTranscription, cleanup]
  );

  return {
    isTranscribing,
    interimText,
    isSupported,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  };
}

import { useEffect } from 'react';
import { create } from 'zustand';
import { useSessionStore } from '@/stores/useSessionStore';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  timerSeconds: number;
  waveformData: number[];
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
}

interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  timerSeconds: number;
  waveformData: number[];
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const DEFAULT_WAVEFORM = new Array(50).fill(4);

const useAudioRecorderStore = create<AudioRecorderState>(() => ({
  isRecording: false,
  isPaused: false,
  timerSeconds: 0,
  waveformData: [...DEFAULT_WAVEFORM],
}));

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let audioChunks: Blob[] = [];
let animationFrameId = 0;
let timerId: ReturnType<typeof setInterval> | null = null;
let speechRecognition: SpeechRecognitionLike | null = null;
let mountedHooks = 0;

const setAudioState = (partial: Partial<AudioRecorderState>) => {
  useAudioRecorderStore.setState(partial);
};

const appendLiveTranscript = (raw: string) => {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return;

  const { transcript, setTranscript } = useSessionStore.getState();
  const needsSeparator = transcript.trim().length > 0 && !transcript.endsWith('\n');
  setTranscript(`${transcript}${needsSeparator ? '\n' : ''}${text}`);
};

const stopTimer = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const startTimer = () => {
  stopTimer();
  timerId = setInterval(() => {
    const { timerSeconds } = useAudioRecorderStore.getState();
    setAudioState({ timerSeconds: timerSeconds + 1 });
  }, 1000);
};

const stopWaveform = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
};

const updateWaveform = () => {
  if (!analyserNode) return;
  const { isRecording, isPaused } = useAudioRecorderStore.getState();
  if (!isRecording || isPaused) return;

  const data = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteTimeDomainData(data);

  const bars = 50;
  const step = Math.max(1, Math.floor(data.length / bars));
  const waveform = Array.from({ length: bars }, (_, i) => {
    const value = data[i * step] ?? 128;
    return Math.max(4, Math.abs(value - 128) * 0.5);
  });

  setAudioState({ waveformData: waveform });
  animationFrameId = requestAnimationFrame(updateWaveform);
};

const stopSpeechRecognition = () => {
  if (!speechRecognition) return;

  speechRecognition.onend = null;
  try {
    speechRecognition.stop();
  } catch {
    // no-op
  }
  speechRecognition = null;
};

const startSpeechRecognition = () => {
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Recognition) return;

  stopSpeechRecognition();

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-GB';

  recognition.onresult = (event: any) => {
    let finalText = '';
    for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      const chunk = String(result?.[0]?.transcript || '');
      if (result?.isFinal) finalText += `${chunk} `;
    }

    if (finalText.trim()) appendLiveTranscript(finalText);
  };

  recognition.onerror = () => {
    // Keep recording even if speech recognition fails.
  };

  recognition.onend = () => {
    const { isRecording, isPaused } = useAudioRecorderStore.getState();
    if (!isRecording || isPaused) return;

    try {
      recognition.start();
    } catch {
      // no-op
    }
  };

  try {
    recognition.start();
    speechRecognition = recognition;
  } catch {
    speechRecognition = null;
  }
};

const cleanupRecorderEngine = (resetState: boolean) => {
  stopTimer();
  stopWaveform();
  stopSpeechRecognition();

  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  mediaRecorder = null;
  analyserNode = null;

  if (audioContext) {
    audioContext.close().catch(() => {
      // no-op
    });
    audioContext = null;
  }

  audioChunks = [];

  if (resetState) {
    setAudioState({
      isRecording: false,
      isPaused: false,
      timerSeconds: 0,
      waveformData: [...DEFAULT_WAVEFORM],
    });
    useSessionStore.getState().setIsRecording(false);
  }
};

const startRecording = async () => {
  const current = useAudioRecorderStore.getState();
  if (current.isRecording && !current.isPaused) return;
  if (current.isRecording && current.isPaused) {
    resumeRecording();
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaStream = stream;

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  source.connect(analyserNode);

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  audioChunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };

  mediaRecorder = recorder;
  recorder.start(1000);

  setAudioState({
    isRecording: true,
    isPaused: false,
    timerSeconds: 0,
    waveformData: [...DEFAULT_WAVEFORM],
  });
  useSessionStore.getState().setIsRecording(true);

  startTimer();
  updateWaveform();
  startSpeechRecognition();
};

const pauseRecording = () => {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

  mediaRecorder.pause();
  setAudioState({ isPaused: true });
  useSessionStore.getState().setIsRecording(false);
  stopTimer();
  stopWaveform();
  stopSpeechRecognition();
};

const resumeRecording = () => {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;

  mediaRecorder.resume();
  setAudioState({ isPaused: false });
  useSessionStore.getState().setIsRecording(true);
  startTimer();
  updateWaveform();
  startSpeechRecognition();
};

const stopRecording = async (): Promise<Blob | null> => {
  if (!mediaRecorder) {
    cleanupRecorderEngine(true);
    return null;
  }

  const recorder = mediaRecorder;
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = audioChunks.length ? new Blob(audioChunks, { type: 'audio/webm' }) : null;
      cleanupRecorderEngine(true);
      resolve(blob);
    };

    try {
      recorder.stop();
    } catch {
      const blob = audioChunks.length ? new Blob(audioChunks, { type: 'audio/webm' }) : null;
      cleanupRecorderEngine(true);
      resolve(blob);
    }
  });
};

export function useAudioRecorder(): UseAudioRecorderReturn {
  const isRecording = useAudioRecorderStore((s) => s.isRecording);
  const isPaused = useAudioRecorderStore((s) => s.isPaused);
  const timerSeconds = useAudioRecorderStore((s) => s.timerSeconds);
  const waveformData = useAudioRecorderStore((s) => s.waveformData);

  useEffect(() => {
    mountedHooks += 1;
    return () => {
      mountedHooks -= 1;
      if (mountedHooks <= 0 && !useAudioRecorderStore.getState().isRecording) {
        cleanupRecorderEngine(true);
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}

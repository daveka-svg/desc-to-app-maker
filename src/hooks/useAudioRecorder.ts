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
let mountedHooks = 0;

const setAudioState = (partial: Partial<AudioRecorderState>) => {
  useAudioRecorderStore.setState(partial);
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
    return Math.max(4, Math.abs(value - 128) * 1.5);
  });

  setAudioState({ waveformData: waveform });
  animationFrameId = requestAnimationFrame(updateWaveform);
};

const cleanupRecorderEngine = (resetState: boolean) => {
  stopTimer();
  stopWaveform();

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
};

const pauseRecording = () => {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

  mediaRecorder.pause();
  setAudioState({ isPaused: true });
  useSessionStore.getState().setIsRecording(false);
  stopTimer();
  stopWaveform();
};

const resumeRecording = () => {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;

  mediaRecorder.resume();
  setAudioState({ isPaused: false });
  useSessionStore.getState().setIsRecording(true);
  startTimer();
  updateWaveform();
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

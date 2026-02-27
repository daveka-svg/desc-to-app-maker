import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSessionStore } from "@/stores/useSessionStore";

type MediaRecorderState = "inactive" | "recording" | "paused";

class FakeMediaRecorder {
  public state: MediaRecorderState = "inactive";
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onstop: (() => void) | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

  start() {
    this.state = "recording";
  }

  pause() {
    if (this.state === "recording") this.state = "paused";
  }

  resume() {
    if (this.state === "paused") this.state = "recording";
  }

  stop() {
    if (this.ondataavailable) {
      const chunk = new Blob(["audio"], { type: "audio/webm" });
      this.ondataavailable({ data: chunk } as BlobEvent);
    }
    this.state = "inactive";
    this.onstop?.();
  }
}

class FakeAnalyserNode {
  public fftSize = 256;
  public frequencyBinCount = 64;

  getByteTimeDomainData(target: Uint8Array) {
    target.fill(128);
  }
}

class FakeAudioContext {
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    };
  }

  createAnalyser() {
    return new FakeAnalyserNode() as unknown as AnalyserNode;
  }

  close() {
    return Promise.resolve();
  }
}

type FakeSpeechResult = {
  resultIndex: number;
  results: Array<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

class FakeSpeechRecognition {
  static lastInstance: FakeSpeechRecognition | null = null;

  public continuous = false;
  public interimResults = false;
  public lang = "en-GB";
  public onresult: ((event: FakeSpeechResult) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.lastInstance = this;
  }

  start() {
    // no-op for tests
  }

  stop() {
    // no-op for tests
  }
}

const resetSessionStore = () => {
  localStorage.clear();
  useSessionStore.setState({
    activeTab: "context",
    selectedTemplate: "General Consult",
    peEnabled: true,
    peIncludeInNotes: true,
    tasksOpen: true,
    peData: {
      vitals: { temp: "", hr: "", rr: "", weight: "" },
      mentation: "",
      demeanour: "",
      bcs: 5,
      eyes: "",
      eyesDetail: "",
      ears: "",
      earsDetail: "",
      nose: "",
      noseDetail: "",
      oral: "",
      oralDetail: "",
      plns: "",
      plnsDetail: "",
      mmColor: "",
      mmMoisture: "",
      crt: "",
      heart: "",
      heartDetail: "",
      lungs: "",
      lungsDetail: "",
      pulses: "",
      hydration: "",
      hydrationDetail: "",
      abdoPalp: "",
      abdoPalpDetail: "",
      skinCoat: "",
      skinCoatDetail: "",
    },
    transcript: "",
    notes: "",
    isGeneratingNotes: false,
    tasks: [],
    isExtractingTasks: false,
    clientInstructions: null,
    isGeneratingCI: false,
    chatMessages: [],
    isChatStreaming: false,
    patientName: "",
    sessions: [],
    activeSessionId: null,
    isRecording: false,
  });
};

describe("Recording Flow", () => {
  beforeEach(() => {
    resetSessionStore();
    vi.useFakeTimers();

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      writable: true,
      value: FakeSpeechRecognition,
    });

    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      writable: true,
      value: FakeSpeechRecognition,
    });

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });

    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });

    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    });

    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    const fakeTrack = { stop: vi.fn() };
    const fakeStream = {
      getTracks: () => [fakeTrack],
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: vi.fn(async () => fakeStream),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps recorder state and transcript across hook remounts", async () => {
    const primary = renderHook(() => useAudioRecorder());
    const secondary = renderHook(() => useAudioRecorder());

    await act(async () => {
      await primary.result.current.startRecording();
    });

    expect(useSessionStore.getState().isRecording).toBe(true);
    expect(primary.result.current.isRecording).toBe(true);
    expect(secondary.result.current.isRecording).toBe(true);

    await act(async () => {
      FakeSpeechRecognition.lastInstance?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "Patient brighter today." } }],
      });
    });

    expect(useSessionStore.getState().transcript).toContain("Patient brighter today.");

    primary.unmount();

    expect(secondary.result.current.isRecording).toBe(true);

    act(() => {
      secondary.result.current.pauseRecording();
    });

    expect(useSessionStore.getState().isRecording).toBe(false);
    expect(secondary.result.current.isPaused).toBe(true);

    act(() => {
      secondary.result.current.resumeRecording();
    });

    expect(useSessionStore.getState().isRecording).toBe(true);
    expect(secondary.result.current.isPaused).toBe(false);

    let blob: Blob | null = null;
    await act(async () => {
      blob = await secondary.result.current.stopRecording();
    });

    expect(useSessionStore.getState().isRecording).toBe(false);
    expect(secondary.result.current.isRecording).toBe(false);
    expect(secondary.result.current.timerSeconds).toBe(0);

    expect(blob).not.toBeNull();
    secondary.unmount();
  });
});

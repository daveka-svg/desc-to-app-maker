import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TopBar from "@/components/layout/TopBar";
import { useSessionStore } from "@/stores/useSessionStore";

vi.mock("@/hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    isPaused: false,
    timerSeconds: 0,
    waveformData: new Array(50).fill(4),
    startRecording: vi.fn(async () => undefined),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    stopRecording: vi.fn(async () => null),
  }),
}));

vi.mock("@/lib/mercury", () => {
  const streamMercuryChat = vi.fn(async function* () {
    yield "CE: BAR, hydrated.\n\n";
    yield "Plan: Recheck in 24h.";
  });

  const mercuryChat = vi.fn(
    async (messages: Array<{ role: string; content: string }>) => {
      const input = messages[messages.length - 1]?.content ?? "";

      if (input.includes("extract all action items")) {
        return JSON.stringify({
          prescriptions: [{ text: "Dispense maropitant", assignee: "Vet" }],
          diagnostics: [{ text: "Run CBC", assignee: "Nurse" }],
          followup: [{ text: "Recheck 24 hours", assignee: "Vet" }],
          admin: [{ text: "Prepare estimate", assignee: "Admin" }],
        });
      }

      if (input.includes("Generate client discharge instructions")) {
        return JSON.stringify({
          thingsToDo: "Offer small meals and monitor appetite.",
          thingsToAvoid: "Avoid strenuous exercise for 24 hours.",
          medication: "Give maropitant once daily for 3 days.",
          whenToContact: "Call if vomiting worsens.",
          followUp: "Book a review in 24 hours.",
        });
      }

      return "{}";
    },
  );

  return { streamMercuryChat, mercuryChat };
});

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

describe("Workflow Pipeline", () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it("newSession auto-saves current data then resets to defaults", () => {
    const store = useSessionStore.getState();
    store.setTranscript("Existing transcript");
    store.setNotes("Existing notes");
    store.setPatientName("Bella");
    store.setSelectedTemplate("Emergency");
    store.addTask({
      text: "Call owner",
      category: "admin",
      assignee: "Admin",
      done: false,
    });

    store.newSession();

    const next = useSessionStore.getState();
    expect(next.sessions.length).toBe(1);
    expect(next.sessions[0].patientName).toBe("Bella");
    expect(next.activeTab).toBe("context");
    expect(next.selectedTemplate).toBe("General Consult");
    expect(next.transcript).toBe("");
    expect(next.notes).toBe("");
    expect(next.tasks).toHaveLength(0);
    expect(next.clientInstructions).toBeNull();
    expect(next.chatMessages).toHaveLength(0);
  });

  it("Create runs full chain: notes -> tasks -> client instructions -> save", async () => {
    const store = useSessionStore.getState();
    store.setTranscript("Dog presented for vomiting and lethargy.");
    store.setPatientName("Bella");

    render(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: /^Create$/i }));

    await waitFor(() => {
      const state = useSessionStore.getState();
      expect(state.activeTab).toBe("notes");
      expect(state.notes).toContain("Plan: Recheck in 24h.");
      expect(state.tasks.length).toBeGreaterThan(0);
      expect(state.clientInstructions?.followUp).toContain("24 hours");
      expect(state.sessions.length).toBe(1);
      expect(state.sessions[0].patientName).toBe("Bella");
    }, { timeout: 15000 });
  }, 20000);
});

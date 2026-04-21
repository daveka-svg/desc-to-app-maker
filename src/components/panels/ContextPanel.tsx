import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileAudio, FileText, Loader2, Mic, MicOff, Save, Wifi, WifiOff } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useEncounterController } from '@/components/encounter/EncounterControllerProvider';
import { useToast } from '@/hooks/use-toast';
import PEForm from '@/components/pe-form/PEForm';
import { MOCK_DOG_DIARRHOEA_20MIN_TRANSCRIPT } from '@/dev/mockConsultation';

const connectionMeta: Record<
  'connected' | 'reconnecting' | 'disconnected',
  { label: string; className: string; icon: ReactNode }
> = {
  connected: {
    label: 'Live transcription connected',
    className: 'text-forest',
    icon: <Wifi size={13} />,
  },
  reconnecting: {
    label: 'Reconnecting live transcription',
    className: 'text-warning',
    icon: <Loader2 size={13} className="animate-spin" />,
  },
  disconnected: {
    label: 'Live transcription disconnected',
    className: 'text-error',
    icon: <WifiOff size={13} />,
  },
};

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatBytes = (value: number): string => {
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const getSpeechRecognitionCtor = (): (new () => BrowserSpeechRecognition) | null => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const chunks: string[] = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const text = await page.getTextContent();
    const pageText = text.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) chunks.push(pageText);
  }

  return chunks.join('\n');
};

export default function ContextPanel() {
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isVetNotesDictating, setIsVetNotesDictating] = useState(false);
  const [vetNotesInterim, setVetNotesInterim] = useState('');
  const vetNotesRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const peEnabled = useSessionStore((s) => s.peEnabled);
  const togglePE = useSessionStore((s) => s.togglePE);
  const patientName = useSessionStore((s) => s.patientName);
  const setPatientName = useSessionStore((s) => s.setPatientName);
  const selectedTemplate = useSessionStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useSessionStore((s) => s.setSelectedTemplate);
  const availableTemplates = useSessionStore((s) => s.availableTemplates);
  const vetNotes = useSessionStore((s) => s.vetNotes);
  const setVetNotes = useSessionStore((s) => s.setVetNotes);
  const supplementalContext = useSessionStore((s) => s.supplementalContext);
  const setSupplementalContext = useSessionStore((s) => s.setSupplementalContext);
  const appendSupplementalContext = useSessionStore((s) => s.appendSupplementalContext);
  const setTranscript = useSessionStore((s) => s.setTranscript);
  const setInterimTranscript = useSessionStore((s) => s.setInterimTranscript);
  const setNotes = useSessionStore((s) => s.setNotes);
  const setTasks = useSessionStore((s) => s.setTasks);
  const setEncounterStatus = useSessionStore((s) => s.setEncounterStatus);
  const encounterStatus = useSessionStore((s) => s.encounterStatus);
  const recordingArtifacts = useSessionStore((s) => s.recordingArtifacts);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const transcript = useSessionStore((s) => s.transcript);
  const notes = useSessionStore((s) => s.notes);
  const peAppliedAt = useSessionStore((s) => s.peAppliedAt);
  const peAppliedSummary = useSessionStore((s) => s.peAppliedSummary);
  const saveCurrentSession = useSessionStore((s) => s.saveCurrentSession);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const { toast } = useToast();
  const {
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    isSupported,
    transcriptionConnectionState,
    finalTranscriptionStatus,
    startEncounter,
    pauseEncounter,
    resumeEncounter,
    stopEncounter,
  } = useEncounterController();

  const isProcessing = encounterStatus === 'processing';
  const connectionUi = connectionMeta[transcriptionConnectionState];
  const canDictateVetNotes = useMemo(
    () => typeof window !== 'undefined' && !!getSpeechRecognitionCtor(),
    []
  );

  const visibleRecordings = useMemo(() => {
    if (!activeSessionId) return recordingArtifacts;
    return recordingArtifacts.filter((item) => item.sessionId === activeSessionId);
  }, [activeSessionId, recordingArtifacts]);

  const transcriptPreview = transcript.trim().slice(0, 220);
  const notesPreview = notes.trim().slice(0, 220);
  const canAppendRecording = Boolean(activeSessionId && (transcript.trim() || notes.trim()));
  const startButtonLabel = canAppendRecording ? 'Add Recording' : 'Start Recording';
  const contextDocuments = useMemo(() => {
    const sourceRegex = /^Source:\s*(.+)$/gm;
    const items: string[] = [];
    for (const match of supplementalContext.matchAll(sourceRegex)) {
      const name = String(match[1] || '').trim();
      if (!name) continue;
      if (!items.includes(name)) items.push(name);
    }
    return items;
  }, [supplementalContext]);

  const handleContextFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        let text = '';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          text = await extractPdfText(file);
        } else {
          text = await file.text();
        }

        const clipped = text.trim().slice(0, 12000);
        if (!clipped) continue;
        appendSupplementalContext(
          `Source: ${file.name} (${new Date().toLocaleString('en-GB')})\n${clipped}`
        );
      } catch (error) {
        console.error('Context file parsing failed:', error);
        toast({
          title: 'File parse failed',
          description: `Could not read ${file.name}.`,
          variant: 'destructive',
        });
      }
    }

    event.target.value = '';
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleSaveContext = async () => {
    setIsSavingContext(true);
    try {
      await saveCurrentSession();
      window.dispatchEvent(new Event('session-saved'));
      toast({
        title: 'Context saved',
        description: 'Additional context is saved and available in chat.',
      });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Could not save additional context.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingContext(false);
    }
  };

  const loadMockConsultation = () => {
    setPatientName('Milo (Mock)');
    setSelectedTemplate('General Consult');
    setTranscript(MOCK_DOG_DIARRHOEA_20MIN_TRANSCRIPT);
    setInterimTranscript('');
    setNotes('');
    setVetNotes('');
    setTasks([]);
    useSessionStore.getState().setTaskExtractionState('idle');
    useSessionStore.getState().setFinalTranscriptionStatus('done');
    setEncounterStatus('reviewing');
    setActiveTab('transcript');
    toast({
      title: 'Mock consultation loaded',
      description: 'Dog diarrhoea 20-minute transcript loaded for QA.',
    });
  };

  const startVetNotesDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || isProcessing) return;
    if (vetNotesRecognitionRef.current) {
      try {
        vetNotesRecognitionRef.current.stop();
      } catch {
        // no-op
      }
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onresult = (event: any) => {
      let interim = '';
      const finalParts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result?.[0]?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) finalParts.push(text);
        else interim += `${text} `;
      }
      setVetNotesInterim(interim.trim());
      if (finalParts.length > 0) {
        const current = useSessionStore.getState().vetNotes;
        setVetNotes(`${current}\n${finalParts.join(' ')}`.trim());
      }
    };

    recognition.onerror = () => {
      setIsVetNotesDictating(false);
      setVetNotesInterim('');
    };

    recognition.onend = () => {
      setIsVetNotesDictating(false);
      setVetNotesInterim('');
    };

    vetNotesRecognitionRef.current = recognition;
    recognition.start();
    setIsVetNotesDictating(true);
  };

  const stopVetNotesDictation = () => {
    try {
      vetNotesRecognitionRef.current?.stop();
    } catch {
      // no-op
    }
    setIsVetNotesDictating(false);
    setVetNotesInterim('');
  };

  useEffect(() => {
    if (!peEnabled && isVetNotesDictating) {
      stopVetNotesDictation();
    }
  }, [isVetNotesDictating, peEnabled]);

  useEffect(() => {
    return () => {
      try {
        vetNotesRecognitionRef.current?.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  return (
    <div className="p-5 overflow-y-auto flex-1">
      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">Recording</div>
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold ${connectionUi.className}`}>
            {connectionUi.icon}
            {isSupported ? connectionUi.label : 'Live transcription unavailable in this browser'}
          </div>
        </div>

        {!isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[32px] font-semibold text-bark tracking-wide flex items-center gap-2.5">
              {isRecording && !isPaused && <span className="w-[9px] h-[9px] rounded-full bg-error animate-pulse-dot" />}
              {isPaused && <span className="w-[9px] h-[9px] rounded-full bg-warning" />}
              {!isRecording && <span className="w-[9px] h-[9px] rounded-full bg-text-muted" />}
              {formatTimer(timerSeconds)}
            </div>

            <div className="flex items-center justify-center gap-[2px] h-16 w-full max-w-[360px]">
              {waveformData.map((height, index) => (
                <div
                  key={index}
                  className={`w-[3px] rounded-sm transition-all duration-75 ${
                    isRecording && !isPaused ? 'bg-forest opacity-80' : 'bg-text-muted opacity-20'
                  }`}
                  style={{ height: `${Math.min(height, 56)}px` }}
                />
              ))}
            </div>

            <div className="flex gap-2.5">
              {!isRecording ? (
                <button
                  onClick={startEncounter}
                  className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-forest bg-forest text-primary-foreground cursor-pointer hover:bg-forest-dark transition-all duration-[120ms]"
                >
                  {startButtonLabel}
                </button>
              ) : (
                <>
                  <button
                    onClick={isPaused ? resumeEncounter : pauseEncounter}
                    className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-warning cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopEncounter}
                    className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[7px] rounded-md text-[13px] font-semibold border border-sand-deeper bg-sand text-error cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
                  >
                    Finish Recording
                  </button>
                </>
              )}
            </div>
            {import.meta.env.DEV && !isRecording && (
              <button
                onClick={loadMockConsultation}
                className="inline-flex items-center justify-center gap-1.5 px-[14px] py-[6px] rounded-md text-[12px] font-semibold border border-border bg-sand text-text-secondary cursor-pointer hover:bg-sand-dark transition-all duration-[120ms]"
              >
                Load Mock 20m Consult
              </button>
            )}
            {canAppendRecording && !isRecording && (
              <div className="text-[11px] text-text-muted text-center">
                New recording will be appended to this session and notes will regenerate from combined context.
              </div>
            )}
            {finalTranscriptionStatus === 'running' && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-forest font-semibold">
                <Loader2 size={12} className="animate-spin" />
                Full transcript is processing in the background. You can keep editing context.
              </div>
            )}
            {finalTranscriptionStatus === 'error' && !isRecording && (
              <div className="text-[11px] text-warning text-center">
                Full audio transcript was not completed. The live transcript is still available.
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-sm text-text-secondary py-2">
            <Loader2 size={16} className="animate-spin text-forest" />
            Generating consultation notes, tasks, and saving session...
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">
          Vet notes
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-semibold text-text-secondary">
              Vet notes
            </label>
            {canDictateVetNotes ? (
              <button
                onClick={isVetNotesDictating ? stopVetNotesDictation : startVetNotesDictation}
                disabled={isProcessing || !peEnabled}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                  isVetNotesDictating
                    ? 'bg-error text-primary-foreground border-error'
                    : 'bg-card border-border hover:bg-sand'
                } disabled:opacity-40`}
              >
                {isVetNotesDictating ? <MicOff size={12} /> : <Mic size={12} />}
                {isVetNotesDictating ? 'Stop dictation' : 'Dictate'}
              </button>
            ) : null}
          </div>
          <textarea
            value={vetNotes}
            onChange={(e) => setVetNotes(e.target.value)}
            disabled={isProcessing || !peEnabled}
            placeholder="Add concise vet notes from physical exam, clarifications, and key observations."
            className="w-full min-h-[92px] px-3 py-2 border border-border rounded-md text-[12px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted resize-y"
          />
          {vetNotesInterim && (
            <div className="text-[11px] text-text-muted italic">{vetNotesInterim}</div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted">Session outputs</div>

        <div>
          <div className="text-[12px] font-semibold text-text-secondary mb-1.5">Recorded audio</div>
          {visibleRecordings.length === 0 ? (
            <div className="text-xs text-text-muted">No downloadable recording available yet for this view.</div>
          ) : (
            <div className="space-y-2">
              {visibleRecordings.map((artifact) => (
                <div key={artifact.id} className="flex items-center justify-between gap-2 rounded-md border border-border-light px-3 py-2 bg-sand">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate flex items-center gap-1.5">
                      <FileAudio size={13} />
                      {artifact.fileName}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {new Date(artifact.createdAt).toLocaleString('en-GB')} - {formatDuration(artifact.durationSeconds)} - {formatBytes(artifact.sizeBytes)}
                    </div>
                  </div>
                  <a
                    href={artifact.objectUrl}
                    download={artifact.fileName}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-card border border-border hover:bg-sand-dark whitespace-nowrap"
                  >
                    <Download size={12} />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <details className="rounded-md border border-border-light bg-sand">
          <summary className="px-3 py-2 text-[12px] font-semibold text-text-secondary cursor-pointer select-none">
            Advanced session details
          </summary>
          <div className="px-3 pb-3 text-[12px] text-text-secondary space-y-2">
            <div>
              <div className="font-semibold text-text-primary mb-1">Documentation</div>
              {contextDocuments.length === 0 ? (
                <div>No additional documents attached yet.</div>
              ) : (
                <div className="space-y-2">
                  {contextDocuments.map((doc) => (
                    <div key={doc} className="rounded-md border border-border-light px-3 py-2 bg-card text-[12px] text-text-primary flex items-center gap-2">
                      <FileText size={13} />
                      <span className="truncate">{doc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="font-semibold text-text-primary mb-1">Physical exam snapshot</div>
              {peAppliedAt && peAppliedSummary ? (
                <div className="rounded-md border border-border-light px-3 py-2 bg-card">
                  <div className="text-[11px] text-text-muted mb-1">
                    Applied in generated note: {new Date(peAppliedAt).toLocaleString('en-GB')}
                  </div>
                  <div className="text-[12px] text-text-primary leading-relaxed">{peAppliedSummary}</div>
                </div>
              ) : (
                <div>No physical exam snapshot captured in generated notes yet.</div>
              )}
            </div>
            <div>
              <span className="font-semibold text-text-primary">Transcript:</span>{' '}
              {transcriptPreview ? `${transcriptPreview}${transcript.length > transcriptPreview.length ? '...' : ''}` : 'Not available'}
            </div>
            <div>
              <span className="font-semibold text-text-primary">Notes:</span>{' '}
              {notesPreview ? `${notesPreview}${notes.length > notesPreview.length ? '...' : ''}` : 'Not generated'}
            </div>
          </div>
        </details>
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">Session details</div>
        <div className="flex gap-2.5 mt-1">
          <input
            type="text"
            placeholder="Patient name (optional)"
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            disabled={isProcessing}
          />
          <select
            className="flex-1 px-3 py-2 border border-border rounded-md text-[13px] outline-none bg-card text-text-primary"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            disabled={isProcessing}
          >
            {availableTemplates.map((template) => (
              <option key={template}>{template}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-sand rounded-md">
          <span className="text-[13px] font-medium text-text-secondary flex items-center gap-[7px]">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="opacity-50"
            >
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" />
            </svg>
            Physical Examination
          </span>
          <div
            className={`relative w-[38px] h-5 rounded-[10px] cursor-pointer transition-colors duration-200 ${
              peEnabled ? 'bg-forest' : 'bg-sand-deeper'
            }`}
            onClick={() => {
              if (!isProcessing) togglePE();
            }}
          >
            <div
              className={`absolute top-[2px] w-4 h-4 bg-card rounded-full transition-[left] duration-200 shadow-sm ${
                peEnabled ? 'left-5' : 'left-[2px]'
              }`}
            />
          </div>
        </div>
      </div>

      {peEnabled && <PEForm />}

      <div className="bg-card rounded-lg p-[18px] mb-3.5 border border-border-light">
        <div className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-muted mb-2.5">
          Additional Context
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-semibold text-text-secondary">
              Upload labs, results, and documents
            </label>
            <div className="flex items-center gap-2">
              <label className="px-2.5 py-1 text-[11px] font-semibold bg-sand border border-border rounded-md cursor-pointer hover:bg-sand-dark">
                Upload files
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.log,.json"
                  multiple
                  className="hidden"
                  onChange={handleContextFileUpload}
                  disabled={isProcessing}
                />
              </label>
              <button
                onClick={() => setSupplementalContext('')}
                disabled={!supplementalContext.trim() || isProcessing}
                className="px-2.5 py-1 text-[11px] font-semibold bg-card border border-border rounded-md disabled:opacity-40 hover:bg-sand"
              >
                Clear
              </button>
              <button
                onClick={handleSaveContext}
                disabled={isProcessing || isSavingContext}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-card border border-border rounded-md disabled:opacity-40 hover:bg-sand"
              >
                {isSavingContext ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Save Context
              </button>
            </div>
          </div>
          <textarea
            value={supplementalContext}
            onChange={(e) => setSupplementalContext(e.target.value)}
            disabled={isProcessing}
            placeholder="Paste or upload lab findings and extra documents."
            className="w-full min-h-[110px] px-3 py-2 border border-border rounded-md text-[12px] outline-none bg-card text-text-primary placeholder:text-text-muted focus:border-bark-muted resize-y"
          />
        </div>
      </div>
    </div>
  );
}

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { useNoteGeneration } from '@/hooks/useNoteGeneration';
import { useTaskExtraction } from '@/hooks/useTaskExtraction';
import { type ProcessingStepId, useSessionStore } from '@/stores/useSessionStore';
import { supabase } from '@/integrations/supabase/client';
import { mergeTranscriptTail } from '@/lib/transcriptMerge';
import { useToast } from '@/hooks/use-toast';
import { uploadSessionRecording } from '@/lib/recordings';

interface EncounterControllerValue {
  isRecording: boolean;
  isPaused: boolean;
  timerSeconds: number;
  waveformData: number[];
  isTranscribing: boolean;
  isSupported: boolean;
  transcriptionConnectionState: 'connected' | 'reconnecting' | 'disconnected';
  finalTranscriptionStatus: 'idle' | 'running' | 'done' | 'error';
  startEncounter: () => Promise<void>;
  pauseEncounter: () => void;
  resumeEncounter: () => Promise<void>;
  stopEncounter: () => Promise<boolean>;
  finalizeConsultation: () => Promise<boolean>;
}

const EncounterControllerContext = createContext<EncounterControllerValue | null>(null);

const markStepActive = (stepId: ProcessingStepId) => {
  const store = useSessionStore.getState();
  store.setProcessingStepStatus(stepId, 'active');
};

const markStepDone = (stepId: ProcessingStepId) => {
  const store = useSessionStore.getState();
  store.setProcessingStepStatus(stepId, 'done');
};

const markStepError = (stepId: ProcessingStepId) => {
  const store = useSessionStore.getState();
  store.setProcessingStepStatus(stepId, 'error');
};

const extractTranscriptText = (payload: any): string => {
  if (!payload) return '';
  if (typeof payload.text === 'string') return payload.text.trim();
  if (typeof payload.transcript === 'string') return payload.transcript.trim();
  if (typeof payload.content === 'string') return payload.content.trim();
  return '';
};

const makeDraftTitle = (patientName: string, template: string, now = new Date()) => {
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const prefix = patientName.trim() || template || 'Consultation';
  return `${prefix} - ${date} ${time} - 0m`;
};

const normalizeTranscriptionKeyterm = (value: string): string => {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s'./+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length >= 50 || cleaned.split(/\s+/).length > 5) return '';
  return cleaned;
};

const buildSessionTranscriptionKeyterms = () => {
  const store = useSessionStore.getState();
  const source = [
    store.patientName,
    store.selectedTemplate,
    store.vetNotes,
    store.supplementalContext,
  ].join('\n');
  const namedTerms = source.match(/\b[A-Z][A-Za-z0-9+'./-]{2,}(?:\s+[A-Z][A-Za-z0-9+'./-]{2,}){0,4}\b/g) || [];
  const candidates = [store.patientName, store.selectedTemplate, ...namedTerms];
  const seen = new Set<string>();
  return candidates
    .map(normalizeTranscriptionKeyterm)
    .filter(Boolean)
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 25);
};

const saveTranscriptDraft = async () => {
  const store = useSessionStore.getState();
  const sessionId = store.activeSessionId;
  if (!sessionId || !store.transcript.trim()) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('sessions')
    .update({
      patient_name: store.patientName || null,
      title: store.sessionTitle || null,
      session_type: store.selectedTemplate,
      pe_data: store.peEnabled ? (store.peData as any) : null,
      pe_enabled: store.peEnabled,
      duration_seconds: store.sessionDurationSeconds,
      status: 'recording',
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  await supabase.from('notes').delete().eq('session_id', sessionId).eq('user_id', user.id);
  await supabase.from('notes').insert({
    user_id: user.id,
    session_id: sessionId,
    content: store.notes,
    transcript: store.transcript,
    supplemental_context: store.supplementalContext || null,
    vet_notes: store.vetNotes || null,
  });
};

export function EncounterControllerProvider({ children }: { children: React.ReactNode }) {
  const {
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useAudioRecorder();
  const {
    isTranscribing,
    isSupported,
    connectionState,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
  } = useTranscription();
  const { generateNote } = useNoteGeneration();
  const { extractTasks } = useTaskExtraction();
  const { toast } = useToast();
  const appendRecordingRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const baseDurationRef = useRef(0);
  const finishRecordingPromiseRef = useRef<Promise<boolean> | null>(null);
  const finalTranscriptionStatus = useSessionStore((s) => s.finalTranscriptionStatus);

  const startEncounter = useCallback(async () => {
    const store = useSessionStore.getState();
    try {
      const hasExistingSessionContext = Boolean(
        store.activeSessionId &&
          (
            store.transcript.trim() ||
            store.notes.trim() ||
            store.supplementalContext.trim() ||
            store.tasks.length > 0
          )
      );

      appendRecordingRef.current = hasExistingSessionContext;
      baseTranscriptRef.current = hasExistingSessionContext ? store.transcript.trim() : '';
      baseDurationRef.current = hasExistingSessionContext ? store.sessionDurationSeconds : 0;

      store.setEncounterStatus('recording');
      store.setInterimTranscript('');
      store.setTranscriptMergeWarning(null);
      store.setFinalTranscriptionStatus('idle');
      store.resetProcessingSteps();

      if (!hasExistingSessionContext) {
        store.setTranscript('');
        store.setSessionDurationSeconds(0);
        store.clearPEAppliedSnapshot();
        store.setNotes('');
        store.setTasks([]);
        store.setTaskExtractionState('idle');
        store.setClientInstructions(null);
        // Reset PE data so previous session's exam doesn't carry over
        const { createDefaultPEData } = await import('@/stores/useSessionStore');
        useSessionStore.setState({ peData: createDefaultPEData() });
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !store.activeSessionId) {
        const draftTitle = makeDraftTitle(store.patientName, store.selectedTemplate);
        const { data: draftSession, error } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            patient_name: store.patientName || null,
            title: draftTitle,
            session_type: store.selectedTemplate,
            pe_data: store.peEnabled ? (store.peData as any) : null,
            pe_enabled: store.peEnabled,
            duration_seconds: 0,
            status: 'recording',
          })
          .select('id, title')
          .single();

        if (!error && draftSession) {
          store.setActiveSessionId(draftSession.id);
          store.setSessionTitle(draftSession.title || draftTitle);
          window.dispatchEvent(new Event('session-saved'));
        }
      }

      await startRecording();
      store.setIsRecording(true);

      if (isSupported) {
        try {
          await startTranscription();
        } catch (err) {
          console.warn('Live transcription failed to start:', err);
        }
      }
    } catch (err) {
      console.error('Could not start encounter:', err);
      store.setEncounterStatus('idle');
      store.setIsRecording(false);
      toast({
        title: 'Could not start recording',
        description: 'Please allow microphone access and try again.',
        variant: 'destructive',
      });
    }
  }, [isSupported, startRecording, startTranscription, toast]);

  const pauseEncounter = useCallback(() => {
    pauseRecording();
    pauseTranscription();
    useSessionStore.getState().setIsRecording(false);
  }, [pauseRecording, pauseTranscription]);

  const resumeEncounter = useCallback(async () => {
    resumeRecording();
    await resumeTranscription();
    useSessionStore.getState().setIsRecording(true);
  }, [resumeRecording, resumeTranscription]);

  const stopEncounter = useCallback(async () => {
    if (finishRecordingPromiseRef.current) {
      return finishRecordingPromiseRef.current;
    }

    const promise = (async () => {
      const store = useSessionStore.getState();
      const recordingIsActive = isRecording || store.encounterStatus === 'recording';
      if (!recordingIsActive) {
        return Boolean(store.transcript.trim());
      }

      const liveTranscriptBeforeStop = store.transcript.trim();
      const appendMode = appendRecordingRef.current;
      const baseTranscript = appendMode ? baseTranscriptRef.current.trim() : '';
      const noNewLiveTranscript = appendMode
        ? liveTranscriptBeforeStop === baseTranscript
        : !liveTranscriptBeforeStop;

      if (timerSeconds < 2 && noNewLiveTranscript) {
        appendRecordingRef.current = false;
        baseTranscriptRef.current = '';
        baseDurationRef.current = 0;
        toast({
          title: 'Keep recording a bit longer',
          description: 'Please speak for at least 2 seconds before ending the session.',
          variant: 'destructive',
        });
        return false;
      }

      store.resetProcessingSteps();
      store.setTranscriptMergeWarning(null);
      store.setFinalTranscriptionStatus('running');
      const totalDuration = (appendMode ? baseDurationRef.current : 0) + timerSeconds;
      store.setSessionDurationSeconds(totalDuration);

      let recordedBlob: Blob | null = null;
      markStepActive('stopping-recording');
      try {
        recordedBlob = await stopRecording();
        markStepDone('stopping-recording');
        if (recordedBlob) {
          store.addRecordingArtifact(recordedBlob, store.activeSessionId, timerSeconds);
          if (store.activeSessionId) {
            try {
              const remoteArtifact = await uploadSessionRecording({
                blob: recordedBlob,
                sessionId: store.activeSessionId,
                durationSeconds: timerSeconds,
              });
              if (remoteArtifact) {
                const currentArtifacts = useSessionStore.getState().recordingArtifacts;
                const others = currentArtifacts.filter((item) => item.sessionId !== store.activeSessionId);
                useSessionStore.getState().setRecordingArtifacts([remoteArtifact, ...others]);
                window.dispatchEvent(new Event('session-saved'));
              }
            } catch (uploadError) {
              console.warn('Recording upload failed:', uploadError);
              toast({
                title: 'Recording kept locally',
                description: 'Cloud upload failed. Download is still available in this session.',
                variant: 'destructive',
              });
            }
          }
        }
      } catch (err) {
        console.error('Stop recording failed:', err);
        markStepError('stopping-recording');
      } finally {
        store.setIsRecording(false);
        store.setEncounterStatus('reviewing');
      }

      markStepActive('finalizing-live-transcript');
      try {
        await stopTranscription();
        markStepDone('finalizing-live-transcript');
      } catch (err) {
        console.error('Live transcript finalization failed:', err);
        markStepError('finalizing-live-transcript');
      }

      let fullAudioTranscript = '';
      markStepActive('generating-audio-transcription');
      try {
        if (!recordedBlob) throw new Error('Recording blob is unavailable');
        const formData = new FormData();
        formData.append('audio', recordedBlob, 'consultation.webm');
        for (const term of buildSessionTranscriptionKeyterms()) {
          formData.append('keyterms', term);
        }
        const { data, error } = await supabase.functions.invoke('elevenlabs-transcribe', {
          body: formData,
        });
        if (error || data?.error) {
          throw new Error(error?.message || data?.error || 'Audio transcription failed');
        }
        fullAudioTranscript = extractTranscriptText(data);
        markStepDone('generating-audio-transcription');
      } catch (err) {
        console.error('Full audio transcription failed:', err);
        markStepError('generating-audio-transcription');
        toast({
          title: 'Audio transcription could not be completed',
          description: 'Continuing with live transcript only.',
          variant: 'destructive',
        });
      }

      markStepActive('merging-transcript-tail');
      try {
        const transcriptBeforeMerge = useSessionStore.getState().transcript.trim();
        const liveSegment = appendMode
          ? (
              baseTranscript && transcriptBeforeMerge.startsWith(baseTranscript)
                ? transcriptBeforeMerge.slice(baseTranscript.length).trim()
                : transcriptBeforeMerge
            )
          : transcriptBeforeMerge;

        const merged = mergeTranscriptTail(liveSegment, fullAudioTranscript);
        store.setTranscriptMergeWarning(null);
        const mergedSegment = merged.mergedTranscript.trim();
        let nextTranscript = mergedSegment || liveSegment;
        if (appendMode && baseTranscript) {
          nextTranscript = mergedSegment
            ? `${baseTranscript}\n\n${mergedSegment}`.trim()
            : baseTranscript;
        }

        if (nextTranscript.trim()) {
          store.setTranscript(nextTranscript.trim());
        }
        store.setInterimTranscript('');
        markStepDone('merging-transcript-tail');
      } catch (err) {
        console.error('Transcript merge failed:', err);
        markStepError('merging-transcript-tail');
      }

      const finalTranscript = useSessionStore.getState().transcript.trim();
      if (!finalTranscript) {
        store.setEncounterStatus('idle');
        store.setFinalTranscriptionStatus('error');
        appendRecordingRef.current = false;
        baseTranscriptRef.current = '';
        baseDurationRef.current = 0;
        toast({
          title: 'No transcript',
          description: 'No speech was detected in this session.',
          variant: 'destructive',
        });
        return false;
      }

      store.setFinalTranscriptionStatus(fullAudioTranscript ? 'done' : 'error');
      try {
        await saveTranscriptDraft();
        window.dispatchEvent(new Event('session-saved'));
      } catch (err) {
        console.warn('Transcript draft save failed:', err);
      }
      appendRecordingRef.current = false;
      baseTranscriptRef.current = '';
      baseDurationRef.current = 0;
      return true;
    })();

    finishRecordingPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      finishRecordingPromiseRef.current = null;
    }
  }, [isRecording, stopRecording, stopTranscription, timerSeconds, toast]);

  const finalizeConsultation = useCallback(async () => {
    const initialStore = useSessionStore.getState();
    if (initialStore.encounterStatus === 'processing') {
      return false;
    }

    const shouldWaitForRecording =
      isRecording ||
      initialStore.encounterStatus === 'recording' ||
      initialStore.finalTranscriptionStatus === 'running' ||
      Boolean(finishRecordingPromiseRef.current);

    if (shouldWaitForRecording) {
      const transcriptReady = await stopEncounter();
      if (!transcriptReady && !useSessionStore.getState().transcript.trim()) {
        return false;
      }
    } else {
      initialStore.resetProcessingSteps();
    }

    const store = useSessionStore.getState();
    const finalTranscript = store.transcript.trim();
    if (!finalTranscript) {
      toast({
        title: 'No transcript',
        description: 'Record or paste a transcript before finalizing the consultation.',
        variant: 'destructive',
      });
      return false;
    }

    const targetSessionId = store.activeSessionId;
    const targetTranscript = finalTranscript;
    const isStillSameConsultation = () => {
      const current = useSessionStore.getState();
      return current.activeSessionId === targetSessionId && current.transcript.trim() === targetTranscript;
    };
    const abortFinalization = () => {
      if (isStillSameConsultation()) {
        useSessionStore.getState().setEncounterStatus('reviewing');
      }
      return false;
    };

    store.setEncounterStatus('processing');
    store.setActiveTab('notes');

    markStepActive('generating-consultation-notes');
    try {
      const noteApplied = await generateNote(undefined, { forceOpenAI: true });
      if (!noteApplied || !isStillSameConsultation()) {
        return abortFinalization();
      }
      markStepDone('generating-consultation-notes');
    } catch (err: any) {
      console.error('Notes generation failed:', err);
      markStepError('generating-consultation-notes');
      toast({
        title: 'Could not generate consultation notes',
        description: err?.message || 'You can retry generation from the Notes tab.',
        variant: 'destructive',
      });
    }

    markStepActive('extracting-tasks');
    try {
      const tasksApplied = await extractTasks({ forceOpenAI: true });
      if (!tasksApplied || !isStillSameConsultation()) {
        return abortFinalization();
      }
      markStepDone('extracting-tasks');
    } catch (err) {
      console.error('Task extraction failed:', err);
      markStepError('extracting-tasks');
    }

    markStepActive('saving-session');
    try {
      if (!isStillSameConsultation()) {
        return abortFinalization();
      }
      await store.saveCurrentSession();
      window.dispatchEvent(new Event('session-saved'));
      markStepDone('saving-session');
    } catch (err) {
      console.error('Session save failed:', err);
      markStepError('saving-session');
      toast({
        title: 'Session save failed',
        description: 'Your notes remain on screen. Please retry save.',
        variant: 'destructive',
      });
    }

    useSessionStore.getState().setEncounterStatus('reviewing');
    return true;
  }, [extractTasks, generateNote, isRecording, stopEncounter, toast]);

  const value = useMemo<EncounterControllerValue>(() => ({
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    isTranscribing,
    isSupported,
    transcriptionConnectionState: connectionState,
    finalTranscriptionStatus,
    startEncounter,
    pauseEncounter,
    resumeEncounter,
    stopEncounter,
    finalizeConsultation,
  }), [
    connectionState,
    finalTranscriptionStatus,
    finalizeConsultation,
    isPaused,
    isRecording,
    isSupported,
    isTranscribing,
    pauseEncounter,
    resumeEncounter,
    startEncounter,
    stopEncounter,
    timerSeconds,
    waveformData,
  ]);

  return (
    <EncounterControllerContext.Provider value={value}>
      {children}
    </EncounterControllerContext.Provider>
  );
}

export function useEncounterController() {
  const context = useContext(EncounterControllerContext);
  if (!context) {
    throw new Error('useEncounterController must be used inside EncounterControllerProvider');
  }
  return context;
}

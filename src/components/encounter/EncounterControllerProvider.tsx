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
  startEncounter: () => Promise<void>;
  pauseEncounter: () => void;
  resumeEncounter: () => Promise<void>;
  stopEncounter: () => Promise<boolean>;
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
      store.resetProcessingSteps();

      if (!hasExistingSessionContext) {
        store.setTranscript('');
        store.setSessionDurationSeconds(0);
        store.clearPEAppliedSnapshot();
        store.setNotes('');
        store.setTasks([]);
        store.setTaskExtractionState('idle');
        store.setClientInstructions(null);
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
    const store = useSessionStore.getState();
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

    store.setEncounterStatus('processing');
    store.resetProcessingSteps();
    store.setTranscriptMergeWarning(null);
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

    store.setActiveTab('notes');

    markStepActive('generating-consultation-notes');
    try {
      await generateNote();
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
      await extractTasks();
      markStepDone('extracting-tasks');
    } catch (err) {
      console.error('Task extraction failed:', err);
      markStepError('extracting-tasks');
    }

    markStepActive('saving-session');
    try {
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

    store.setEncounterStatus('reviewing');
    appendRecordingRef.current = false;
    baseTranscriptRef.current = '';
    baseDurationRef.current = 0;
    return true;
  }, [extractTasks, generateNote, stopRecording, stopTranscription, timerSeconds, toast]);

  const value = useMemo<EncounterControllerValue>(() => ({
    isRecording,
    isPaused,
    timerSeconds,
    waveformData,
    isTranscribing,
    isSupported,
    transcriptionConnectionState: connectionState,
    startEncounter,
    pauseEncounter,
    resumeEncounter,
    stopEncounter,
  }), [
    connectionState,
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

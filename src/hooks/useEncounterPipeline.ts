import { useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport, TASK_EXTRACTION_PROMPT, CLIENT_INSTRUCTIONS_PROMPT } from '@/lib/prompts';
import { extractLlmText, sanitizePlainClinicalText } from '@/lib/llm';
import { getTemplatePrompt } from '@/lib/templatePrompts';
import { getAiGenerationConfig } from '@/lib/appSettings';
import { buildNotesGenerationInput, buildTaskExtractionInput } from '@/lib/clinicContext';
import { normalizeExtractedTasks } from '@/lib/taskExtraction';
import { inferTemplateKind } from '@/lib/templateKind';

interface PipelineStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export function useEncounterPipeline() {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const { startRecording, stopRecording } = useAudioRecorder();
  const { startTranscription, stopTranscription } = useTranscription();

  const updateStep = (index: number, status: PipelineStep['status']) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
  };

  const startEncounter = useCallback(async () => {
    const store = useSessionStore.getState();
    store.setEncounterStatus('recording');
    store.setTranscript('');
    store.setNotes('');
    store.setTasks([]);
    store.setClientInstructions(null);

    await startRecording();
    startTranscription();
    store.setIsRecording(true);
  }, [startRecording, startTranscription]);

  const endEncounter = useCallback(async () => {
    const store = useSessionStore.getState();
    
    // Stop recording
    const blobPromise = stopRecording();
    await stopTranscription();
    const blob = await blobPromise;
    store.setIsRecording(false);
    store.setEncounterStatus('processing');

    const initialSteps: PipelineStep[] = [
      { label: 'Finalizing transcript', status: 'done' },
      { label: 'Generating clinical notes', status: 'active' },
      { label: 'Extracting tasks', status: 'pending' },
      { label: 'Creating client instructions', status: 'pending' },
      { label: 'Saving session', status: 'pending' },
    ];
    setSteps(initialSteps);

    const transcript = useSessionStore.getState().transcript;
    const aiConfig = getAiGenerationConfig();
    if (!transcript.trim()) {
      store.setEncounterStatus('idle');
      return;
    }

    // Generate notes via edge function
    try {
      const peData = store.peEnabled ? store.peData : null;
      const templateToUse = store.selectedTemplate;
      const fallbackTemplate = TEMPLATES[templateToUse] || TEMPLATES['General Consult'];
      const templatePrompt = await getTemplatePrompt(templateToUse, fallbackTemplate);
      const templateKind = inferTemplateKind(templateToUse, templatePrompt);
      const includeClinicalContext = store.peEnabled && store.peIncludeInNotes;
      const includeClinicContext = templateKind !== 'general_consult';
      const peReport = includeClinicalContext && peData ? compilePEReport(peData) : '';
      const vetNotesForGeneration = includeClinicalContext ? store.vetNotes : '';
      
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const userContent = buildNotesGenerationInput({
        transcript,
        peReport,
        vetNotes: vetNotesForGeneration,
        clinicKnowledgeBase: store.clinicKnowledgeBase,
        includeClinicContext,
      });

      const response = await supabase.functions.invoke('generate-notes', {
        body: {
          transcript: userContent,
          peData: includeClinicalContext ? peData : null,
          templatePrompt: fullPrompt,
          requestType: 'notes',
          templateName: templateToUse,
          templateKind,
          llmProvider: aiConfig.provider,
          llmModel: aiConfig.model,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const notesContent = sanitizePlainClinicalText(await extractLlmText(response.data));

      store.setNotes(notesContent);
      updateStep(1, 'done');
    } catch (err) {
      console.error('Note generation error:', err);
      updateStep(1, 'error');
    }

    // Extract tasks
    updateStep(2, 'active');
    try {
      const notes = useSessionStore.getState().notes;
      if (notes.trim()) {
        const taskResponse = await supabase.functions.invoke('generate-notes', {
          body: {
            transcript: `${TASK_EXTRACTION_PROMPT}\n\n${buildTaskExtractionInput({
              transcript,
            })}`,
            templatePrompt: 'You are a veterinary task extraction specialist. Extract tasks and return ONLY valid JSON with evidence quotes for every task.',
            llmProvider: aiConfig.provider,
            llmModel: aiConfig.model,
          },
        });

        const taskContent = await extractLlmText(taskResponse.data);

        let cleanJson = taskContent.trim();
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

        const parsed = JSON.parse(cleanJson);
        const tasks = normalizeExtractedTasks(parsed, transcript);
        store.setTasks(tasks);
      }
      updateStep(2, 'done');
    } catch (err) {
      console.error('Task extraction error:', err);
      updateStep(2, 'error');
    }

    // Client instructions
    updateStep(3, 'active');
    try {
      const notes = useSessionStore.getState().notes;
      if (notes.trim()) {
        const ciResponse = await supabase.functions.invoke('generate-notes', {
          body: {
            transcript: `${CLIENT_INSTRUCTIONS_PROMPT}\n\nClinical Notes:\n${notes}\n\nTranscript:\n${transcript}`,
            templatePrompt: 'You are a veterinary client communication specialist for Every Tail Vets (London, UK). Write in warm, reassuring UK English.',
            llmProvider: aiConfig.provider,
            llmModel: aiConfig.model,
          },
        });

        const ciContent = await extractLlmText(ciResponse.data);

        let cleanJson = ciContent.trim();
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

        const parsed = JSON.parse(cleanJson);
        store.setClientInstructions({
          thingsToDo: parsed.thingsToDo || '',
          thingsToAvoid: parsed.thingsToAvoid || '',
          medication: parsed.medication || '',
          whenToContact: parsed.whenToContact || '',
          followUp: parsed.followUp || '',
        });
      }
      updateStep(3, 'done');
    } catch (err) {
      console.error('Client instructions error:', err);
      updateStep(3, 'error');
    }

    // Save to database
    updateStep(4, 'active');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const currentState = useSessionStore.getState();
        
        const { data: session, error: sessionError } = await supabase.from('sessions').insert({
          user_id: user.id,
          patient_name: currentState.patientName || null,
          session_type: currentState.selectedTemplate,
          pe_data: currentState.peEnabled ? currentState.peData as any : null,
          pe_enabled: currentState.peEnabled,
          duration_seconds: 0,
          status: 'completed',
        }).select().single();

        if (sessionError) throw sessionError;

        if (session) {
          store.setActiveSessionId(session.id);

          await supabase.from('notes').insert({
            user_id: user.id,
            session_id: session.id,
            content: currentState.notes,
            transcript: currentState.transcript,
            vet_notes: currentState.vetNotes || null,
          });

          if (currentState.tasks.length > 0) {
            await supabase.from('tasks').insert(
              currentState.tasks.map(t => ({
                id: t.id,
                user_id: user.id,
                session_id: session.id,
                text: t.text,
                category: t.category,
                assignee: t.assignee,
                done: t.done,
              }))
            );
          }
        }
      }
      updateStep(4, 'done');
    } catch (err) {
      console.error('Save session error:', err);
      updateStep(4, 'error');
    }

    // Transition to reviewing
    setTimeout(() => {
      store.setEncounterStatus('reviewing');
      store.setActiveTab('notes');
    }, 1000);
  }, [stopRecording, stopTranscription]);

  return { steps, startEncounter, endEncounter };
}

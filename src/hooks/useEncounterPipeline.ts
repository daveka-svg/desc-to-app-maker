import { useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PROMPT, TEMPLATES, compilePEReport, TASK_EXTRACTION_PROMPT, CLIENT_INSTRUCTIONS_PROMPT } from '@/lib/prompts';

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
    const blob = await stopRecording();
    stopTranscription();
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
    if (!transcript.trim()) {
      store.setEncounterStatus('idle');
      return;
    }

    // Generate notes via edge function
    try {
      const peData = store.peEnabled ? store.peData : null;
      const templatePrompt = TEMPLATES[store.selectedTemplate] || TEMPLATES['General Consult'];
      const peReport = peData ? compilePEReport(peData) : '';
      
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${templatePrompt}`;
      const userContent = `Generate clinical notes from the following consultation transcript:${peReport ? `\n\nPhysical Examination:\n${peReport}` : ''}\n\nTranscript:\n${transcript}`;

      const response = await supabase.functions.invoke('generate-notes', {
        body: { transcript: userContent, peData, templatePrompt: fullPrompt },
      });

      if (response.error) throw new Error(response.error.message);

      // Parse SSE stream from response
      const text = typeof response.data === 'string' ? response.data : 
                   response.data instanceof Blob ? await response.data.text() : 
                   JSON.stringify(response.data);
      
      // Parse SSE lines
      let notesContent = '';
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) notesContent += content;
        } catch { /* skip */ }
      }
      
      if (!notesContent && typeof response.data === 'object' && response.data?.choices) {
        notesContent = response.data.choices[0]?.message?.content || '';
      }
      if (!notesContent) notesContent = text;

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
            transcript: `${TASK_EXTRACTION_PROMPT}\n\nClinical Notes:\n${notes}`,
            templatePrompt: 'You are a veterinary task extraction specialist. Extract tasks and return ONLY valid JSON.',
          },
        });

        const taskText = typeof taskResponse.data === 'string' ? taskResponse.data :
                         taskResponse.data instanceof Blob ? await taskResponse.data.text() :
                         JSON.stringify(taskResponse.data);

        let taskContent = '';
        for (const line of taskText.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) taskContent += content;
          } catch { /* skip */ }
        }
        if (!taskContent) taskContent = taskText;

        let cleanJson = taskContent.trim();
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

        const parsed = JSON.parse(cleanJson);
        const tasks: any[] = [];
        for (const [category, items] of Object.entries(parsed)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              tasks.push({
                id: crypto.randomUUID(),
                text: (item as any).text || String(item),
                category: category as any,
                assignee: (item as any).assignee || 'Vet',
                done: false,
              });
            }
          }
        }
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
          },
        });

        const ciText = typeof ciResponse.data === 'string' ? ciResponse.data :
                       ciResponse.data instanceof Blob ? await ciResponse.data.text() :
                       JSON.stringify(ciResponse.data);

        let ciContent = '';
        for (const line of ciText.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) ciContent += content;
          } catch { /* skip */ }
        }
        if (!ciContent) ciContent = ciText;

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
          });

          if (currentState.tasks.length > 0) {
            await supabase.from('tasks').insert(
              currentState.tasks.map(t => ({
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

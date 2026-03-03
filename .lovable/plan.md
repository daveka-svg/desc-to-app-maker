

# Plan: Adopt OpenScribe Core Workflow into ETV Scribe

## What is OpenScribe?

OpenScribe is an open-source medical scribe with a clear pipeline: **Record Audio → Transcribe (Whisper) → Generate Notes (LLM) → Edit/Export**. It uses workflow states (Idle → Recording → Processing → Note Editor) and encounter-based session management.

## What Needs to Change

Your app has the pieces (audio recorder, transcription, note generation, PE form, tasks) but they are loosely connected with hardcoded data and broken flows. The goal is to wire everything into a proper **encounter pipeline** like OpenScribe.

---

## Implementation Plan

### 1. Add Workflow State Machine to Session Store

Add an `encounterStatus` field to the Zustand store with states:
```text
idle → recording → processing → reviewing
```

- **idle**: Fresh state. "New Session" button visible. No active encounter.
- **recording**: Audio is capturing, live transcription running. Show waveform + timer prominently.
- **processing**: Recording stopped, AI is generating notes/tasks/instructions. Show progress indicators.
- **reviewing**: Notes are ready for editing, copying, exporting.

This replaces the current ad-hoc `isRecording` / `isGeneratingNotes` booleans with a single source of truth.

### 2. Redesign the Main View Around Workflow States

Instead of always showing 4 tabs, the center panel adapts to the workflow state:

- **idle**: Show a clean "Start New Encounter" card with patient name input, template selector, and a large "Start Recording" button. Past sessions visible in sidebar.
- **recording**: Full-screen recording view with large timer, live waveform, live transcript preview, pause/resume/stop controls. PE form accessible via a collapsible section below.
- **processing**: Animated progress showing "Transcribing... Generating notes... Extracting tasks..." steps.
- **reviewing**: The current Notes tab view with editable notes, tasks sidebar, client instructions tab. Tabs appear: Notes | Transcript | Client Instructions.

### 3. Wire the End-to-End Pipeline

When user clicks "End Session" (stop recording):

1. Audio blob is captured (already works)
2. Transcript is finalized from Web Speech API (already works)
3. Auto-transition to `processing` state
4. Call `generate-notes` edge function with transcript + PE data (switch from Mercury client-side to the edge function for reliability)
5. Stream notes into the store
6. Auto-extract tasks via Mercury/edge function
7. Auto-generate client instructions
8. Save session to database (sessions table)
9. Transition to `reviewing` state

### 4. Replace Fake Sidebar Data with Real Sessions

- Remove hardcoded "Veronika Efimova" user info
- On app load, fetch sessions from the `sessions` table (requires auth, covered below)
- Display real session history grouped by date
- Loading a past session fetches its notes/tasks from the database

### 5. Add Authentication (Required for Database RLS)

Since all tables have RLS policies requiring `auth.uid()`, add:
- A simple login/signup page at `/auth`
- Protected route wrapper for `/`
- User profile display in sidebar footer (from `profiles` table)
- Auto-redirect to `/auth` if not logged in

### 6. Persist Sessions to Database

Wire the `saveCurrentSession` function to upsert into the `sessions` table:
- Save `patient_name`, `session_type`, `pe_data`, `pe_enabled`, `duration_seconds`, `status`
- Save transcript and notes to the `notes` table
- Save tasks to the `tasks` table
- On session load, fetch from database instead of localStorage

### 7. Switch Note Generation to Edge Function

The current `useNoteGeneration` hook calls Mercury directly from the client (exposing the API key in the browser). Switch to:
- Call the existing `generate-notes` edge function via `supabase.functions.invoke()`
- Stream the SSE response back to the UI
- This is more secure and uses the Lovable AI gateway

---

## Technical Details

### Files to Create
- `src/pages/Auth.tsx` — Login/signup page
- `src/components/ProtectedRoute.tsx` — Auth guard wrapper
- `src/components/encounter/IdleView.tsx` — Start encounter screen
- `src/components/encounter/RecordingView.tsx` — Recording state UI
- `src/components/encounter/ProcessingView.tsx` — AI processing progress
- `src/hooks/useEncounterPipeline.ts` — Orchestrates the full pipeline on stop

### Files to Modify
- `src/stores/useSessionStore.ts` — Add `encounterStatus`, remove mock data, add DB persistence methods
- `src/pages/Index.tsx` — Render based on `encounterStatus` instead of tabs
- `src/components/layout/Sidebar.tsx` — Fetch real sessions, show real user profile
- `src/hooks/useNoteGeneration.ts` — Switch from Mercury to edge function
- `src/App.tsx` — Add auth routes and protected route wrapper

### Database Migration
- None needed — tables already exist with correct schema

### Edge Function Changes
- The existing `generate-notes` function is already correct and deployed

---

## Order of Implementation

1. Authentication (login/signup page + protected routes)
2. Workflow state machine in store
3. Encounter pipeline views (Idle → Recording → Processing → Reviewing)
4. Wire note generation to edge function
5. Database persistence for sessions/notes/tasks
6. Real sidebar with fetched sessions and user profile




# Fix Plan: Make ETV Scribe a Fully Working App

## Good News: No API Keys Needed

Everything is already configured:
- **LOVABLE_API_KEY** is set (powers AI note generation via edge function)
- **Google OAuth** is managed by Lovable Cloud automatically
- The `generate-notes` edge function is deployed and working (confirmed with a live test just now)
- Database tables exist with correct RLS policies
- Auth flow with Google + email/password is implemented

## What's Actually Broken

### 1. Build Error (blocks deployment)
`src/test/workflow-pipeline.test.tsx` imports `fireEvent`, `screen`, `waitFor` from `@testing-library/react` which isn't installed. This test also references the old Mercury API which has been replaced.

**Fix:** Delete or rewrite this test file to remove the build error.

### 2. `handle_new_user` trigger is missing
The `handle_new_user` function exists but no trigger is attached to `auth.users` to call it on signup. This means profiles are never auto-created, so the sidebar shows "Loading..." for the user name and all RLS-protected queries fail silently.

**Fix:** Create the trigger via migration:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. Recording flow not connected to pipeline
The Context panel has Start/Stop recording buttons, but stopping doesn't trigger note generation. The "Create" button in TopBar works but requires a transcript to already exist. There's no automatic flow from recording → transcription → notes.

**Fix:** Wire the "End session" button to automatically trigger the Create pipeline (generate notes → extract tasks → generate client instructions → save to DB).

### 4. RLS policies use `RESTRICTIVE` instead of `PERMISSIVE`
All RLS policies are marked `Permissive: No` (restrictive). Restrictive policies require ALL to pass rather than ANY. With no permissive policies present, all queries silently return empty results even for authenticated users.

**Fix:** Recreate policies as PERMISSIVE (the default) so authenticated users can actually read/write their own data.

### 5. `newSession` in sidebar doesn't work properly
Clicking "New session" resets store state but doesn't refresh the session list or provide feedback.

**Fix:** After `newSession()`, re-fetch sessions from DB and set encounter status.

## Implementation Order

1. **Fix build error** — delete broken test file
2. **Fix RLS policies** — recreate as PERMISSIVE via migration
3. **Add profile trigger** — create missing `on_auth_user_created` trigger
4. **Wire recording to pipeline** — connect End Session → auto-generate notes → save
5. **Fix sidebar session refresh** — re-fetch after new session / save

## Files to Change
- Delete `src/test/workflow-pipeline.test.tsx`
- DB migration: fix RLS policies + add trigger
- `src/components/panels/ContextPanel.tsx` — wire End Session to full pipeline
- `src/components/layout/Sidebar.tsx` — refresh sessions after save
- `src/hooks/useEncounterPipeline.ts` — may need minor fixes


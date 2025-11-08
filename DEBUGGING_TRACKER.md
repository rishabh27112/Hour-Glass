# Time Tracker Debugging Guide

## Added Console Logs

I've added detailed console logging throughout the time tracking flow to help debug why entries aren't being created.

### Where to Look for Logs

#### 1. **Electron Main Process Console** (Node.js/Backend)
Look in the terminal where you ran `npm start` or `npm run dev` for the winapp.

Expected logs when tracking works:
```
[IPC] TimeTracker:start called with: { usr: '...', proj: '...', task: '...', intervalMs: 200 }
[TimeTracker] Starting tracking: { user: '...', project: '...', task: '...', intervalMs: 200 }
[TimeTracker] Storage path: C:\Users\...\time_entries.json
Auto-sync started (30 second interval)
[TimeTracker] No current entry, initializing new entry for Visual Studio Code
[TimeTracker] Created new entry: Visual Studio Code
[TimeTracker] Pushing entry: Code.exe (Visual Studio Code)
     duration: 5.234 seconds
[TimeTracker] Total entries in memory: 1
Saved 1 entries to local storage
Online - attempting to sync with server
Found 1 entries to sync to server
Sending 1 entries to server (/api/time-entries)
Server stored entry: <mongodb-id>
Successfully synced to server and cleared local storage
```

#### 2. **Browser DevTools Console** (React Frontend)
Open DevTools in your Electron app (Ctrl+Shift+I or Cmd+Option+I).

Expected logs when you press Start:
```
[TaskPage] Starting native tracker...
[TaskPage] TimeTracker available: true
[TaskPage] Setting auth token
[TaskPage] Calling TimeTracker.start with: { project: '...', task: 'Task Name (...)' }
[TaskPage] TimeTracker.start called successfully
```

When you press Stop:
```
[TaskPage] Stopping native tracker...
[TaskPage] TimeTracker available for stop: true
[TaskPage] Calling TimeTracker.stop
[TaskPage] Calling TimeTracker.sendData
[TaskPage] TimeTracker stopped and data sent
[IPC] TimeTracker:stop called
[IPC] TimeTracker:stop completed
[IPC] TimeTracker:sendData called
[IPC] TimeTracker:sendData completed
```

## Testing Steps

### 1. Test from Task Page
1. Open your Electron app
2. Navigate to a task
3. Open DevTools (Ctrl+Shift+I)
4. Click **Start** button
5. **Check both consoles** for the logs above
6. Switch between different apps for a few seconds
7. Click **Stop** button
8. **Check both consoles** for stop/sync logs

### 2. Test from Project Page
1. Navigate to a project
2. Click the **Start** button in the project header (or next to a task)
3. **Check both consoles**
4. Switch apps
5. Click **Stop** or the pause button
6. **Check both consoles**

## Common Issues & What to Look For

### Issue: No logs in main process console
**Problem:** TimeTracker IPC not being called
**Check:**
- Is `globalThis.TimeTracker` defined? Add this in browser console:
  ```javascript
  console.log('TimeTracker:', globalThis.TimeTracker);
  ```
- Is the preload script loaded? Check main.ts webPreferences

### Issue: "TimeTracker available: false"
**Problem:** Preload bridge not exposing TimeTracker
**Fix:** Check that `preload.ts` is being compiled and loaded

### Issue: Logs show tracker starting but no entries created
**Problem:** Window monitoring not detecting apps
**Check main console for:**
- "Started Monitoring" message
- "No current entry, initializing..." messages
- If you see "Unknown" windows, the active-win module may need permissions

### Issue: Entries created but not syncing
**Check main console for:**
- "Online - attempting to sync" vs "Offline - data saved to local storage only"
- "Failed to sync entry" with HTTP error codes
- "Could not read auth token from session cookies" (auth issue)

### Issue: HTTP 401 or "Not Authorized"
**Problem:** Authentication token missing or invalid
**Solutions:**
- Make sure you're logged in through the app
- Check that the cookie is set: In DevTools Application tab → Cookies → localhost
- Try calling `TimeTracker.setAuthToken(token)` manually with your JWT

### Issue: "No entries to sync" despite working for a while
**Problem:** Entries not accumulating (duration too short or window switching too fast)
**Check:** Entries must be longer than 2 seconds to be saved

## Quick Diagnostic Commands

Run these in the **browser DevTools console**:

```javascript
// Check if TimeTracker is available
console.log('TimeTracker API:', globalThis.TimeTracker);

// Manually test start
globalThis.TimeTracker.start('testuser', 'proj123', 'Test Task', 200);

// Check storage
globalThis.TimeTracker.isStorageEmpty().then(empty => console.log('Storage empty:', empty));

// Read stored entries
globalThis.TimeTracker.readStoredEntries().then(entries => console.log('Stored entries:', entries));

// Manual sync
globalThis.TimeTracker.sendData();

// Manual stop
globalThis.TimeTracker.stop();
```

## Files Modified with Logging

1. `winapp/src/electron/main.ts` - Main process IPC and tracking logic
2. `Frontend/src/pages/Tasks/TaskPage.jsx` - Task page Start/Stop buttons
3. `Frontend/src/pages/ProjectPage.jsx` - Project page Start/Stop helpers

## Next Steps After Testing

Once you run the test and see the logs:
1. **Copy the console output** from both main process and browser
2. Share what you see (or don't see)
3. We can pinpoint exactly where the flow is breaking

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("getCurrentWinAPI", {
  getCurrentWindow: () => ipcRenderer.invoke("getCurrentWindow"),
  start: () => ipcRenderer.invoke("getCurrentWindow:start"),
  stop: () => ipcRenderer.invoke("getCurrentWindow:stop"),
});


contextBridge.exposeInMainWorld('TimeTracker', {
  // usr, proj, task are strings; intervalMs optional number
  start: (usr?: string, proj?: string, task?: string, intervalMs?: number) => ipcRenderer.invoke('TimeTracker:start', usr || '', proj || '', task || '', intervalMs),
  stop: () => ipcRenderer.invoke('TimeTracker:stop'),
  sendData: () => ipcRenderer.invoke('TimeTracker:sendData'),
  saveData: () => ipcRenderer.invoke('TimeTracker:saveData'),
  isStorageEmpty: () => ipcRenderer.invoke('TimeTracker:isStorageEmpty'),
  readStoredEntries: () => ipcRenderer.invoke('TimeTracker:readStoredEntries'),
  clearStorage: () => ipcRenderer.invoke('TimeTracker:clearStorage'),
  setAuthToken: (token: string) => ipcRenderer.invoke('TimeTracker:setAuthToken', token),
  status: () => ipcRenderer.invoke('TimeTracker:status'),
  onLog: (cb: (msg: any) => void) => {
    // register a listener for log events from main
    ipcRenderer.on('TimeTracker:log', (event, data) => {
      try { cb(data); } catch (err) { console.error('TimeTracker.onLog callback error', err); }
    });
  }
});

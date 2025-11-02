import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("getCurrentWinAPI", {
  getCurrentWindow: () => ipcRenderer.invoke("getCurrentWindow"),
  start: () => ipcRenderer.invoke("getCurrentWindow:start"),
  stop: () => ipcRenderer.invoke("getCurrentWindow:stop"),
});


contextBridge.exposeInMainWorld('TimeTracker', {
  start: () => ipcRenderer.invoke('TimeTracker:start'),
  stop: () => ipcRenderer.invoke('TimeTracker:stop'),
  sendData: () => ipcRenderer.invoke('TimeTracker:sendData'),
  saveData: () => ipcRenderer.invoke('TimeTracker:saveData'),
  isStorageEmpty: () => ipcRenderer.invoke('TimeTracker:isStorageEmpty'),
  readStoredEntries: () => ipcRenderer.invoke('TimeTracker:readStoredEntries'),
  clearStorage: () => ipcRenderer.invoke('TimeTracker:clearStorage'),
});

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("getCurrentWinAPI", {
  getActiveWindowInfo: () => ipcRenderer.invoke("getCurrentWindow")
});

contextBridge.exposeInMainWorld('TimeTracker', {
  start: () => ipcRenderer.invoke('TimeTracker:start'),
  stop: () => ipcRenderer.invoke('TimeTracker:stop'),
  sendData: () => ipcRenderer.invoke('TimeTracker:sendData'),
  saveData: () => ipcRenderer.invoke('TimeTracker:saveData'),
  getEntries: () => ipcRenderer.invoke('TimeTracker:getEntries'),
  getCurrentEntry: () => ipcRenderer.invoke('TimeTracker:getCurrentEntry'),
  getStats: () => ipcRenderer.invoke('TimeTracker:getStats'),
  clearEntries: () => ipcRenderer.invoke('TimeTracker:clearEntries'),
});

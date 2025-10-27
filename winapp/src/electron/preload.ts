import { contextBridge, ipcRenderer } from "electron";
import { send } from "process";

contextBridge.exposeInMainWorld("getCurrentWinAPI", {
  getActiveWindowInfo: () => ipcRenderer.invoke("getCurrentWindow")
});

contextBridge.exposeInMainWorld('TimeTracker', {
  start: () => ipcRenderer.invoke('TimeTracker:start'),
  stop: () => ipcRenderer.invoke('TimeTracker:stop'),
  sendData: () => ipcRenderer.invoke('TimeTracker:sendData'),
  saveData: () => ipcRenderer.invoke('TimeTracker:saveData'),
});

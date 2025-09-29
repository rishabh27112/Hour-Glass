import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getActiveWindowInfo: () => ipcRenderer.invoke("getCurrentWindow")
});

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import osUtils from "os-utils";
import activeWin from 'active-win';


let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // load preload script
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:24000");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

}

async function getActiveWindowInfo() {
    const result = await activeWin();
    if (result) {
        console.log("Active window title:", result.title);
        console.log("Active window application:", result.owner.name);
        return result.title;
    }
}

ipcMain.handle("getCurrentWindow", async () => {
  return await getActiveWindowInfo();
})

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

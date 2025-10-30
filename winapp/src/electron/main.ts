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
  mainWindow.loadURL("http://localhost:3000");
  mainWindow.webContents.openDevTools();
} else {
  mainWindow.loadFile(path.join(__dirname, "../Frontend/build/index.html"));
}


	mainWindow.on("closed", () => {
		mainWindow = null;
	});

}

async function getActiveWindowInfo() {
	const result = await activeWin();
	if (result) {
		// 	// console.log("Active window info:", result);
		// 	// console.log("Active window title:", result.title);
		// 	// console.log("Active window application:", result.owner.name);
		return result;
	}
}


interface TimeEntry {
	apptitle: string;
	appname: string;
	startTime: Date;
	endTime: Date;
	duration: number;
}

class TimeTracker {
	private entries: TimeEntry[] = [];
	private currentEntry: TimeEntry | null = null;
	private trackingInterval: NodeJS.Timeout | null = null;

	public startTracking(intervalMs: number = 200) {
		if (this.trackingInterval) return;
		this.trackingInterval = setInterval(async () => {
			const activeWindow = await getActiveWindowInfo();
			const now = new Date();

			if (!this.currentEntry) return;

			if (this.currentEntry.apptitle === activeWindow?.title) {
				this.currentEntry.endTime = now;
				// this.currentEntry.duration = (this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000;
			} else {
				if (
					this.currentEntry &&
					this.currentEntry.startTime &&
					this.currentEntry.endTime &&
					(this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime() > 2000)
				) {
					this.entries.push(this.currentEntry);
				}
				this.currentEntry = {
					apptitle: activeWindow?.title || "Unknown",
					appname: activeWindow?.owner.name || "Unknown",
					startTime: this.currentEntry?.startTime || now,
					endTime: now,
					duration: 0,
				};
			}
		}, intervalMs);
	}
	public sendTrackingData() {
		// Implement sending logic here (e.g., send to a server)
	}
	public saveTrackingData() {
		// Implement saving logic here (e.g., write to a file or database)
	}
	public stopTracking() {
		if (this.trackingInterval) {
			clearInterval(this.trackingInterval);
			this.trackingInterval = null;
		}
		if (this.currentEntry) {
			this.entries.push(this.currentEntry);
			this.currentEntry = null;
		}
	}
	public printEntries() {
		for (const entry of this.entries) {
			console.log(`${entry.appname} - ${entry.apptitle}: ${entry.startTime.toISOString()} to ${entry.endTime.toISOString()} (${entry.duration} seconds)`);
		}
	}
}



ipcMain.handle("getCurrentWindow", async () => {
	return await getActiveWindowInfo();
})
const tracker = new TimeTracker();

ipcMain.handle('TimeTracker:start', () => {
	tracker.startTracking();
});
ipcMain.handle('TimeTracker:stop', () => {
	tracker.stopTracking();
});
ipcMain.handle('TimeTracker:sendData', () => {
	tracker.sendTrackingData();
});
ipcMain.handle('TimeTracker:saveData', () => {
	tracker.saveTrackingData();
});
ipcMain.handle('TimeTracker:printEntries', () => {
	tracker.printEntries();
});

app.on("ready", createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
	if (mainWindow === null) createWindow();
});
import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import osUtils from "os-utils";
import activeWin from 'active-win';
import { act } from "react";


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

class SystemResourceMonitor {
  private currentWindow: any | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;

  public startMonitoring(intervalMs: number = 100) {
	console.log('Started Monitoring');	

    this.monitorInterval = setInterval(async () => {
      this.currentWindow = await this.setActiveWindowInfo();
	//   console.log(`Active Window: ${this.currentWindow.title} - ${this.currentWindow.owner.name}`);
    }, intervalMs);
  }

  public stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private async setActiveWindowInfo() {
    try {
      const result = await activeWin();
      return result ?? { title: "Unknown", owner: { name: "Unknown" } };
    } catch (err) {
      console.error("Error fetching active window:", err);
      return { title: "Error", owner: { name: "Unknown" } };
    }
  }

  public getCurrentWindowInfo() {
    return this.currentWindow;
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
	private sm: SystemResourceMonitor;

	constructor(sys:SystemResourceMonitor) {
		this.sm = sys;
		console.log(`TimeTracker initialized`);
	}

	public startTracking(intervalMs: number = 200) {
		console.log(`TimeTracker started with interval ${intervalMs} ms`);
		this.trackingInterval = setInterval(async () => {
			const activeWindow = this.sm.getCurrentWindowInfo();
			const now = new Date();

			if (!this.currentEntry){
				console.log(`No current entry, initializing new entry for ${activeWindow?.title}`);
				if(activeWindow && activeWindow.title !== "Unknown"){
					this.currentEntry = {
						apptitle: activeWindow?.title || "Unknown",
						appname: activeWindow?.owner.name || "Unknown",
						startTime: now,
						endTime: now,
						duration: 0,
					};
				}
				return;
			}

			if (this.currentEntry.apptitle === activeWindow?.title) {
				this.currentEntry.endTime = now;
				// console.log(`Updated current entry endTime to ${now.toISOString()} for ${this.currentEntry.apptitle}`);
				// this.currentEntry.duration = (this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000;
			} else {
				if (
					this.currentEntry &&
					this.currentEntry.startTime &&
					this.currentEntry.endTime &&
					(this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime() > 2000)
				) {
					this.currentEntry.duration = (this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000;
					console.log(`Pushing entry: ${this.currentEntry.appname}\n\t duration: ${this.currentEntry.duration} seconds`);
					this.entries.push(this.currentEntry);
				


					this.currentEntry = {
						apptitle: activeWindow?.title || "Unknown",
						appname: activeWindow?.owner.name || "Unknown",
						startTime: now,
						endTime: now,
						duration: 0,
					};
				}
			}
		}, intervalMs);
	}
	public sendTrackingData() {
		// Implement sending to server logic here
	}
	public saveTrackingData() {
		// Implement cache logic here 
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


const monitor = new SystemResourceMonitor();

const tracker = new TimeTracker(monitor);


ipcMain.handle("getCurrentWindow", async () => {
	return await monitor.getCurrentWindowInfo();
})
ipcMain.handle("getCurrentWindow:start", () => {
	monitor.startMonitoring();
});
ipcMain.handle("getCurrentWindow:stop", () => {
	monitor.stopMonitoring();
});




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
	tracker.stopTracking();
	monitor.stopMonitoring();
	if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
	if (mainWindow === null) createWindow();
});
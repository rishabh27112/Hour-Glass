import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import activeWin from 'active-win';


let mainWindow: BrowserWindow | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
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
	private dataFilePath: string;
	private saveInterval: NodeJS.Timeout | null = null;

	constructor() {
		const userDataPath = app.getPath('userData');
		this.dataFilePath = path.join(userDataPath, 'time-tracking-data.json');
		this.loadTrackingData();
	}

	public startTracking(intervalMs: number = 200) {
		if (this.trackingInterval) return;

		(async () => {
			const activeWindow = await getActiveWindowInfo();
			const now = new Date();
			this.currentEntry = {
				apptitle: activeWindow?.title || "Unknown",
				appname: activeWindow?.owner.name || "Unknown",
				startTime: now,
				endTime: now,
				duration: 0,
			};
		})();

		this.trackingInterval = setInterval(async () => {
			const activeWindow = await getActiveWindowInfo();
			const now = new Date();

			if (!this.currentEntry) {
				this.currentEntry = {
					apptitle: activeWindow?.title || "Unknown",
					appname: activeWindow?.owner.name || "Unknown",
					startTime: now,
					endTime: now,
					duration: 0,
				};
				return;
			}

			if (this.currentEntry.apptitle === activeWindow?.title) {
				this.currentEntry.endTime = now;
				this.currentEntry.duration = Math.floor((this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000);
			} else {
				if (
					this.currentEntry &&
					this.currentEntry.startTime &&
					this.currentEntry.endTime &&
					(this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime() > 2000)
				) {
					this.currentEntry.duration = Math.floor((this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000);
					this.entries.push(this.currentEntry);
				}
				this.currentEntry = {
					apptitle: activeWindow?.title || "Unknown",
					appname: activeWindow?.owner.name || "Unknown",
					startTime: now,
					endTime: now,
					duration: 0,
				};
			}
		}, intervalMs);

		this.saveInterval = setInterval(() => {
			this.saveTrackingData();
		}, 30000);
	}

	public sendTrackingData() {
		console.log('Sending tracking data to server...');
		return { success: true, message: 'Server sync not yet implemented' };
	}

	public saveTrackingData() {
		try {
			const dataToSave = {
				entries: this.entries.map(entry => ({
					...entry,
					startTime: entry.startTime.toISOString(),
					endTime: entry.endTime.toISOString(),
				})),
				currentEntry: this.currentEntry ? {
					...this.currentEntry,
					startTime: this.currentEntry.startTime.toISOString(),
					endTime: this.currentEntry.endTime.toISOString(),
				} : null,
				lastSaved: new Date().toISOString(),
			};

			fs.writeFileSync(this.dataFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
			console.log(`Tracking data saved to: ${this.dataFilePath}`);
			return { success: true, filePath: this.dataFilePath };
		} catch (error) {
			console.error('Error saving tracking data:', error);
			return { success: false, error: String(error) };
		}
	}

	private loadTrackingData() {
		try {
			if (fs.existsSync(this.dataFilePath)) {
				const data = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf-8'));
				this.entries = data.entries.map((entry: { apptitle: string; appname: string; startTime: string; endTime: string; duration: number }) => ({
					...entry,
					startTime: new Date(entry.startTime),
					endTime: new Date(entry.endTime),
				}));
				console.log(`Loaded ${this.entries.length} tracking entries from file`);
			}
		} catch (error) {
			console.error('Error loading tracking data:', error);
		}
	}

	public stopTracking() {
		if (this.trackingInterval) {
			clearInterval(this.trackingInterval);
			this.trackingInterval = null;
		}
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
			this.saveInterval = null;
		}
		if (this.currentEntry) {
			const now = new Date();
			this.currentEntry.endTime = now;
			this.currentEntry.duration = Math.floor((this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime()) / 1000);
			if (this.currentEntry.duration > 2) {
				this.entries.push(this.currentEntry);
			}
			this.currentEntry = null;
		}
		this.saveTrackingData();
	}

	public getEntries() {
		return this.entries;
	}

	public getCurrentEntry() {
		return this.currentEntry;
	}

	public getStats() {
		const totalTime = this.entries.reduce((sum, entry) => sum + entry.duration, 0);
		const appStats: { [key: string]: number } = {};

		this.entries.forEach(entry => {
			if (!appStats[entry.appname]) {
				appStats[entry.appname] = 0;
			}
			appStats[entry.appname] += entry.duration;
		});

		return {
			totalEntries: this.entries.length,
			totalTime,
			appStats,
		};
	}

	public clearEntries() {
		this.entries = [];
		this.saveTrackingData();
	}

	public printEntries() {
		for (const entry of this.entries) {
			console.log(`${entry.appname} - ${entry.apptitle}: ${entry.startTime.toISOString()} to ${entry.endTime.toISOString()} (${entry.duration} seconds)`);
		}
	}
}

ipcMain.handle("getCurrentWindow", async () => {
	return await getActiveWindowInfo();
});

const tracker = new TimeTracker();

ipcMain.handle('TimeTracker:start', () => {
	tracker.startTracking();
	return { success: true };
});

ipcMain.handle('TimeTracker:stop', () => {
	tracker.stopTracking();
	return { success: true };
});

ipcMain.handle('TimeTracker:sendData', () => {
	return tracker.sendTrackingData();
});

ipcMain.handle('TimeTracker:saveData', () => {
	return tracker.saveTrackingData();
});

ipcMain.handle('TimeTracker:printEntries', () => {
	tracker.printEntries();
});

ipcMain.handle('TimeTracker:getEntries', () => {
	return tracker.getEntries();
});

ipcMain.handle('TimeTracker:getCurrentEntry', () => {
	return tracker.getCurrentEntry();
});

ipcMain.handle('TimeTracker:getStats', () => {
	return tracker.getStats();
});

ipcMain.handle('TimeTracker:clearEntries', () => {
	tracker.clearEntries();
	return { success: true };
});

app.on("ready", () => {
	createWindow();
	setTimeout(() => {
		tracker.startTracking();
		console.log('Time tracking started automatically');
	}, 1000);
});

app.on("window-all-closed", () => {
	tracker.stopTracking();
	if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
	if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
	tracker.stopTracking();
});


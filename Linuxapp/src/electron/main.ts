import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	if (process.env.NODE_ENV === "development") {
		mainWindow.loadURL("http://localhost:5173");
		mainWindow.webContents.openDevTools();
	} else {
		mainWindow.loadFile(path.join(__dirname, "../dist-react/index.html"));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

interface WindowInfo {
	title: string;
	owner: {
		name: string;
		processId: number;
		path: string;
	};
}

// Detect session type on startup
let sessionType: string = "unknown";
let isX11: boolean = false;

function detectSessionType() {
	sessionType = process.env.XDG_SESSION_TYPE || "unknown";
	isX11 = sessionType === "x11" || !!(process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);

	console.log("=== Linux Time Tracker - Session Detection ===");
	console.log("XDG_SESSION_TYPE:", process.env.XDG_SESSION_TYPE);
	console.log("DISPLAY:", process.env.DISPLAY);
	console.log("WAYLAND_DISPLAY:", process.env.WAYLAND_DISPLAY);
	console.log("Detected as X11:", isX11);
	console.log("==============================================");

	if (!isX11) {
		console.error("\n⚠️  WARNING: This application requires X11 (X.org) to function properly!");
		console.error("⚠️  Wayland is NOT supported for window tracking.");
		console.error("⚠️  Please log out and select 'Plasma (X11)' or 'GNOME on Xorg' session.");
		console.error("⚠️  The app will run but window tracking will NOT work.\n");
	}
}

// Simple and reliable X11 window detection using xdotool
async function getActiveWindowInfo(): Promise<WindowInfo | null> {
	if (!isX11) {
		return null;
	}

	try {
		// Get active window ID
		const { stdout: windowIdRaw } = await execAsync('xdotool getactivewindow 2>/dev/null');
		const windowId = windowIdRaw.trim();

		if (!windowId) {
			return null;
		}

		// Get window title
		const { stdout: windowTitle } = await execAsync(`xdotool getwindowname ${windowId} 2>/dev/null`);

		// Get window PID
		const { stdout: windowPidRaw } = await execAsync(`xdotool getwindowpid ${windowId} 2>/dev/null`);
		const pid = parseInt(windowPidRaw.trim()) || 0;

		// Get process name and path from PID
		let processName = "Unknown";
		let processPath = "";

		if (pid > 0) {
			try {
				// Get process name
				const { stdout: commOutput } = await execAsync(`cat /proc/${pid}/comm 2>/dev/null`);
				processName = commOutput.trim();

				// Get process executable path
				try {
					const { stdout: exeOutput } = await execAsync(`readlink -f /proc/${pid}/exe 2>/dev/null`);
					processPath = exeOutput.trim();
				} catch {
					// If readlink fails, try cmdline
					processPath = "";
				}
			} catch {
				// Process might have ended, use fallback
				processName = "Unknown";
			}
		}

		return {
			title: windowTitle.trim(),
			owner: {
				name: processName,
				processId: pid,
				path: processPath
			}
		};
	} catch {
		// xdotool failed - likely not installed or not on X11
		return null;
	}
}

interface TimeEntry {
	apptitle: string;
	appname: string;
	startTime: Date;
	endTime: Date;
	duration: number;
}

// Helper: Convert Date to IST string
function toISTString(date: Date): string {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffsetMs);
    const yyyy = istDate.getUTCFullYear();
    const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getUTCDate()).padStart(2, '0');
    const hh = String(istDate.getUTCHours()).padStart(2, '0');
    const min = String(istDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(istDate.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} IST`;
}

// Helper: Parse IST string back to Date
function parseISTString(str: string): Date {
    const match = str.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) IST/);
    if (!match) return new Date(str);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_full, yyyy, mm, dd, hh, min, ss] = match;
    const utcDate = new Date(Date.UTC(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss)
    ));
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    return new Date(utcDate.getTime() - istOffsetMs);
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
					startTime: toISTString(entry.startTime),
					endTime: toISTString(entry.endTime),
				})),
				currentEntry: this.currentEntry ? {
					...this.currentEntry,
					startTime: toISTString(this.currentEntry.startTime),
					endTime: toISTString(this.currentEntry.endTime),
				} : null,
				lastSaved: toISTString(new Date()),
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
					startTime: parseISTString(entry.startTime),
					endTime: parseISTString(entry.endTime),
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
			this.currentEntry.endTime = new Date();
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
	const result = await getActiveWindowInfo();
	if (result) {
		return {
			title: result.title,
			owner: {
				name: result.owner.name,
				processId: result.owner.processId,
				path: result.owner.path
			}
		};
	}
	return null;
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
	detectSessionType();
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


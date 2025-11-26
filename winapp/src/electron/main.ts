import { app, BrowserWindow, ipcMain, session } from "electron";

import * as path from "node:path";
import * as fs from "node:fs";
import activeWin from 'active-win';
import { FileStorageManager } from './fileStorage';
import * as https from 'node:https';

const API_BASE_URL = process.env.API_BASE_URL || 'https://hour-glass-1.onrender.com';

let mainWindow: BrowserWindow | null = null;

// Helper to emit a log message to renderer (and console). Renderer can subscribe via IPC.
function emitRendererLog(message: string, data?: any) {
	try {
		console.log(message, data ?? '');
	} catch (e) {
		// ignore
	}
	try {
		if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
			mainWindow.webContents.send('TimeTracker:log', { message, data, ts: new Date().toISOString() });
		}
	} catch (err) {
		// ignore
	}
}

function createWindow() {
	console.log('[Electron] __dirname at runtime:', __dirname);
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		autoHideMenuBar: true,
		icon: path.join(__dirname, "../public/logo.ico"),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	});

	// Hide the default application menu bar
	mainWindow.setMenuBarVisibility(false);
	mainWindow.removeMenu();

	if (process.env.NODE_ENV === "development") {
		mainWindow.loadURL("http://localhost:3000");
		mainWindow.webContents.openDevTools();
	} else {
		// In production (including packaged), load the CRA bundle from dist-react
		// resolved relative to the compiled main.js file. When packaged, __dirname
		// points inside app.asar, so ../dist-react/index.html is available there.
		const distReactIndex = path.join(__dirname, "../dist-react/index.html");
		console.log('[Electron] Attempting to load UI from:', distReactIndex, 'exists:', fs.existsSync(distReactIndex));
		mainWindow.loadFile(distReactIndex);
	}

	// Debug what actually gets loaded in packaged/dev builds
	mainWindow.webContents.on('did-finish-load', () => {
		try {
			console.log('[Electron] did-finish-load URL:', mainWindow?.webContents.getURL());
		} catch (e) {
			console.log('[Electron] did-finish-load but could not read URL:', e);
		}
	});

	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		console.error('[Electron] did-fail-load', { errorCode, errorDescription, validatedURL });
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

export class SystemResourceMonitor {
  private currentWindow: { title: string; owner: { name: string } } | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;

  public startMonitoring(intervalMs: number = 100) {
	emitRendererLog('[TimeTracker] SystemResourceMonitor started');

		this.monitorInterval = setInterval(async () => {
			this.currentWindow = await this.setActiveWindowInfo();
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


export interface TimeEntry {
	apptitle: string;
	appname: string;
	startTime: Date;
	endTime: Date;
	duration: number;
}

export class TimeTracker {
	private entries: TimeEntry[] = [];
	private currentEntry: TimeEntry | null = null;
	private trackingInterval: NodeJS.Timeout | null = null;
	private syncInterval: NodeJS.Timeout | null = null;
	private readonly sm: SystemResourceMonitor;
	private readonly storage: FileStorageManager;
	private isSyncing: boolean = false;
	private authToken: string | null = null;

	private user_id: string | null;
	private project_id: string | null;
	private task_id: string | null;

	// running state
	private _running: boolean = false;

	// Minimum duration threshold in milliseconds (5 seconds)
	private readonly MIN_DURATION_MS = 5000;

	constructor(sys:SystemResourceMonitor, storage?: FileStorageManager) {
		this.sm = sys;
		this.storage = storage ?? new FileStorageManager();
		this.user_id = null;
		this.project_id = null;
		this.task_id = null;
		emitRendererLog('[TimeTracker] TimeTracker initialized', { path: this.storage.getFilePath() });
	}

	// Check if entry is a duplicate (same app, title, and overlapping time)
	private isDuplicateEntry(newEntry: TimeEntry): boolean {
		const newStart = newEntry.startTime.getTime();
		const newEnd = newEntry.endTime.getTime();
		
		for (const existing of this.entries) {
			const existingStart = existing.startTime.getTime();
			const existingEnd = existing.endTime.getTime();
			
			// Check if same app and title
			if (existing.appname === newEntry.appname && 
				existing.apptitle === newEntry.apptitle) {
				// Check for time overlap or very close timestamps (within 1 second)
				if (Math.abs(existingStart - newStart) < 1000 || 
					(newStart >= existingStart && newStart <= existingEnd) ||
					(newEnd >= existingStart && newEnd <= existingEnd)) {
					return true;
				}
			}
		}
		return false;
	}

	// Remove duplicate entries from an array and filter out entries less than 5 seconds
	private deduplicateAndFilterEntries(entries: TimeEntry[]): TimeEntry[] {
		const filtered: TimeEntry[] = [];
		
		for (const entry of entries) {
			// Ensure dates are Date objects
			const startTime = entry.startTime instanceof Date ? entry.startTime : new Date(entry.startTime);
			const endTime = entry.endTime instanceof Date ? entry.endTime : new Date(entry.endTime);
			const durationMs = endTime.getTime() - startTime.getTime();
			
			// Skip entries less than 5 seconds
			if (durationMs < this.MIN_DURATION_MS) {
				emitRendererLog('[TimeTracker] Filtering out short entry from storage', { 
					app: entry.appname, 
					title: entry.apptitle, 
					duration: durationMs / 1000 
				});
				continue;
			}
			
			// Update entry with proper Date objects and duration
			entry.startTime = startTime;
			entry.endTime = endTime;
			entry.duration = durationMs / 1000;
			
			// Check for duplicates in the filtered array
			let isDuplicate = false;
			for (const existing of filtered) {
				const existingStart = existing.startTime.getTime();
				const existingEnd = existing.endTime.getTime();
				const newStart = startTime.getTime();
				const newEnd = endTime.getTime();
				
				if (existing.appname === entry.appname && existing.apptitle === entry.apptitle) {
					// Check for exact match or time overlap
					if (Math.abs(existingStart - newStart) < 1000 ||
						(newStart >= existingStart && newStart <= existingEnd) ||
						(newEnd >= existingStart && newEnd <= existingEnd)) {
						isDuplicate = true;
						emitRendererLog('[TimeTracker] Found duplicate in storage', { 
							app: entry.appname, 
							title: entry.apptitle, 
							startTime: startTime.toISOString() 
						});
						break;
					}
				}
			}
			
			if (!isDuplicate) {
				filtered.push(entry);
			}
		}
		
		emitRendererLog('[TimeTracker] Deduplicated and filtered entries', { 
			original: entries.length, 
			filtered: filtered.length,
			removed: entries.length - filtered.length
		});
		
		return filtered;
	}

	public setAuthToken(token: string) {
		this.authToken = token;
	}

	private async refreshAuthTokenFromSession(): Promise<void> {
		try {
			const cookies = await session.defaultSession.cookies.get({ name: 'token' });
			if (cookies && cookies.length > 0) {
				// Prefer a cookie for localhost
				const cookie = cookies.find(c => (c.domain?.includes('localhost') || c.domain === 'localhost')) || cookies[0];
				if (cookie?.value) {
					this.authToken = cookie.value;
				}
			}
		} catch (err) {
			console.warn('Could not read auth token from session cookies:', err);
		}
	}

	 //Initialize and start auto-sync
	 //Call this after tracking starts
	private startAutoSync(): void {
		if (this.syncInterval) {
			return; // Already started
		}
		// Sync every 30 seconds
		this.syncInterval = setInterval(async () => {
			await this.autoSync();
		}, 30000);
		
		emitRendererLog('[TimeTracker] Auto-sync started (30 second interval)');
	}

	//Check if we have internet connectivity
	private async checkOnlineStatus(): Promise<boolean> {
		return new Promise((resolve) => {
			const options = {
				method: 'HEAD',
				hostname: 'www.google.com',
				port: 443,
				path: '/',
				timeout: 5000
			};

			const req = https.request(options, (res) => {
				resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302);
			});

			req.on('error', () => {
				resolve(false);
			});

			req.on('timeout', () => {
				req.destroy();
				resolve(false);
			});

			req.end();
		});
	}

	//Auto-sync: save to local file and send to server if online
	private async autoSync(): Promise<void> {
		if (this.isSyncing) {
			emitRendererLog('[TimeTracker] Sync already in progress, skipping');
			return;
		}

		try {
			this.isSyncing = true;

			// Save current in-memory entries to local file
			if (this.entries.length > 0) {
				await this.storage.appendEntries(this.entries);
				emitRendererLog('[TimeTracker] Saved entries to local storage', { count: this.entries.length });
				this.entries = []; // Clear in-memory entries after saving
			}

			const isOnline = await this.checkOnlineStatus();
			
			if (isOnline) {
				emitRendererLog('[TimeTracker] Online - attempting to sync with server');
				
				const isEmpty = await this.storage.isEmpty();
				
			if (!isEmpty) {
				const allEntries = await this.storage.readEntries();
				
				if (allEntries.length > 0) {
					emitRendererLog('[TimeTracker] Found entries to sync to server', { count: allEntries.length });
					
					// Deduplicate and filter entries before sending
					const cleanedEntries = this.deduplicateAndFilterEntries(allEntries);
					
					if (cleanedEntries.length === 0) {
						emitRendererLog('[TimeTracker] No valid entries to sync after filtering');
						// Clear the file since all entries were invalid
						await this.storage.clearFile();
						return;
					}
					
					const success = await this.sendToServer(cleanedEntries);						if (success) {
							await this.storage.clearFile();
							emitRendererLog('[TimeTracker] Successfully synced to server and cleared local storage');
						} else {
							emitRendererLog('[TimeTracker] Failed to sync to server, keeping local data');
						}
					}
				}
			} else {
				emitRendererLog('[TimeTracker] Offline - data saved to local storage only');
			}
		} catch (error) {
			emitRendererLog('[TimeTracker] Error during auto-sync', { error: String(error) });
		} finally {
			this.isSyncing = false;
		}
	}

	// Send entries to server (POST /api/time-entries one-by-one)
	private async sendToServer(entries: TimeEntry[]): Promise<boolean> {
		console.log("ok");
			emitRendererLog('[TimeTracker] Preparing to send entries to server', { count: entries.length });
		let allOk = true;
		try {
			// Ensure we have an auth token from the app session, if possible
			await this.refreshAuthTokenFromSession();
			emitRendererLog('[TimeTracker] Auth token present', { hasToken: !!this.authToken });
			for (let i = 0; i < entries.length; i++) {
				const appointment = entries[i];
				const payload = {
					appointment: {
						apptitle: appointment.apptitle,
						appname: appointment.appname,
						startTime: appointment.startTime instanceof Date ? appointment.startTime.toISOString() : appointment.startTime,
						endTime: appointment.endTime instanceof Date ? appointment.endTime.toISOString() : appointment.endTime,
						duration: appointment.duration,
					},
					projectId: this.project_id ?? undefined,
					description: this.task_id ?? undefined,
				};

				const headers: Record<string, string> = { "Content-Type": "application/json" };
				if (this.authToken) {
					// Server expects JWT in httpOnly cookie named 'token'
					headers["Cookie"] = `token=${this.authToken}`;
				}

				emitRendererLog('[TimeTracker] Sending payload to server', { 
					url: `${API_BASE_URL}/api/time-entries`,
					payload,
					hasAuthToken: !!this.authToken
				});

				try {
					const res = await fetch(`${API_BASE_URL}/api/time-entries`, {
						method: "POST",
						headers,
						body: JSON.stringify(payload),
					});

					if (res.ok) {
						const data = await res.json().catch(() => ({} as any));
						// Require created status and an object resembling a saved entry
						if (res.status === 201 && (data?._id || data?.appointment)) {
							emitRendererLog('[TimeTracker] Server stored entry', { id: data._id ?? 'ok' });
						} else {
							allOk = false;
							emitRendererLog('[TimeTracker] Unexpected success response for entry', { index: i + 1, total: entries.length, status: res.status, data });
						}
					} else {
						allOk = false;
						const text = await res.text();
						emitRendererLog('[TimeTracker] Failed to sync entry', { index: i + 1, total: entries.length, status: res.status, text });
					}
				} catch (err) {
					allOk = false;
					emitRendererLog('[TimeTracker] Error sending entry', { index: i + 1, total: entries.length, error: String(err) });
				}
			}

			return allOk;
		} catch (error) {
			emitRendererLog('[TimeTracker] Error sending to server', { error: String(error) });
			return false;
		}
	}

	public startTracking(usr : string, proj : string, task : string, intervalMs: number = 200) {
		this.user_id = usr;
		this.project_id = proj;
		this.task_id = task;

		// mark running
		this._running = true;

		emitRendererLog('[TimeTracker] Starting tracking', { user: usr, project: proj, task, intervalMs });
		emitRendererLog('[TimeTracker] Storage path', { path: this.storage.getFilePath() });
		
		// Start the system resource monitor to track active windows
		this.sm.startMonitoring();
		emitRendererLog('[TimeTracker] System resource monitor started');
		
		// Start auto-sync when tracking starts
		this.startAutoSync();
		
		this.trackingInterval = setInterval(async () => {
			const activeWindow = this.sm.getCurrentWindowInfo();
			const now = new Date();

			// Log the active window for debugging
			emitRendererLog('[TimeTracker] Active window detected', { title: activeWindow?.title, app: activeWindow?.owner?.name });

			if (!this.currentEntry){
				emitRendererLog('[TimeTracker] No current entry, initializing new entry', { title: activeWindow?.title });
				if(activeWindow && activeWindow.title !== "Unknown"){
					this.currentEntry = {
						apptitle: activeWindow?.title || "Unknown",
						appname: activeWindow?.owner.name || "Unknown",
						startTime: now,
						endTime: now,
						duration: 0,
					};
					emitRendererLog('[TimeTracker] Created new entry', { title: this.currentEntry.apptitle, app: this.currentEntry.appname });
				}
				return;
			}

			if (this.currentEntry.apptitle === activeWindow?.title) {
				// Same window, just update end time
				this.currentEntry.endTime = now;
				
			} else {
				// Window changed, save previous entry if duration > threshold
				const ce = this.currentEntry;
				const durationMs = ce.endTime.getTime() - ce.startTime.getTime();
				
				// Check if duration is at least 5 seconds and not a duplicate
				if (durationMs >= this.MIN_DURATION_MS) {
					ce.duration = durationMs / 1000;
					
					// Check for duplicates before adding
					if (this.isDuplicateEntry(ce)) {
						emitRendererLog('[TimeTracker] Skipping duplicate entry', { app: ce.appname, title: ce.apptitle, duration: ce.duration });
					} else {
						emitRendererLog('[TimeTracker] Pushing entry', { app: ce.appname, title: ce.apptitle, duration: ce.duration });
						this.entries.push(ce);
						emitRendererLog('[TimeTracker] Total entries in memory', { count: this.entries.length });
					}
				} else {
					emitRendererLog('[TimeTracker] Skipping short entry (< 5s)', { app: ce.appname, title: ce.apptitle, duration: durationMs / 1000 });
				}

				// Create new entry for the new window
				this.currentEntry = {
					apptitle: activeWindow?.title || "Unknown",
					appname: activeWindow?.owner.name || "Unknown",
					startTime: now,
					endTime: now,
					duration: 0,
				};
				emitRendererLog('[TimeTracker] Switched to new entry', { title: this.currentEntry.apptitle, app: this.currentEntry.appname });
			}
		}, intervalMs);
	}

	public async sendTrackingData(): Promise<void> {
		await this.autoSync();
	}

	public async saveTrackingData(): Promise<void> {
		if (this.entries.length > 0) {
			await this.storage.appendEntries(this.entries);
			emitRendererLog('[TimeTracker] Manually saved entries to local storage', { count: this.entries.length });
			this.entries = [];
		}
	}

	public async isStorageEmpty(): Promise<boolean> {
		return await this.storage.isEmpty();
	}

	public async readStoredEntries(): Promise<TimeEntry[]> {
		return await this.storage.readEntries();
	}

	public async clearStorage(): Promise<void> {
		await this.storage.clearFile();
	}

	public async stopTracking(): Promise<void> {
		emitRendererLog('[TimeTracker] Stopping tracking');
		if (this.trackingInterval) {
			clearInterval(this.trackingInterval);
			this.trackingInterval = null;
		}
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
		}
		// Stop the system resource monitor
		this.sm.stopMonitoring();
		emitRendererLog('[TimeTracker] System resource monitor stopped');
		
		if (this.currentEntry) {
			// Update endTime and calculate duration before pushing
			this.currentEntry.endTime = new Date();
			if (this.currentEntry.startTime && this.currentEntry.endTime) {
				const durationMs = this.currentEntry.endTime.getTime() - this.currentEntry.startTime.getTime();
				this.currentEntry.duration = durationMs / 1000;
				// Only push if duration is at least 5 seconds and not a duplicate
				const isDuplicate = this.isDuplicateEntry(this.currentEntry);
				if (durationMs >= this.MIN_DURATION_MS && !isDuplicate) {
					emitRendererLog('[TimeTracker] Final entry on stop', { app: this.currentEntry.appname, title: this.currentEntry.apptitle, duration: this.currentEntry.duration });
					this.entries.push(this.currentEntry);
				}
			}
			this.currentEntry = null;
		}
		// Aggregate and emit a summary for UI instead of printing each entry
		try {
			this.aggregateSummary();
			// summary already emitted inside aggregateSummary
		} catch (err) {
			emitRendererLog('[TimeTracker] Summary generation failed', { error: String(err) });
		}

		if (this.entries.length > 0) {
			await this.saveTrackingData();
		}
		// mark stopped
		this._running = false;
		emitRendererLog('[TimeTracker] Tracking stopped');
	}

	public async printEntries() {
		for (const entry of this.entries) {
			emitRendererLog('[TimeTracker] Entry', { app: entry.appname, title: entry.apptitle, start: entry.startTime?.toISOString(), end: entry.endTime?.toISOString(), duration: entry.duration });
		}
	}

	/**
	 * Aggregate total time spent per unique app/title key and return an array
	 * Each item: { key: string, seconds: number, pretty: string }
	 */
	public aggregateSummary() {
		const map = new Map<string, number>();
		// include persisted in-memory entries and any currentEntry
		const allEntries: TimeEntry[] = [];
		if (this.entries?.length) allEntries.push(...this.entries);
		if (this.currentEntry) {
			// ensure currentEntry has computed duration
			const ce = this.currentEntry;
			if (ce.startTime && ce.endTime) {
				ce.duration = (ce.endTime.getTime() - ce.startTime.getTime()) / 1000;
			}
			allEntries.push(ce);
		}

		for (const e of allEntries) {
			const app = e.appname || 'Unknown App';
			const title = e.apptitle || 'Unknown Title';
			const key = `${app} :: ${title}`;
			const seconds = typeof e.duration === 'number' ? e.duration : 0;
			map.set(key, (map.get(key) || 0) + seconds);
		}

		const out = Array.from(map.entries()).map(([key, seconds]) => ({ key, seconds, pretty: TimeTracker.formatSeconds(seconds) }));
		emitRendererLog('[TimeTracker] Summary', { summary: out });
		return out;
	}

	private static formatSeconds(sec: number) {
		const s = Math.max(0, Math.floor(sec));
		const hh = Math.floor(s / 3600);
		const mm = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		const pad = (v: number) => String(v).padStart(2, '0');
		return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
	}

	public async manualAdd(entry: TimeEntry) {
		// For future use: manually add an entry to storage
		this.entries.push(entry);
	}
}


if (process.env.NODE_ENV !== 'test') {
	const monitor = new SystemResourceMonitor();
	const tracker = new TimeTracker(monitor);

	ipcMain.handle("getCurrentWindow", () => {
		return monitor.getCurrentWindowInfo();
	});
	ipcMain.handle("getCurrentWindow:start", () => {
		monitor.startMonitoring();
	});
	ipcMain.handle("getCurrentWindow:stop", () => {
		monitor.stopMonitoring();
	});

	ipcMain.handle('TimeTracker:start', async (event, usr: string, proj: string, task: string, intervalMs?: number) => {
		console.log('[IPC] TimeTracker:start called with:', { usr, proj, task, intervalMs });
		emitRendererLog('[IPC] TimeTracker:start called', { usr, proj, task, intervalMs });
		// Normalize IDs to primitive strings
		const userId = usr?.toString();
		const projectId = proj?.toString();
		const taskId = task?.toString();
		try {
			tracker.startTracking(userId, projectId, taskId, intervalMs ?? 200);
			console.log('[IPC] TimeTracker:start completed');
			emitRendererLog('[IPC] TimeTracker:start completed');
			return { ok: true };
		} catch (err) {
			console.error('[IPC] TimeTracker:start failed', err);
			emitRendererLog('[IPC] TimeTracker:start failed', { error: String(err) });
			return { ok: false, error: String(err) };
		}
	});

	ipcMain.handle('TimeTracker:stop', async () => {
		console.log('[IPC] TimeTracker:stop called');
		emitRendererLog('[IPC] TimeTracker:stop called');
		await tracker.stopTracking();
		console.log('[IPC] TimeTracker:stop completed');
		emitRendererLog('[IPC] TimeTracker:stop completed');
	});
	ipcMain.handle('TimeTracker:sendData', async () => {
		console.log('[IPC] TimeTracker:sendData called');
		emitRendererLog('[IPC] TimeTracker:sendData called');
		await tracker.sendTrackingData();
		console.log('[IPC] TimeTracker:sendData completed');
		emitRendererLog('[IPC] TimeTracker:sendData completed');
	});
	// Provide a simple status endpoint for debugging
	ipcMain.handle('TimeTracker:status', async () => {
		try {
			return {
				running: !!(tracker as any)?._running,
				entriesInMemory: (tracker as any)?.entries?.length ?? 0,
			};
		} catch (err) {
			return { running: false, error: String(err) };
		}
	});
	ipcMain.handle('TimeTracker:saveData', async () => {
		await tracker.saveTrackingData();
		emitRendererLog('[IPC] TimeTracker:saveData called');
	});
	ipcMain.handle('TimeTracker:printEntries', () => {
		tracker.printEntries();
		emitRendererLog('[IPC] TimeTracker:printEntries called');
	});
	ipcMain.handle('TimeTracker:isStorageEmpty', async () => {
		return await tracker.isStorageEmpty();
	});
	ipcMain.handle('TimeTracker:readStoredEntries', async () => {
		return await tracker.readStoredEntries();
	});
	ipcMain.handle('TimeTracker:clearStorage', async () => {
		await tracker.clearStorage();
	});

	// Optionally pass JWT token from renderer to main so uploads can authenticate
	ipcMain.handle('TimeTracker:setAuthToken', (event, token: string) => {
		tracker.setAuthToken(token);
	});

	app.on("ready", createWindow);

	app.on("window-all-closed", async () => {
		await tracker.stopTracking();
		monitor.stopMonitoring();
		if (process.platform !== "darwin") app.quit();
	});

	app.on("activate", () => {
		if (mainWindow === null) createWindow();
	});
}
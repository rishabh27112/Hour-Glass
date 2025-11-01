export {};

declare global {
  interface Window {
    getCurrentWinAPI: {
      getActiveWindowInfo: () => Promise<any>;
    };
    TimeTracker: {
      start: () => Promise<{ success: boolean }>;
      stop: () => Promise<{ success: boolean }>;
      sendData: () => Promise<any>;
      saveData: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
      getEntries: () => Promise<any[]>;
      getCurrentEntry: () => Promise<any>;
      getStats: () => Promise<{
        totalEntries: number;
        totalTime: number;
        appStats: { [key: string]: number };
      }>;
      clearEntries: () => Promise<{ success: boolean }>;
    };
  }
}

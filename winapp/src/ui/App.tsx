import { useEffect, useState } from "react";
interface TimeEntry {
  apptitle: string;
  appname: string;
  startTime: Date;
  endTime: Date;
  duration: number;
}

declare global {
  interface Window {
    TimeTracker: {
      start: (usr:string, proj:string, task:string) => Promise<void>;
      stop: () => Promise<void>;
      sendData: () => Promise<void>;
      saveData: () => Promise<void>;
      isStorageEmpty: () => Promise<boolean>;
      readStoredEntries: () => Promise<TimeEntry[]>;
      clearStorage: () => Promise<void>;
    };
    getCurrentWinAPI: {
        getCurrentWindow: () => Promise<{
          title: string;
          owner: { name: string };
        }>;
        start: () => Promise<void>;
        stop: () => Promise<void>;
    };
  }
}

function App() {
  const [activeWindow, setActiveWindow] = useState("Loading...");

  useEffect(() => {
    window.TimeTracker.start("64a7b2f4f1c2e3d4b5a6c7d8","64a7b2f4f1c2e3d4b5a6c7d9","64a7b2f4f1c2e3d4b5a6c7da");
    window.getCurrentWinAPI.start();
    const interval = setInterval(async () => {
      const title = await window.getCurrentWinAPI.getCurrentWindow().then(info => info.title)  .catch(() => "No active window");
      setActiveWindow(title || "No active window");
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px", fontSize: "18px" }}>
      <h1>Active Window Tracker</h1>
      <p>Currently Active Window:</p>
      <strong>{activeWindow}</strong>
    </div>
  );
}

export default App;
import { useEffect, useState } from "react";

declare global {
  interface Window {
    TimeTracker: {
      start: () => Promise<void>;
      stop: () => Promise<void>;
      sendData: () => Promise<void>;
      saveData: () => Promise<void>;
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
    window.TimeTracker.start();
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
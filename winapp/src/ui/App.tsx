import { useEffect, useState } from "react";

function App() {
  const [activeWindow, setActiveWindow] = useState("Loading...");

  useEffect(() => {
    // Polling every 100 ms
    const interval = setInterval(async () => {
      const title = await window.getCurrentWinAPI.getActiveWindowInfo();
      setActiveWindow(title || "No active window");
    }, 100);

    return () => clearInterval(interval); // cleanup when component unmounts
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
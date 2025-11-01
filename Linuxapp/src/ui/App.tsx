import { useEffect, useState } from "react";
import "./global.d.ts";

function App() {
  const [activeWindow, setActiveWindow] = useState("Loading...");

  useEffect(() => {
    // Polling every 100 ms
    const interval = setInterval(async () => {
      const windowInfo = await window.getCurrentWinAPI.getActiveWindowInfo();
      if (windowInfo && windowInfo.title) {
        setActiveWindow(`${windowInfo.owner.name} - ${windowInfo.title}`);
      } else {
        setActiveWindow("No active window detected (Requires X11)");
      }
    }, 100);

    return () => clearInterval(interval); // cleanup when component unmounts
  }, []);

  return (
    <div style={{ padding: "20px", fontSize: "18px" }}>
      <h1>Active Window Tracker (Linux)</h1>
      <p>Currently Active Window:</p>
      <strong>{activeWindow}</strong>
      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <p>📋 Requirements:</p>
        <ul>
          <li>X11 session (not Wayland)</li>
          <li>xdotool installed</li>
        </ul>
        <p>Run <code>./setup-check.sh</code> to verify your system</p>
      </div>
    </div>
  );
}

export default App;

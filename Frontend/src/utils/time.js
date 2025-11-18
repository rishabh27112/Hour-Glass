// Shared time formatting utilities

// Format seconds to "Xh Ym" (no seconds)
export function formatSecondsHm(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

// Format seconds to zero-padded HH:MM:SS (keep for any remaining uses)
export function formatSecondsHms(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(r)}`;
}

// Format decimal hours to "Xh Ym"
export function formatHoursHm(hours) {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

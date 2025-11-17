/**
 * Normalizes an application name for consistent lookups.
 * 1. Converts to lowercase.
 * 2. Removes the .exe extension.
 * 3. Removes common paths, focusing on the app name.
 */
export function normalizeAppName(appName) {
  if (!appName) return 'unknown';

  // Get just the executable/app name from a path
  const app = appName.split('\\').pop().split('/').pop();

  return app.toLowerCase().replace('.exe', '').trim();
}

import { jest } from '@jest/globals';
import { normalizeAppName } from '../../utils/nameNormalizer.js';

describe('Utils - normalizeAppName', () => {
  const testCases = [
    { input: 'notepad.exe', expected: 'notepad', description: 'should remove .exe extension' },
    { input: 'C:\\Windows\\System32\\notepad.exe', expected: 'notepad', description: 'should handle Windows paths' },
    { input: '/usr/bin/code', expected: 'code', description: 'should handle Linux/macOS paths' },
    { input: 'C:/Users/Test/AppData/Local/slack.exe', expected: 'slack', description: 'should handle mixed separators' },
    { input: 'Code.exe', expected: 'code', description: 'should convert to lowercase' },
    { input: '  Spotify.exe  ', expected: 'spotify', description: 'should trim whitespace' },
    { input: 'zoom', expected: 'zoom', description: 'should handle names without extensions or paths' },
    { input: null, expected: 'unknown', description: 'should return "unknown" for null input' },
    { input: undefined, expected: 'unknown', description: 'should return "unknown" for undefined input' },
      { input: '', expected: 'unknown', description: 'should handle empty string input' },
    { input: 'app-with-dashes.exe', expected: 'app-with-dashes', description: 'should handle hyphens' },
    { input: 'app_with_underscores.exe', expected: 'app_with_underscores', description: 'should handle underscores' },
    { input: 'app.1.2.3.exe', expected: 'app.1.2.3', description: 'should handle version numbers' },
  ];

  testCases.forEach(({ input, expected, description }) => {
    test(description, () => {
      expect(normalizeAppName(input)).toBe(expected);
    });
  });
});

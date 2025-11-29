

// src/pages/__tests__/TaskPage.test.jsx
import { formatMs } from '../TaskPage';


// src/pages/__tests__/TaskPage.test.jsx
describe('formatMs() formatMs method', () => {
  // Happy path tests
  describe('Happy paths', () => {
    test('should format milliseconds correctly for a full hour', () => {
      // 1 hour = 3600000 milliseconds
      const ms = 3600000;
      const result = formatMs(ms);
      expect(result).toBe('01:00:00');
    });

    test('should format milliseconds correctly for multiple hours', () => {
      // 2 hours = 7200000 milliseconds
      const ms = 7200000;
      const result = formatMs(ms);
      expect(result).toBe('02:00:00');
    });

    test('should format milliseconds correctly for minutes and seconds', () => {
      // 1 hour, 30 minutes, and 45 seconds = 5445000 milliseconds
      const ms = 5445000;
      const result = formatMs(ms);
      expect(result).toBe('01:30:45');
    });

    test('should format milliseconds correctly for less than a minute', () => {
      // 45 seconds = 45000 milliseconds
      const ms = 45000;
      const result = formatMs(ms);
      expect(result).toBe('00:00:45');
    });
  });

  // Edge case tests
  describe('Edge cases', () => {
    test('should handle zero milliseconds correctly', () => {
      const ms = 0;
      const result = formatMs(ms);
      expect(result).toBe('00:00:00');
    });

    test('should handle negative milliseconds by returning zero time', () => {
      const ms = -1000;
      const result = formatMs(ms);
      expect(result).toBe('00:00:00');
    });

    test('should handle milliseconds that result in exactly one second', () => {
      const ms = 1000;
      const result = formatMs(ms);
      expect(result).toBe('00:00:01');
    });

    test('should handle milliseconds that result in exactly one minute', () => {
      const ms = 60000;
      const result = formatMs(ms);
      expect(result).toBe('00:01:00');
    });

    test('should handle milliseconds that result in exactly one hour', () => {
      const ms = 3600000;
      const result = formatMs(ms);
      expect(result).toBe('01:00:00');
    });
  });
});
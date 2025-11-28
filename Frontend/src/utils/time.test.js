import { formatSecondsHm, formatSecondsHms, formatHoursHm } from './time';

describe('Time Utilities', () => {
  describe('formatSecondsHm', () => {
    it('should format 0 seconds correctly', () => {
      expect(formatSecondsHm(0)).toBe('0h 0m');
    });

    it('should format seconds only', () => {
      expect(formatSecondsHm(45)).toBe('0h 0m');
    });

    it('should format minutes correctly', () => {
      expect(formatSecondsHm(60)).toBe('0h 1m');
      expect(formatSecondsHm(300)).toBe('0h 5m');
      expect(formatSecondsHm(3540)).toBe('0h 59m');
    });

    it('should format hours correctly', () => {
      expect(formatSecondsHm(3600)).toBe('1h 0m');
      expect(formatSecondsHm(7200)).toBe('2h 0m');
    });

    it('should format hours and minutes correctly', () => {
      expect(formatSecondsHm(3660)).toBe('1h 1m');
      expect(formatSecondsHm(5400)).toBe('1h 30m');
      expect(formatSecondsHm(7380)).toBe('2h 3m');
    });

    it('should handle negative numbers by treating them as 0', () => {
      expect(formatSecondsHm(-100)).toBe('0h 0m');
    });

    it('should handle invalid input', () => {
      expect(formatSecondsHm(null)).toBe('0h 0m');
      expect(formatSecondsHm(undefined)).toBe('0h 0m');
      expect(formatSecondsHm('invalid')).toBe('0h 0m');
    });

    it('should handle decimal numbers by flooring', () => {
      expect(formatSecondsHm(3660.7)).toBe('1h 1m');
    });
  });

  describe('formatSecondsHms', () => {
    it('should format 0 seconds correctly', () => {
      expect(formatSecondsHms(0)).toBe('00:00:00');
    });

    it('should format seconds only', () => {
      expect(formatSecondsHms(45)).toBe('00:00:45');
    });

    it('should format minutes correctly', () => {
      expect(formatSecondsHms(60)).toBe('00:01:00');
      expect(formatSecondsHms(300)).toBe('00:05:00');
    });

    it('should format hours correctly', () => {
      expect(formatSecondsHms(3600)).toBe('01:00:00');
      expect(formatSecondsHms(7200)).toBe('02:00:00');
    });

    it('should format hours, minutes, and seconds correctly', () => {
      expect(formatSecondsHms(3661)).toBe('01:01:01');
      expect(formatSecondsHms(5432)).toBe('01:30:32');
      expect(formatSecondsHms(7383)).toBe('02:03:03');
    });

    it('should pad single digits with zero', () => {
      expect(formatSecondsHms(3605)).toBe('01:00:05');
      expect(formatSecondsHms(65)).toBe('00:01:05');
    });

    it('should handle negative numbers by treating them as 0', () => {
      expect(formatSecondsHms(-100)).toBe('00:00:00');
    });

    it('should handle invalid input', () => {
      expect(formatSecondsHms(null)).toBe('00:00:00');
      expect(formatSecondsHms(undefined)).toBe('00:00:00');
      expect(formatSecondsHms('invalid')).toBe('00:00:00');
    });
  });

  describe('formatHoursHm', () => {
    it('should format 0 hours correctly', () => {
      expect(formatHoursHm(0)).toBe('0h 0m');
    });

    it('should format fractional hours correctly', () => {
      expect(formatHoursHm(1.5)).toBe('1h 30m');
      expect(formatHoursHm(2.25)).toBe('2h 15m');
      expect(formatHoursHm(0.5)).toBe('0h 30m');
    });

    it('should format whole hours correctly', () => {
      expect(formatHoursHm(1)).toBe('1h 0m');
      expect(formatHoursHm(5)).toBe('5h 0m');
    });

    it('should round minutes correctly', () => {
      expect(formatHoursHm(1.51)).toBe('1h 31m'); // 1.51 * 60 = 90.6 minutes, rounds to 91
      expect(formatHoursHm(2.49)).toBe('2h 29m'); // 2.49 * 60 = 149.4 minutes, rounds to 149
    });

    it('should handle negative numbers by treating them as 0', () => {
      expect(formatHoursHm(-1.5)).toBe('0h 0m');
    });

    it('should handle invalid input', () => {
      expect(formatHoursHm(null)).toBe('0h 0m');
      expect(formatHoursHm(undefined)).toBe('0h 0m');
      expect(formatHoursHm('invalid')).toBe('0h 0m');
    });

    it('should handle large numbers correctly', () => {
      expect(formatHoursHm(100)).toBe('100h 0m');
    });
  });
});

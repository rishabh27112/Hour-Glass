import { jest } from '@jest/globals';

// In-memory store for classification rules
let mockRuleStore = {};

// Mock the model before all imports
await jest.unstable_mockModule('../../models/classificationRule.model.js', () => ({
  default: {
    findOne: jest.fn(async ({ appName }) => mockRuleStore[appName] || null),
  },
}));

// Now, import the service and the mocked model
const { classifyActivity } = await import('../../services/classificationService.js');
const { normalizeAppName } = await import('../../utils/nameNormalizer.js');
const { default: ClassificationRule } = await import('../../models/classificationRule.model.js');

describe('Classification Service', () => {
  beforeEach(() => {
    // Reset store and mock call history before each test
    mockRuleStore = {};
    ClassificationRule.findOne.mockClear();
    // Restore the default mock implementation before each test
    ClassificationRule.findOne.mockImplementation(async ({ appName }) => mockRuleStore[appName] || null);
  });

  // --- 1. Tests for classifyActivity ---
  describe('classifyActivity', () => {
    // --- 1a. Database Rule Found ---
    describe('when a database rule exists', () => {
      test('should return "billable" for a billable rule', async () => {
        mockRuleStore['vscode'] = { classification: 'billable' };
        const result = await classifyActivity({ appname: 'vscode.exe' });
        expect(result).toBe('billable');
        expect(ClassificationRule.findOne).toHaveBeenCalledWith({ appName: 'vscode' });
      });

      test('should return "non-billable" for a non-billable rule', async () => {
        mockRuleStore['spotify'] = { classification: 'non-billable' };
        const result = await classifyActivity({ appname: 'Spotify.exe' });
        expect(result).toBe('non-billable');
      });

      test('should call AI (and default) for an "ambiguous" rule', async () => {
        mockRuleStore['chrome'] = { classification: 'ambiguous' };
        const result = await classifyActivity({ appname: 'chrome.exe', apptitle: 'Google Docs' });
        // Since AI is disabled, it falls back to the default 'non-billable'
        expect(result).toBe('non-billable');
      });
    });

    // --- 1b. No Database Rule ---
    describe('when no database rule exists', () => {
      test('should call AI (and default) for an unknown app', async () => {
        const result = await classifyActivity({ appname: 'new-app.exe', apptitle: 'A New App' });
        expect(result).toBe('non-billable');
        expect(ClassificationRule.findOne).toHaveBeenCalledWith({ appName: 'new-app' });
      });
    });

    // --- 1c. Input Variations ---
    describe('with various inputs', () => {
      test('should return "ambiguous" for null activity', async () => {
        const result = await classifyActivity(null);
        expect(result).toBe('ambiguous');
        expect(ClassificationRule.findOne).not.toHaveBeenCalled();
      });

      test('should return "ambiguous" for undefined activity', async () => {
        const result = await classifyActivity(undefined);
        expect(result).toBe('ambiguous');
        expect(ClassificationRule.findOne).not.toHaveBeenCalled();
      });
      
      test('should return "non-billable" for an empty activity object', async () => {
        const result = await classifyActivity({});
        expect(result).toBe('non-billable');
      });

      test('should use apptitle for normalization if appname is missing', async () => {
        mockRuleStore['slack'] = { classification: 'billable' };
        const result = await classifyActivity({ apptitle: 'Slack' });
        expect(result).toBe('billable');
        expect(ClassificationRule.findOne).toHaveBeenCalledWith({ appName: 'slack' });
      });
      
      test('should prioritize appname over apptitle', async () => {
        mockRuleStore['code'] = { classification: 'billable' };
        const result = await classifyActivity({ appname: 'code.exe', apptitle: 'Spotify' });
        expect(result).toBe('billable');
        expect(ClassificationRule.findOne).toHaveBeenCalledWith({ appName: 'code' });
      });
    });

    // --- 1d. Error Handling ---
    describe('with database errors', () => {
      test('should return "non-billable" when findOne throws an error', async () => {
        // Temporarily mock the implementation to throw an error for this test
        ClassificationRule.findOne.mockImplementation(async () => {
          throw new Error('DB connection failed');
        });
        
        const result = await classifyActivity({ appname: 'any-app.exe' });
        
        // The service should catch the error and return 'non-billable'
        expect(result).toBe('non-billable');
        
        // The mock will be reset for the next test by the beforeEach block
      });
    });
    
    // --- 1e. Real-world App Names ---
    describe('with real-world application names', () => {
      const commonApps = [
        { name: 'Visual Studio Code', app: 'C:\\Program Files\\Microsoft VS Code\\Code.exe', rule: 'billable' },
        { name: 'Slack', app: 'slack.exe', rule: 'billable' },
        { name: 'Microsoft Teams', app: 'Teams.exe', rule: 'billable' },
        { name: 'Zoom', app: 'Zoom.exe', rule: 'billable' },
        { name: 'Google Chrome', app: 'chrome.exe', rule: 'ambiguous' },
        { name: 'Firefox', app: 'firefox.exe', rule: 'ambiguous' },
        { name: 'Spotify', app: 'Spotify.exe', rule: 'non-billable' },
        { name: 'Discord', app: 'Discord.exe', rule: 'non-billable' },
        { name: 'Figma', app: 'Figma.exe', rule: 'billable' },
        { name: 'Postman', app: 'Postman.exe', rule: 'billable' },
        { name: 'Outlook', app: 'OUTLOOK.EXE', rule: 'billable' },
        { name: 'Terminal', app: '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal', rule: 'billable' },
        { name: 'Docker Desktop', app: 'Docker Desktop.exe', rule: 'billable' },
        { name: 'Microsoft Word', app: 'WINWORD.EXE', rule: 'billable' },
        { name: 'Excel', app: 'EXCEL.EXE', rule: 'billable' },
        { name: 'PowerPoint', app: 'POWERPNT.EXE', rule: 'billable' },
        { name: 'Adobe Photoshop', app: 'Photoshop.exe', rule: 'billable' },
        { name: 'GitHub Desktop', app: 'GitHubDesktop.exe', rule: 'billable' },
        { name: 'Trello', app: 'Trello.exe', rule: 'billable' },
        { name: 'Jira', app: 'Jira.exe', rule: 'billable' },
        { name: 'Notion', app: 'Notion.exe', rule: 'billable' },
        { name: 'Evernote', app: 'Evernote.exe', rule: 'billable' },
        { name: 'OneNote', app: 'ONENOTE.EXE', rule: 'billable' },
        { name: 'Calculator', app: 'calc.exe', rule: 'non-billable' },
        { name: 'Steam', app: 'steam.exe', rule: 'non-billable' },
        { name: 'Netflix', app: 'netflix.exe', rule: 'non-billable' },
        { name: 'WhatsApp', app: 'WhatsApp.exe', rule: 'non-billable' },
        { name: 'Telegram', app: 'Telegram.exe', rule: 'non-billable' },
      ];

      commonApps.forEach(({ name, app, rule }) => {
        test(`should classify ${name} correctly`, async () => {
          const normalized = normalizeAppName(app);
          mockRuleStore[normalized] = { classification: rule };
          
          const result = await classifyActivity({ appname: app, apptitle: name });
          
          if (rule === 'ambiguous') {
            // AI is disabled, so it should default to non-billable
            expect(result).toBe('non-billable');
          } else {
            expect(result).toBe(rule);
          }
        });
      });
    });
  });
});

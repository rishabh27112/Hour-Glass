import { classifyBrainstormEntry } from '../../services/brainstormService.js';
import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../models/ProjectModel.js', () => ({
  default: {
    findById: jest.fn()
  }
}));

const { default: Project } = await import('../../models/ProjectModel.js');

global.fetch = jest.fn();

describe('Brainstorm Service - classifyBrainstormEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
  });

  test('should return ambiguous when no GROQ key', async () => {
    delete process.env.GROQ_API_KEY;
    const res = await classifyBrainstormEntry({ description: 'Some task' });
    expect(res.classification).toBe('ambiguous');
  });

  test('should handle project fetch and call Groq', async () => {
    const mockProject = { _id: 'proj-123', ProjectName: 'X', Description: 'Y', tasks: [] };
    Project.findById.mockResolvedValue(mockProject);

    const mockGroqResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ classification: 'billable', confidence: 0.9 })
          }
        }]
      })
    };
    fetch.mockResolvedValue(mockGroqResponse);

    const res = await classifyBrainstormEntry({ projectId: 'proj-123', description: 'Build dashboard' });
    expect(res.classification).toBeDefined();
  });

  test('should clamp confidence between 0 and 1', async () => {
    Project.findById.mockResolvedValue(null);

    const mockGroqResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ classification: 'billable', confidence: 1.5 })
          }
        }]
      })
    };
    fetch.mockResolvedValue(mockGroqResponse);

    const res = await classifyBrainstormEntry({ description: 'Test' });
    expect(res.confidence).toBeLessThanOrEqual(1);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
  });

  test('should handle API errors gracefully', async () => {
    Project.findById.mockResolvedValue(null);
    fetch.mockRejectedValue(new Error('Network error'));

    const res = await classifyBrainstormEntry({ description: 'Test' });
    expect(res.classification).toBe('ambiguous');
  });
});

describe('Brainstorm Service - classifyBrainstormEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
  });

  test('should return ambiguous when no GROQ key', async () => {
    delete process.env.GROQ_API_KEY;
    const res = await classifyBrainstormEntry({ description: 'Some task' });
    expect(res.classification).toBe('ambiguous');
  });

  test('should handle project fetch and call Groq', async () => {
    const mockProject = { _id: 'proj-123', ProjectName: 'X', Description: 'Y', tasks: [] };
    Project.findById.mockResolvedValue(mockProject);

    const mockGroqResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ classification: 'billable', confidence: 0.9 })
          }
        }]
      })
    };
    fetch.mockResolvedValue(mockGroqResponse);

    const res = await classifyBrainstormEntry({ projectId: 'proj-123', description: 'Build dashboard' });
    expect(res.classification).toBeDefined();
  });

  test('should clamp confidence between 0 and 1', async () => {
    Project.findById.mockResolvedValue(null);

    const mockGroqResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ classification: 'billable', confidence: 1.5 })
          }
        }]
      })
    };
    fetch.mockResolvedValue(mockGroqResponse);

    const res = await classifyBrainstormEntry({ description: 'Test' });
    expect(res.confidence).toBeLessThanOrEqual(1);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
  });

  test('should handle API errors gracefully', async () => {
    Project.findById.mockResolvedValue(null);
    fetch.mockRejectedValue(new Error('Network error'));

    const res = await classifyBrainstormEntry({ description: 'Test' });
    expect(res.classification).toBe('ambiguous');
  });
});

// Mock fetch globally
global.fetch = jest.fn();

describe('Brainstorm Service - classifyBrainstormEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    // Mock environment variable
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
  });

  // ===== Success Cases =====
  describe('Successful Classification', () => {
    it('should classify as billable when description aligns with project', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Client Dashboard',
        Description: 'Build interactive dashboard for client',
        tasks: [{
          _id: 'task-123',
          description: 'Implement authentication module',
          title: 'Auth Module'
        }]
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.95
REASONING: Directly contributes to authentication task mentioned in project goals.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Implementing OAuth2 authentication flow for secure login',
        'proj-123',
        'task-123'
      );

      expect(result.classification).toBe('billable');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reasoning).toBeTruthy();
      expect(fetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should classify as non-billable for general learning', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Client Dashboard',
        Description: 'Build interactive dashboard',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: non-billable
CONFIDENCE: 0.88
REASONING: General learning unrelated to current project scope.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Exploring advanced TypeScript generics for personal skill development',
        'proj-123',
        null
      );

      expect(result.classification).toBe('non-billable');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should parse confidence correctly', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.72
REASONING: Some confidence level.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.confidence).toBe(0.72);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should clamp confidence between 0 and 1', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 1.95
REASONING: Invalid confidence should be clamped.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== Error Cases =====
  describe('Error Handling', () => {
    it('should return ambiguous when no GROQ_API_KEY', async () => {
      delete process.env.GROQ_API_KEY;

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('API key not configured');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return ambiguous on empty description', async () => {
      const result = await classifyBrainstormEntry(
        '',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Empty description');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return ambiguous on whitespace-only description', async () => {
      const result = await classifyBrainstormEntry(
        '   \n\t  ',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.reasoning).toContain('Empty description');
    });

    it('should handle Groq API 400 error', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockErrorResponse = {
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"Invalid model"}}'
      };

      fetch.mockResolvedValue(mockErrorResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('API error');
    });

    it('should handle Groq API network error', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      fetch.mockRejectedValue(new Error('Network timeout'));

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('API error');
    });

    it('should handle missing response from Groq', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: null } }]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.reasoning).toContain('API error');
    });

    it('should handle malformed JSON from Groq', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockResponse = {
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.reasoning).toContain('API error');
    });
  });

  // ===== Edge Cases =====
  describe('Edge Cases', () => {
    it('should handle missing project gracefully', async () => {
      Project.findById.mockResolvedValue(null);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: non-billable
CONFIDENCE: 0.5
REASONING: Project context unavailable.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'invalid-project-id',
        null
      );

      expect(result).toBeDefined();
      expect(result.classification).toBeTruthy();
    });

    it('should handle unparseable response format', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Some random text that is not in expected format'
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Test description',
        'proj-123',
        null
      );

      expect(result.classification).toBe('ambiguous');
      expect(result.confidence).toBe(0.5); // default when not found
    });

    it('should handle very long description', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test Project',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const longDescription = 'This is a very long description. '.repeat(100);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.5
REASONING: Processed long description.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        longDescription,
        'proj-123',
        null
      );

      expect(result.classification).toBe('billable');
      expect(fetch).toHaveBeenCalled();
    });

    it('should pass correct parameters to Groq API', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Client Project',
        Description: 'Build web app',
        tasks: [{
          _id: 'task-456',
          description: 'Implement frontend',
          title: 'Frontend Implementation'
        }]
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.9
REASONING: Good.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      await classifyBrainstormEntry(
        'Building React components',
        'proj-123',
        'task-456'
      );

      const callArgs = fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('llama-3.3-70b-versatile');
      expect(requestBody.messages[0].role).toBe('user');
      expect(requestBody.messages[0].content).toContain('Client Project');
      expect(requestBody.messages[0].content).toContain('Building React components');
      expect(requestBody.temperature).toBe(0.3);
      expect(requestBody.max_tokens).toBe(300);
    });
  });

  // ===== Integration-like Cases =====
  describe('Full Classification Flow', () => {
    it('should classify with all project and task context', async () => {
      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'E-Commerce Platform',
        Description: 'Build full-stack e-commerce with React, Node, MongoDB',
        tasks: [{
          _id: 'task-123',
          description: 'Implement product search functionality',
          title: 'Product Search'
        }]
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.98
REASONING: Directly implements product search task for e-commerce platform - core deliverable.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      const result = await classifyBrainstormEntry(
        'Brainstorming full-text search implementation with Elasticsearch integration',
        'proj-123',
        'task-123'
      );

      expect(result.classification).toBe('billable');
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(fetch).toHaveBeenCalled();
    });

    it('should use environment variable for model selection', async () => {
      process.env.GROQ_MODEL = 'mixtral-8x7b-32768';

      const mockProject = {
        _id: 'proj-123',
        ProjectName: 'Test',
        Description: 'Test',
        tasks: []
      };

      Project.findById.mockResolvedValue(mockProject);

      const mockGroqResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `
CLASSIFICATION: billable
CONFIDENCE: 0.5
REASONING: Test.
              `
            }
          }]
        })
      };

      fetch.mockResolvedValue(mockGroqResponse);

      await classifyBrainstormEntry('Test', 'proj-123', null);

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('mixtral-8x7b-32768');
    });
  });
});

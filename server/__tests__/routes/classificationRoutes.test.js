import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

// In-memory store for users
let mockUserStore = {
  currentUserId: 'test-user-id',
  users: {
    'test-user-id': { _id: 'test-user-id', isAccountVerified: true },
    'unverified-user': { _id: 'unverified-user', isAccountVerified: false }
  }
};

// Mock middleware - always uses current user from store
await jest.unstable_mockModule('../../middleware/userAuth.js', () => ({
  default: (req, res, next) => {
    req.userId = mockUserStore.currentUserId;
    return next();
  }
}));

await jest.unstable_mockModule('../../models/userModel.js', () => ({
  default: {
    findById: (id) => ({
      select: () => Promise.resolve(mockUserStore.users[id] || null)
    })
  }
}));

// In-memory store for classification rules
let classificationStore = { rules: [] };

const mockClassificationRuleModel = {
  find: jest.fn((filter) => {
    const matched = classificationStore.rules.filter(r => {
      if (!filter) return true;
      if (filter.source && r.source !== filter.source) return false;
      if (filter.appName && filter.appName.$regex) {
        return r.appName.toLowerCase().includes(filter.appName.$regex.toLowerCase());
      }
      return true;
    });
    return {
      sort: () => ({ limit: () => ({ exec: async () => matched }) })
    };
  }),
  findOneAndUpdate: jest.fn(async (query, update, options) => {
    const existing = classificationStore.rules.find(r => r.appName === query.appName);
    if (existing) {
      Object.assign(existing, update);
      return existing;
    }
    const created = { appName: query.appName, ...update };
    classificationStore.rules.push(created);
    return created;
  }),
  deleteOne: jest.fn(async (query) => {
    const before = classificationStore.rules.length;
    classificationStore.rules = classificationStore.rules.filter(r => r.appName !== query.appName);
    return { deletedCount: before - classificationStore.rules.length };
  }),
  findOne: jest.fn(async (query) => classificationStore.rules.find(r => r.appName === query.appName) || null)
};

await jest.unstable_mockModule('../../models/classificationRule.model.js', () => ({
  default: mockClassificationRuleModel
}));

// Now import the router after mocks are in place
const { default: classificationRoutes } = await import('../../routes/classificationRoutes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/classification-rules', classificationRoutes);
  return app;
}

describe('Classification Routes', () => {
  beforeEach(() => {
    classificationStore.rules = [
      { appName: 'vscode', classification: 'billable', source: 'manual', notes: 'Code editor' },
      { appName: 'chrome', classification: 'ambiguous', source: 'ai' }
    ];
    mockUserStore.currentUserId = 'test-user-id';
    mockUserStore.users = {
      'test-user-id': { _id: 'test-user-id', isAccountVerified: true },
      'unverified-user': { _id: 'unverified-user', isAccountVerified: false }
    };
  });

  describe('GET /api/classification-rules', () => {
    test('should list all classification rules', async () => {
      const app = createApp();
      const res = await request(app).get('/api/classification-rules');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter rules by source', async () => {
      const app = createApp();
      const res = await request(app).get('/api/classification-rules?source=manual');
      expect(res.status).toBe(200);
      expect(res.body.every(r => r.source === 'manual')).toBe(true);
    });

    test('should return empty array when no rules found', async () => {
      classificationStore.rules = [];
      const app = createApp();
      const res = await request(app).get('/api/classification-rules');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      mockClassificationRuleModel.find.mockImplementationOnce(() => ({
        sort: () => ({ limit: () => ({ exec: () => Promise.reject(new Error('DB Error')) }) })
      }));

      const app = createApp();
      const res = await request(app).get('/api/classification-rules');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/classification-rules/:appName', () => {
    test('should create/update rule when user verified', async () => {
      const app = createApp();
      const payload = { classification: 'non-billable', notes: 'Test note' };
      const res = await request(app).patch('/api/classification-rules/slack').send(payload);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appName', 'slack');
      expect(res.body).toHaveProperty('classification', 'non-billable');
    });

    test('should return 403 when user not verified', async () => {
      mockUserStore.currentUserId = 'unverified-user';
      const app = createApp();
      const res = await request(app).patch('/api/classification-rules/slack').send({ classification: 'billable' });
      expect(res.status).toBe(403);
      mockUserStore.currentUserId = 'test-user-id';
    });

    test('should return 400 for invalid classification', async () => {
      const app = createApp();
      const res = await request(app).patch('/api/classification-rules/slack').send({ classification: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('should return 403 when user not found', async () => {
      const originalUser = mockUserStore.users['test-user-id'];
      delete mockUserStore.users['test-user-id'];
      const app = createApp();
      const res = await request(app).patch('/api/classification-rules/slack').send({ classification: 'billable' });
      expect(res.status).toBe(403);
      mockUserStore.users['test-user-id'] = originalUser;
    });

    test('should handle database errors on update', async () => {
      mockClassificationRuleModel.findOneAndUpdate.mockRejectedValueOnce(new Error('DB Error'));

      const app = createApp();
      const res = await request(app).patch('/api/classification-rules/new-app').send({ classification: 'billable' });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/classification-rules/:appName', () => {
    test('should delete rule when verified', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/classification-rules/vscode');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const findRes = await request(app).get('/api/classification-rules');
      expect(findRes.body.some(r => r.appName === 'vscode')).toBe(false);
    });

    test('should return 403 when user not verified', async () => {
      mockUserStore.currentUserId = 'unverified-user';
      const app = createApp();
      const res = await request(app).delete('/api/classification-rules/vscode');
      expect(res.status).toBe(403);
      mockUserStore.currentUserId = 'test-user-id';
    });

    test('should return 403 when user not found', async () => {
      const originalUser = mockUserStore.users['test-user-id'];
      delete mockUserStore.users['test-user-id'];
      const app = createApp();
      const res = await request(app).delete('/api/classification-rules/vscode');
      expect(res.status).toBe(403);
      mockUserStore.users['test-user-id'] = originalUser;
    });

    test('should succeed even if rule not found', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/classification-rules/nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('should handle database errors on delete', async () => {
      mockClassificationRuleModel.deleteOne.mockRejectedValueOnce(new Error('DB Error'));

      const app = createApp();
      const res = await request(app).delete('/api/classification-rules/some-app');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});

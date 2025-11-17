import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

// Mock middleware and models before importing the router
await jest.unstable_mockModule('../../middleware/userAuth.js', () => ({
  default: (req, res, next) => {
    req.userId = 'test-user-id';
    return next();
  }
}));

// Simple in-memory user store to control returned users
let mockUserStore = {
  users: {
    'test-user-id': { _id: 'test-user-id', isAccountVerified: true },
    'unverified-user': { _id: 'unverified-user', isAccountVerified: false }
  }
};

await jest.unstable_mockModule('../../models/userModel.js', () => ({
  default: {
    findById: (id) => ({ select: () => Promise.resolve(mockUserStore.users[id] || null) })
  }
}));

// Mock ClassificationRule model with chainable find and basic methods
let classificationStore = {
  rules: []
};

await jest.unstable_mockModule('../../models/classificationRule.model.js', () => ({
  default: {
    find: (filter) => {
      const matched = classificationStore.rules.filter(r => {
        if (!filter) return true;
        if (filter.source && r.source !== filter.source) return false;
        if (filter.appName && filter.appName.$regex) return r.appName.toLowerCase().includes(filter.appName.$regex.toLowerCase());
        return true;
      });
      return {
        sort: () => ({ limit: () => ({ exec: async () => matched }) })
      };
    },
    findOneAndUpdate: async (query, update, options) => {
      const existing = classificationStore.rules.find(r => r.appName === query.appName);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const created = { appName: query.appName, ...update };
      classificationStore.rules.push(created);
      return created;
    },
    deleteOne: async (query) => {
      const before = classificationStore.rules.length;
      classificationStore.rules = classificationStore.rules.filter(r => r.appName !== query.appName);
      return { deletedCount: before - classificationStore.rules.length };
    },
    findOne: async (query) => classificationStore.rules.find(r => r.appName === query.appName) || null
  }
}));

// Now import the router after mocks are in place
const { default: classificationRoutes } = await import('../../routes/classificationRoutes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/classification-rules', classificationRoutes);
  return app;
}

describe('Classification Routes (ESM-style mocked imports)', () => {
  beforeEach(() => {
    // reset stores before each test
    classificationStore.rules = [
      { appName: 'vscode', classification: 'billable', source: 'manual', notes: 'Code editor' },
      { appName: 'chrome', classification: 'ambiguous', source: 'ai' }
    ];
    mockUserStore = {
      users: {
        'test-user-id': { _id: 'test-user-id', isAccountVerified: true },
        'unverified-user': { _id: 'unverified-user', isAccountVerified: false }
      }
    };
  });

  test('GET /api/classification-rules returns list', async () => {
    const app = createApp();
    const res = await request(app).get('/api/classification-rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test('GET with source filter', async () => {
    const app = createApp();
    const res = await request(app).get('/api/classification-rules?source=manual');
    expect(res.status).toBe(200);
    expect(res.body.every(r => r.source === 'manual')).toBe(true);
  });

  test('PATCH creates/updates rule when user verified', async () => {
    const app = createApp();
    const payload = { classification: 'non-billable', notes: 'Test note' };
    const res = await request(app).patch('/api/classification-rules/slack').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('appName', 'slack');
    expect(res.body).toHaveProperty('classification', 'non-billable');
  });

  test('PATCH returns 403 when user not verified', async () => {
    // make auth middleware set an unverified user
    await jest.unstable_mockModule('../../middleware/userAuth.js', () => ({
      default: (req, res, next) => { req.userId = 'unverified-user'; return next(); }
    }));
    // re-import router to pick up new auth mock
    const { default: router } = await import('../../routes/classificationRoutes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/classification-rules', router);

    const res = await request(app).patch('/api/classification-rules/slack').send({ classification: 'billable' });
    expect(res.status).toBe(403);
  });

  test('DELETE removes rule when verified', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/classification-rules/vscode');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // ensure rule removed from store
    const findRes = await request(app).get('/api/classification-rules');
    expect(findRes.body.some(r => r.appName === 'vscode')).toBe(false);
  });
});

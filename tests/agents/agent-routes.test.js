import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAgentRouter } from '../../server/agents/agent-routes.js';
import { AgentManager } from '../../server/agents/agent-manager.js';
import { TaskManager } from '../../server/agents/task-manager.js';
import { AgentSessionManager } from '../../server/agents/session-manager.js';

vi.mock('../../server/providers/index.js', () => ({
  getProvider: vi.fn(() => ({
    query: vi.fn(async function* () {
      yield { type: 'text', content: 'test response' };
    }),
    abort: vi.fn(() => true)
  }))
}));

function createApp() {
  const am = new AgentManager();
  const tm = new TaskManager();
  const sm = new AgentSessionManager(am);
  const app = express();
  app.use(express.json());
  app.use('/api/agents', createAgentRouter(am, tm, sm));
  return { app, am, tm, sm };
}

describe('Agent Routes', () => {
  let app, am, tm, sm;

  beforeEach(() => {
    ({ app, am, tm, sm } = createApp());
  });

  describe('POST /api/agents/ask', () => {
    it('returns response from ephemeral agent', async () => {
      const res = await request(app)
        .post('/api/agents/ask')
        .send({ message: 'hello' });
      expect(res.status).toBe(200);
      expect(res.body.response).toBe('test response');
    });

    it('returns 400 without message', async () => {
      const res = await request(app)
        .post('/api/agents/ask')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/agents', () => {
    it('returns empty list', async () => {
      const res = await request(app).get('/api/agents');
      expect(res.status).toBe(200);
      expect(res.body.agents).toEqual([]);
    });

    it('returns agents after creation', async () => {
      am.createAgent({ name: 'test' });
      const res = await request(app).get('/api/agents');
      expect(res.body.agents).toHaveLength(1);
    });
  });

  describe('POST /api/agents', () => {
    it('creates an agent', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({ name: 'worker', provider: 'claude' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('worker');
    });

    it('returns 400 without name', async () => {
      const res = await request(app)
        .post('/api/agents')
        .send({ provider: 'claude' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for duplicate name', async () => {
      am.createAgent({ name: 'dup' });
      const res = await request(app)
        .post('/api/agents')
        .send({ name: 'dup' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for reserved names', async () => {
      for (const name of ['ask', 'tasks', 'sessions']) {
        const res = await request(app)
          .post('/api/agents')
          .send({ name });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('reserved');
      }
    });
  });

  describe('GET /api/agents/:name', () => {
    it('returns agent details', async () => {
      am.createAgent({ name: 'info' });
      const res = await request(app).get('/api/agents/info');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('info');
    });

    it('returns 404 for unknown agent', async () => {
      const res = await request(app).get('/api/agents/missing');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/agents/:name/ask', () => {
    it('returns response from named agent', async () => {
      am.createAgent({ name: 'chat' });
      const res = await request(app)
        .post('/api/agents/chat/ask')
        .send({ message: 'hi' });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    });

    it('returns 404 for unknown agent', async () => {
      const res = await request(app)
        .post('/api/agents/ghost/ask')
        .send({ message: 'hi' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/agents/:name/kill', () => {
    it('kills an agent', async () => {
      am.createAgent({ name: 'victim' });
      const res = await request(app).post('/api/agents/victim/kill');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for unknown agent', async () => {
      const res = await request(app).post('/api/agents/nobody/kill');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/agents/:name/message', () => {
    it('sends direct message between agents', async () => {
      am.createAgent({ name: 'a' });
      am.createAgent({ name: 'b' });
      const res = await request(app)
        .post('/api/agents/a/message')
        .send({ to: 'b', content: 'hello' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('broadcasts when no "to" specified', async () => {
      am.createAgent({ name: 'bc' });
      am.createAgent({ name: 'l1' });
      const res = await request(app)
        .post('/api/agents/bc/message')
        .send({ content: 'everyone' });
      expect(res.status).toBe(200);
      expect(res.body.broadcast).toBe(true);
    });
  });

  describe('Task routes', () => {
    it('GET /api/agents/tasks returns empty', async () => {
      const res = await request(app).get('/api/agents/tasks');
      expect(res.body.tasks).toEqual([]);
    });

    it('POST /api/agents/tasks creates task', async () => {
      const res = await request(app)
        .post('/api/agents/tasks')
        .send({ title: 'Do stuff' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Do stuff');
    });

    it('PATCH /api/agents/tasks/:id updates task', async () => {
      tm.createTask({ title: 'Old' });
      const res = await request(app)
        .patch('/api/agents/tasks/1')
        .send({ title: 'New' });
      expect(res.body.title).toBe('New');
    });

    it('POST /api/agents/tasks/:id/assign assigns task', async () => {
      tm.createTask({ title: 'Work' });
      am.createAgent({ name: 'worker' });
      const res = await request(app)
        .post('/api/agents/tasks/1/assign')
        .send({ agentName: 'worker' });
      expect(res.body.owner).toBe('worker');
    });

    it('DELETE /api/agents/tasks/:id deletes task', async () => {
      tm.createTask({ title: 'Gone' });
      const res = await request(app).delete('/api/agents/tasks/1');
      expect(res.body.success).toBe(true);
    });
  });

  describe('Session routes', () => {
    it('GET /api/agents/sessions returns empty', async () => {
      const res = await request(app).get('/api/agents/sessions');
      expect(res.body.sessions).toEqual([]);
    });

    it('POST /api/agents/sessions creates session', async () => {
      const res = await request(app)
        .post('/api/agents/sessions')
        .send({ name: 'my-session' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('my-session');
    });

    it('POST /api/agents/sessions/:id/agents adds agent', async () => {
      sm.createSession({ name: 's1' });
      const res = await request(app)
        .post('/api/agents/sessions/1/agents')
        .send({ name: 'worker' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('worker');
    });

    it('DELETE /api/agents/sessions/:id closes session', async () => {
      sm.createSession();
      const res = await request(app).delete('/api/agents/sessions/1');
      expect(res.body.success).toBe(true);
    });
  });
});

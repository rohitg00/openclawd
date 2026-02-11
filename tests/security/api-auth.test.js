import { describe, it, expect } from 'vitest';
import express from 'express';
import { createAuthMiddleware } from '../../server/auth-middleware.js';

describe('API auth middleware', () => {
  it('rejects requests without Authorization header with 401', async () => {
    const originalKey = process.env.OPENCLAWD_API_KEY;
    process.env.OPENCLAWD_API_KEY = 'oc_test12345678901234567890123456789012';

    const app = express();
    app.use(createAuthMiddleware());
    app.get('/api/providers', (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/providers`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toContain('Authorization');
    } finally {
      server.close();
      process.env.OPENCLAWD_API_KEY = originalKey;
    }
  });

  it('rejects requests with wrong key with 401', async () => {
    const originalKey = process.env.OPENCLAWD_API_KEY;
    process.env.OPENCLAWD_API_KEY = 'oc_test12345678901234567890123456789012';

    const app = express();
    app.use(createAuthMiddleware());
    app.get('/api/providers', (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/providers`, {
        headers: { Authorization: 'Bearer wrong-key' }
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toContain('Invalid API key');
    } finally {
      server.close();
      process.env.OPENCLAWD_API_KEY = originalKey;
    }
  });

  it('allows requests with correct Bearer token', async () => {
    const originalKey = process.env.OPENCLAWD_API_KEY;
    const validKey = 'oc_test12345678901234567890123456789012';
    process.env.OPENCLAWD_API_KEY = validKey;

    const app = express();
    app.use(createAuthMiddleware());
    app.get('/api/providers', (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/providers`, {
        headers: { Authorization: `Bearer ${validKey}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    } finally {
      server.close();
      process.env.OPENCLAWD_API_KEY = originalKey;
    }
  });

  it('allows /api/health without auth', async () => {
    const originalKey = process.env.OPENCLAWD_API_KEY;
    process.env.OPENCLAWD_API_KEY = 'oc_test12345678901234567890123456789012';

    const app = express();
    app.use(createAuthMiddleware());
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    } finally {
      server.close();
      process.env.OPENCLAWD_API_KEY = originalKey;
    }
  });

  it('passes all requests when no API key is configured', async () => {
    const originalKey = process.env.OPENCLAWD_API_KEY;
    delete process.env.OPENCLAWD_API_KEY;

    const app = express();
    app.use(createAuthMiddleware());
    app.get('/api/providers', (_req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://localhost:${port}/api/providers`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    } finally {
      server.close();
      if (originalKey !== undefined) process.env.OPENCLAWD_API_KEY = originalKey;
    }
  });
});

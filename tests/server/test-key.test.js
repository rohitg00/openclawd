import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createMockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; };
  return res;
}

function createHandler() {
  return async (req, res) => {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ valid: false, error: 'Missing provider or apiKey' });
    }

    const providerConfigs = {
      anthropic: {
        url: 'https://api.anthropic.com/v1/models',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      },
      openai: {
        url: 'https://api.openai.com/v1/models',
        headers: { Authorization: `Bearer ${apiKey}` }
      },
      google: {
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        headers: {}
      }
    };

    const config = providerConfigs[provider];
    if (!config) {
      return res.json({ valid: false, error: 'Unsupported provider for validation' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(config.url, { headers: config.headers, signal: controller.signal });
      if (response.ok) {
        res.json({ valid: true });
      } else {
        const body = await response.text().catch(() => '');
        res.json({ valid: false, error: response.status === 401 ? 'Invalid API key' : `HTTP ${response.status}: ${body.slice(0, 200)}` });
      }
    } catch (err) {
      res.json({ valid: false, error: err.name === 'AbortError' ? 'Request timed out' : err.message });
    } finally {
      clearTimeout(timeout);
    }
  };
}

describe('/api/settings/test-key', () => {
  const handler = createHandler();

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns error when provider is missing', async () => {
    const res = createMockRes();
    await handler({ body: { apiKey: 'test' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toContain('Missing');
  });

  it('returns error when apiKey is missing', async () => {
    const res = createMockRes();
    await handler({ body: { provider: 'anthropic' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  it('validates anthropic key successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const res = createMockRes();
    await handler({ body: { provider: 'anthropic', apiKey: 'sk-ant-test' } }, res);
    expect(res.body.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }) })
    );
  });

  it('validates openai key successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const res = createMockRes();
    await handler({ body: { provider: 'openai', apiKey: 'sk-test' } }, res);
    expect(res.body.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }) })
    );
  });

  it('validates google key successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const res = createMockRes();
    await handler({ body: { provider: 'google', apiKey: 'AItest123' } }, res);
    expect(res.body.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.any(Object)
    );
  });

  it('returns invalid for 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') });
    const res = createMockRes();
    await handler({ body: { provider: 'anthropic', apiKey: 'bad-key' } }, res);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toBe('Invalid API key');
  });

  it('handles network timeout', async () => {
    mockFetch.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const res = createMockRes();
    await handler({ body: { provider: 'openai', apiKey: 'sk-test' } }, res);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toBe('Request timed out');
  });

  it('returns unsupported for unknown providers', async () => {
    const res = createMockRes();
    await handler({ body: { provider: 'unknown', apiKey: 'key' } }, res);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toContain('Unsupported');
  });
});

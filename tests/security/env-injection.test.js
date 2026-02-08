import { describe, it, expect } from 'vitest';
import { loadMcpServers } from '../../server/mcp-loader.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function tmpFile(rawContent) {
  const p = join(tmpdir(), `env-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, rawContent);
  return p;
}

describe('env var injection prevention', () => {
  it('allows ALLOWED_ENV_PREFIXES', () => {
    const prefixes = ['ANTHROPIC_', 'OPENAI_', 'GOOGLE_', 'GROQ_', 'DEEPSEEK_', 'MISTRAL_', 'XAI_', 'VENICE_', 'OPENROUTER_', 'OPENCLAWD_'];
    for (const prefix of prefixes) {
      const envKey = `${prefix}TEST_VAL`;
      process.env[envKey] = 'allowed-value';

      const cfg = tmpFile(JSON.stringify({
        srv: { type: 'http', url: `http://host:$\{${envKey}\}` }
      }));
      const result = loadMcpServers(cfg);
      expect(result.srv.url).toBe('http://host:allowed-value');

      delete process.env[envKey];
      unlinkSync(cfg);
    }
  });

  it('allows GITHUB_TOKEN', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    const cfg = tmpFile(JSON.stringify({
      srv: { type: 'http', url: 'http://host:${GITHUB_TOKEN}' }
    }));
    const result = loadMcpServers(cfg);
    expect(result.srv.url).toBe('http://host:ghp_test123');
    delete process.env.GITHUB_TOKEN;
    unlinkSync(cfg);
  });

  it('allows safe system vars (HOME, PATH, USER)', () => {
    const originalHome = process.env.HOME;
    process.env.HOME = '/home/testuser';

    const cfg = tmpFile(JSON.stringify({
      srv: { type: 'http', url: 'http://host:${HOME}' }
    }));
    const result = loadMcpServers(cfg);
    expect(result.srv.url).toBe('http://host:/home/testuser');

    process.env.HOME = originalHome;
    unlinkSync(cfg);
  });

  it('blocks BLOCKED_ENV_VARS', () => {
    const blocked = ['AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'DATABASE_URL', 'PRIVATE_KEY', 'SSH_KEY', 'SUDO_ASKPASS'];
    for (const envKey of blocked) {
      process.env[envKey] = 'secret-value';

      const cfg = tmpFile(JSON.stringify({
        srv: { type: 'http', url: `http://host:$\{${envKey}\}` }
      }));
      const result = loadMcpServers(cfg);
      expect(result.srv.url).toBe('http://host:');

      delete process.env[envKey];
      unlinkSync(cfg);
    }
  });

  it('blocks vars without allowed prefix', () => {
    process.env.MY_CUSTOM_SECRET = 'secret';
    const cfg = tmpFile(JSON.stringify({
      srv: { type: 'http', url: 'http://host:${MY_CUSTOM_SECRET}' }
    }));
    const result = loadMcpServers(cfg);
    expect(result.srv.url).toBe('http://host:');
    delete process.env.MY_CUSTOM_SECRET;
    unlinkSync(cfg);
  });
});

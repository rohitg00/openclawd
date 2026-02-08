import { describe, it, expect } from 'vitest';
import { loadMcpServers, validateMcpConfig } from '../../server/mcp-loader.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function tmpFile(content) {
  const p = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(content, null, 2));
  return p;
}

describe('validateMcpCommand (via loadMcpServers)', () => {
  it('blocks disallowed commands', () => {
    const cfg = tmpFile({
      bad: { type: 'stdio', command: 'curl', args: [] }
    });
    const result = loadMcpServers(cfg);
    expect(result).toEqual({});
    unlinkSync(cfg);
  });

  it('blocks shell metacharacters in args', () => {
    const chars = [';', '|', '&', '`', '$', '(', ')', '{', '}', '<', '>'];
    for (const ch of chars) {
      const cfg = tmpFile({
        bad: { type: 'stdio', command: 'node', args: [`arg${ch}inject`] }
      });
      const result = loadMcpServers(cfg);
      expect(result).toEqual({});
      unlinkSync(cfg);
    }
  });

  it('allows whitelisted commands', () => {
    const allowed = ['node', 'npx', 'python3', 'python', 'uvx', 'uv', 'docker', 'deno', 'bun', 'bunx'];
    for (const cmd of allowed) {
      const cfg = tmpFile({
        srv: { type: 'stdio', command: cmd, args: ['server.js'] }
      });
      const result = loadMcpServers(cfg);
      expect(result).toHaveProperty('srv');
      expect(result.srv.command).toBe(cmd);
      unlinkSync(cfg);
    }
  });

  it('allows commands with path prefix', () => {
    const cfg = tmpFile({
      srv: { type: 'stdio', command: '/usr/local/bin/node', args: ['server.js'] }
    });
    const result = loadMcpServers(cfg);
    expect(result).toHaveProperty('srv');
    unlinkSync(cfg);
  });
});

describe('isSafeEnvVar (via loadMcpServers env substitution)', () => {
  it('substitutes allowed env vars', () => {
    process.env.ANTHROPIC_TEST_KEY = 'test-key-123';
    const cfg = tmpFile({});
    writeFileSync(cfg, JSON.stringify({
      srv: { type: 'http', url: 'http://localhost:${ANTHROPIC_TEST_KEY}' }
    }));
    const result = loadMcpServers(cfg);
    expect(result.srv.url).toBe('http://localhost:test-key-123');
    delete process.env.ANTHROPIC_TEST_KEY;
    unlinkSync(cfg);
  });

  it('blocks sensitive env vars', () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'super-secret';
    const cfg = tmpFile({});
    writeFileSync(cfg, JSON.stringify({
      srv: { type: 'http', url: 'http://localhost:${AWS_SECRET_ACCESS_KEY}' }
    }));
    const result = loadMcpServers(cfg);
    expect(result.srv.url).toBe('http://localhost:');
    delete process.env.AWS_SECRET_ACCESS_KEY;
    unlinkSync(cfg);
  });
});

describe('loadMcpServers', () => {
  it('returns empty object for missing config file', () => {
    const result = loadMcpServers('/nonexistent/path.json');
    expect(result).toEqual({});
  });

  it('skips entries starting with underscore', () => {
    const cfg = tmpFile({
      _comment: 'this is a comment',
      srv: { type: 'stdio', command: 'node', args: [] }
    });
    const result = loadMcpServers(cfg);
    expect(result).not.toHaveProperty('_comment');
    expect(result).toHaveProperty('srv');
    unlinkSync(cfg);
  });

  it('skips disabled servers', () => {
    const cfg = tmpFile({
      srv: { type: 'stdio', command: 'node', args: [], enabled: false }
    });
    const result = loadMcpServers(cfg);
    expect(result).toEqual({});
    unlinkSync(cfg);
  });

  it('loads http servers', () => {
    const cfg = tmpFile({
      web: { type: 'http', url: 'http://localhost:3000' }
    });
    const result = loadMcpServers(cfg);
    expect(result.web).toEqual({
      type: 'http',
      url: 'http://localhost:3000',
      headers: {}
    });
    unlinkSync(cfg);
  });

  it('skips http servers without url', () => {
    const cfg = tmpFile({
      web: { type: 'http' }
    });
    const result = loadMcpServers(cfg);
    expect(result).toEqual({});
    unlinkSync(cfg);
  });

  it('skips unknown server types', () => {
    const cfg = tmpFile({
      web: { type: 'grpc', url: 'http://localhost:3000' }
    });
    const result = loadMcpServers(cfg);
    expect(result).toEqual({});
    unlinkSync(cfg);
  });
});

describe('validateMcpConfig', () => {
  it('returns valid for valid JSON', () => {
    const cfg = tmpFile({ test: true });
    const result = validateMcpConfig(cfg);
    expect(result.valid).toBe(true);
    unlinkSync(cfg);
  });

  it('returns invalid for missing file', () => {
    const result = validateMcpConfig('/nonexistent/file.json');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('File not found');
  });

  it('returns invalid for malformed JSON', () => {
    const p = join(tmpdir(), `mcp-bad-${Date.now()}.json`);
    writeFileSync(p, '{not valid json}');
    const result = validateMcpConfig(p);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    unlinkSync(p);
  });
});

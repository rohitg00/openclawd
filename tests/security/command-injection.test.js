import { describe, it, expect } from 'vitest';
import { loadMcpServers } from '../../server/mcp-loader.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function tmpFile(content) {
  const p = join(tmpdir(), `cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(content, null, 2));
  return p;
}

describe('command injection prevention', () => {
  it('rejects shell metacharacters in args', () => {
    const metacharacters = [
      'arg;rm -rf /',
      'arg|cat /etc/passwd',
      'arg&background',
      'arg`whoami`',
      'arg$(id)',
      'arg(subshell)',
      'arg){close',
      'arg{open',
      'arg}close',
      'arg[bracket',
      'arg]bracket',
      'arg<redirect',
      'arg>redirect',
      'arg!history',
      'arg#comment',
      'arg~tilde',
    ];

    for (const arg of metacharacters) {
      const cfg = tmpFile({
        srv: { type: 'stdio', command: 'node', args: [arg] }
      });
      const result = loadMcpServers(cfg);
      expect(result).toEqual({});
      unlinkSync(cfg);
    }
  });

  it('rejects non-whitelisted commands', () => {
    const blocked = ['bash', 'sh', 'curl', 'wget', 'rm', 'cat', 'eval', 'exec'];
    for (const cmd of blocked) {
      const cfg = tmpFile({
        srv: { type: 'stdio', command: cmd, args: [] }
      });
      const result = loadMcpServers(cfg);
      expect(result).toEqual({});
      unlinkSync(cfg);
    }
  });

  it('accepts valid whitelisted commands with safe args', () => {
    const valid = [
      { command: 'node', args: ['server.js'] },
      { command: 'npx', args: ['@modelcontextprotocol/server'] },
      { command: 'python3', args: ['-m', 'mcp_server'] },
      { command: 'docker', args: ['run', 'mcp-image'] },
      { command: 'deno', args: ['run', 'server.ts'] },
      { command: 'bun', args: ['run', 'server.js'] },
    ];

    for (const { command, args } of valid) {
      const cfg = tmpFile({
        srv: { type: 'stdio', command, args }
      });
      const result = loadMcpServers(cfg);
      expect(result).toHaveProperty('srv');
      expect(result.srv.command).toBe(command);
      expect(result.srv.args).toEqual(args);
      unlinkSync(cfg);
    }
  });

  it('rejects path traversal in commands', () => {
    const cfg = tmpFile({
      srv: { type: 'stdio', command: '../../bin/sh', args: [] }
    });
    const result = loadMcpServers(cfg);
    expect(result).toEqual({});
    unlinkSync(cfg);
  });
});

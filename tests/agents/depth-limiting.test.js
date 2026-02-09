import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../../server/agents/agent-manager.js';

vi.mock('../../server/providers/index.js', () => ({
  getProvider: vi.fn(() => ({
    query: vi.fn(async function* () {
      yield { type: 'text', content: 'mock' };
    }),
    abort: vi.fn(() => true)
  }))
}));

describe('Sub-agent depth limiting', () => {
  let manager;

  beforeEach(() => {
    manager = new AgentManager({ maxDepth: 3 });
  });

  it('creates agents with default depth 0', () => {
    const agent = manager.createAgent({ name: 'root' });
    expect(agent.depth).toBe(0);
    expect(agent.maxDepth).toBe(3);
  });

  it('canSpawnChild returns true when under limit', () => {
    const agent = manager.createAgent({ name: 'parent' });
    expect(agent.canSpawnChild()).toBe(true);
  });

  it('canSpawnChild returns false at max depth', () => {
    const agent = manager.createAgent({ name: 'deep', depth: 3, maxDepth: 3 });
    expect(agent.canSpawnChild()).toBe(false);
  });

  it('spawnChildAgent increments depth', () => {
    manager.createAgent({ name: 'parent' });
    const child = manager.spawnChildAgent('parent', { name: 'child1' });
    expect(child.depth).toBe(1);
    expect(child.maxDepth).toBe(3);
  });

  it('spawnChildAgent chains depth correctly', () => {
    manager.createAgent({ name: 'root' });
    const child = manager.spawnChildAgent('root', { name: 'child' });
    const grandchild = manager.spawnChildAgent('child', { name: 'grandchild' });
    expect(grandchild.depth).toBe(2);
  });

  it('spawnChildAgent throws at max depth', () => {
    manager.createAgent({ name: 'root' });
    manager.spawnChildAgent('root', { name: 'd1' });
    manager.spawnChildAgent('d1', { name: 'd2' });
    manager.spawnChildAgent('d2', { name: 'd3' });
    expect(() => manager.spawnChildAgent('d3', { name: 'd4' }))
      .toThrow("Agent 'd3' at max depth (3/3)");
  });

  it('spawnChildAgent throws for missing parent', () => {
    expect(() => manager.spawnChildAgent('ghost', { name: 'child' }))
      .toThrow("Parent agent 'ghost' not found");
  });

  it('toJSON includes depth info', () => {
    manager.createAgent({ name: 'root' });
    const child = manager.spawnChildAgent('root', { name: 'child' });
    const json = child.toJSON();
    expect(json.depth).toBe(1);
    expect(json.maxDepth).toBe(3);
  });

  it('respects per-agent maxDepth override', () => {
    const agent = manager.createAgent({ name: 'limited', maxDepth: 1 });
    expect(agent.maxDepth).toBe(1);
    manager.spawnChildAgent('limited', { name: 'child' });
    expect(() => manager.spawnChildAgent('child', { name: 'grandchild' }))
      .toThrow("Agent 'child' at max depth (1/1)");
  });

  it('default manager maxDepth is 5 when not specified', () => {
    const defaultManager = new AgentManager();
    const agent = defaultManager.createAgent({ name: 'test' });
    expect(agent.maxDepth).toBe(5);
  });
});

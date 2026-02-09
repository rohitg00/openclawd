import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentManager } from '../../server/agents/agent-manager.js';

vi.mock('../../server/providers/index.js', () => ({
  getProvider: vi.fn(() => ({
    query: vi.fn(async function* ({ prompt }) {
      yield { type: 'text', content: 'mock response' };
    }),
    abort: vi.fn(() => true)
  }))
}));

describe('AgentManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AgentManager();
  });

  it('creates an agent', () => {
    const agent = manager.createAgent({ name: 'agent1' });
    expect(agent.name).toBe('agent1');
  });

  it('rejects duplicate agent names', () => {
    manager.createAgent({ name: 'dup' });
    expect(() => manager.createAgent({ name: 'dup' })).toThrow("Agent 'dup' already exists");
  });

  it('gets an agent by name', () => {
    manager.createAgent({ name: 'find-me' });
    expect(manager.getAgent('find-me')).not.toBeNull();
    expect(manager.getAgent('missing')).toBeNull();
  });

  it('lists all agents', () => {
    manager.createAgent({ name: 'a1' });
    manager.createAgent({ name: 'a2' });
    const list = manager.listAgents();
    expect(list).toHaveLength(2);
    expect(list.map(a => a.name)).toContain('a1');
  });

  it('kills an agent', () => {
    manager.createAgent({ name: 'doomed' });
    expect(manager.killAgent('doomed')).toBe(true);
    expect(manager.getAgent('doomed')).toBeNull();
  });

  it('throws when killing non-existent agent', () => {
    expect(() => manager.killAgent('ghost')).toThrow("Agent 'ghost' not found");
  });

  it('kills all agents', () => {
    manager.createAgent({ name: 'x1' });
    manager.createAgent({ name: 'x2' });
    const count = manager.killAll();
    expect(count).toBe(2);
    expect(manager.listAgents()).toHaveLength(0);
  });

  it('ask() creates ephemeral agent and returns response', async () => {
    const response = await manager.ask('test message');
    expect(response).toBe('mock response');
    expect(manager.listAgents()).toHaveLength(0);
  });

  it('sendMessage() delivers to target agent', () => {
    manager.createAgent({ name: 'sender' });
    manager.createAgent({ name: 'receiver' });
    manager.sendMessage('sender', 'receiver', 'hello');
    const receiver = manager.getAgent('receiver');
    expect(receiver.inbox).toHaveLength(1);
    expect(receiver.inbox[0].content).toBe('hello');
  });

  it('sendMessage() throws for missing target', () => {
    manager.createAgent({ name: 'sender' });
    expect(() => manager.sendMessage('sender', 'nobody', 'hi')).toThrow("Agent 'nobody' not found");
  });

  it('broadcast() sends to all except sender', () => {
    manager.createAgent({ name: 'broadcaster' });
    manager.createAgent({ name: 'listener1' });
    manager.createAgent({ name: 'listener2' });
    const count = manager.broadcast('broadcaster', 'announcement');
    expect(count).toBe(2);
    expect(manager.getAgent('listener1').inbox).toHaveLength(1);
    expect(manager.getAgent('broadcaster').inbox).toHaveLength(0);
  });

  it('emits agent:created event', () => {
    const handler = vi.fn();
    manager.on('agent:created', handler);
    manager.createAgent({ name: 'evt' });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: 'evt' }));
  });
});

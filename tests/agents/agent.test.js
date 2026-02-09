import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../../server/agents/agent.js';
import { AGENT_STATUS } from '../../server/agents/types.js';

vi.mock('../../server/providers/index.js', () => ({
  getProvider: vi.fn(() => ({
    query: vi.fn(async function* ({ prompt }) {
      yield { type: 'text', content: `echo: ${prompt.split('\n\n').pop().replace('Human: ', '')}` };
    }),
    abort: vi.fn(() => true)
  }))
}));

describe('Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new Agent({ name: 'test-agent', provider: 'claude' });
  });

  it('requires a name', () => {
    expect(() => new Agent({})).toThrow('Agent name is required');
  });

  it('initializes with correct defaults', () => {
    expect(agent.name).toBe('test-agent');
    expect(agent.providerName).toBe('claude');
    expect(agent.status).toBe(AGENT_STATUS.idle);
    expect(agent.history).toEqual([]);
    expect(agent.chatId).toMatch(/^agent_test-agent_\d+$/);
  });

  it('uses permission presets', () => {
    const fullAgent = new Agent({ name: 'a', permissions: 'full' });
    expect(fullAgent.allowedTools).toContain('Bash');

    const askAgent = new Agent({ name: 'b', permissions: 'ask' });
    expect(askAgent.allowedTools).not.toContain('Bash');
    expect(askAgent.allowedTools).toContain('Read');
  });

  it('throws on unknown permission preset', () => {
    const agent = new Agent({ name: 'bad-perms', permissions: 'nonexistent' });
    expect(() => agent.allowedTools).toThrow("Unknown permission preset: 'nonexistent'");
  });

  it('ask() returns a response and updates history', async () => {
    const response = await agent.ask('hello');
    expect(response).toContain('hello');
    expect(agent.history).toHaveLength(2);
    expect(agent.history[0].role).toBe('user');
    expect(agent.history[1].role).toBe('assistant');
    expect(agent.status).toBe(AGENT_STATUS.idle);
  });

  it('stream() yields chunks', async () => {
    const chunks = [];
    for await (const chunk of agent.stream('hi')) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(agent.history).toHaveLength(2);
    expect(agent.status).toBe(AGENT_STATUS.idle);
  });

  it('caps history at 50 messages', async () => {
    for (let i = 0; i < 30; i++) {
      await agent.ask(`msg ${i}`);
    }
    expect(agent.history.length).toBeLessThanOrEqual(50);
  });

  it('stream() rejects when agent is busy', async () => {
    agent.status = AGENT_STATUS.busy;
    const gen = agent.stream('test');
    await expect(gen.next()).rejects.toThrow('Agent is busy');
  });

  it('kill() sets status to killed', () => {
    agent.kill();
    expect(agent.status).toBe(AGENT_STATUS.killed);
  });

  it('receiveMessage() adds to inbox', () => {
    agent.receiveMessage('other', 'hello');
    expect(agent.inbox).toHaveLength(1);
    expect(agent.inbox[0].from).toBe('other');
    expect(agent.inbox[0].content).toBe('hello');
  });

  it('toJSON() returns serializable object', () => {
    const json = agent.toJSON();
    expect(json.name).toBe('test-agent');
    expect(json.status).toBe('idle');
    expect(json.messageCount).toBe(0);
    expect(json.inboxCount).toBe(0);
  });

  it('queues concurrent requests', async () => {
    const p1 = agent.ask('first');
    const p2 = agent.ask('second');
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(agent.history).toHaveLength(4);
  });

  it('includes system prompt in built prompt', () => {
    const sysAgent = new Agent({ name: 'sys', systemPrompt: 'You are helpful.' });
    const prompt = sysAgent._buildPrompt('test');
    expect(prompt).toContain('System: You are helpful.');
    expect(prompt).toContain('Human: test');
  });

  it('handles provider error in ask()', async () => {
    const { getProvider } = await import('../../server/providers/index.js');
    getProvider.mockReturnValueOnce({
      query: async function* () { throw new Error('provider down'); },
      abort: vi.fn()
    });

    const errorAgent = new Agent({ name: 'err-agent' });
    await expect(errorAgent.ask('test')).rejects.toThrow('provider down');
    expect(errorAgent.status).toBe(AGENT_STATUS.error);
  });
});

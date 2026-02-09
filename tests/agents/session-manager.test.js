import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSessionManager } from '../../server/agents/session-manager.js';
import { AgentManager } from '../../server/agents/agent-manager.js';

vi.mock('../../server/providers/index.js', () => ({
  getProvider: vi.fn(() => ({
    query: vi.fn(async function* () { yield { type: 'text', content: 'ok' }; }),
    abort: vi.fn(() => true)
  }))
}));

describe('AgentSessionManager', () => {
  let am;
  let sm;

  beforeEach(() => {
    am = new AgentManager();
    sm = new AgentSessionManager(am);
  });

  it('creates a session', () => {
    const session = sm.createSession({ name: 'test-session' });
    expect(session.id).toBe('1');
    expect(session.name).toBe('test-session');
    expect(session.agents).toEqual([]);
  });

  it('creates session with default name', () => {
    const session = sm.createSession();
    expect(session.name).toBe('session-1');
  });

  it('gets a session by ID', () => {
    sm.createSession({ name: 'find-me' });
    expect(sm.getSession('1').name).toBe('find-me');
    expect(sm.getSession('99')).toBeNull();
  });

  it('lists all sessions', () => {
    sm.createSession();
    sm.createSession();
    expect(sm.listSessions()).toHaveLength(2);
  });

  it('adds agent to session with session defaults', () => {
    const session = sm.createSession({ provider: 'claude', model: 'opus' });
    const agent = sm.addAgentToSession(session.id, { name: 'worker' });
    expect(agent.providerName).toBe('claude');
    expect(agent.model).toBe('opus');
    expect(session.agents).toContain('worker');
  });

  it('agent options override session defaults', () => {
    const session = sm.createSession({ provider: 'claude' });
    const agent = sm.addAgentToSession(session.id, { name: 'custom', provider: 'opencode' });
    expect(agent.providerName).toBe('opencode');
  });

  it('throws when adding to non-existent session', () => {
    expect(() => sm.addAgentToSession('99', { name: 'x' })).toThrow("Session '99' not found");
  });

  it('closeSession() kills all agents and removes session', () => {
    const session = sm.createSession();
    sm.addAgentToSession(session.id, { name: 'a1' });
    sm.addAgentToSession(session.id, { name: 'a2' });

    sm.closeSession(session.id);
    expect(sm.getSession(session.id)).toBeNull();
    expect(am.getAgent('a1')).toBeNull();
    expect(am.getAgent('a2')).toBeNull();
  });
});

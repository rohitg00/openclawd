export class AgentSessionManager {
  constructor(agentManager) {
    this.agentManager = agentManager;
    this.sessions = new Map();
    this._nextId = 1;
  }

  createSession({ name, provider, model } = {}) {
    const id = String(this._nextId++);
    const session = {
      id,
      name: name || `session-${id}`,
      defaults: { provider, model },
      agents: [],
      createdAt: Date.now()
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) || null;
  }

  listSessions() {
    return Array.from(this.sessions.values());
  }

  addAgentToSession(sessionId, agentOptions) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found`);

    const opts = {
      ...agentOptions,
      provider: agentOptions.provider || session.defaults.provider,
      model: agentOptions.model || session.defaults.model
    };

    const agent = this.agentManager.createAgent(opts);
    session.agents.push(agent.name);
    return agent;
  }

  closeSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session '${id}' not found`);

    for (const agentName of session.agents) {
      try {
        this.agentManager.killAgent(agentName);
      } catch {
      }
    }

    this.sessions.delete(id);
    return true;
  }
}

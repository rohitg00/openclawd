import { EventEmitter } from 'events';
import { Agent } from './agent.js';

const DEFAULT_MAX_DEPTH = 5;

export class AgentManager extends EventEmitter {
  constructor({ maxDepth = DEFAULT_MAX_DEPTH } = {}) {
    super();
    this.agents = new Map();
    this.maxDepth = maxDepth;
    this._ephemeralId = 0;
  }

  createAgent(options) {
    if (this.agents.has(options.name)) {
      throw new Error(`Agent '${options.name}' already exists`);
    }
    const maxDepth = options.maxDepth ?? this.maxDepth;
    const agent = new Agent({ ...options, maxDepth });
    this.agents.set(options.name, agent);
    this.emit('agent:created', agent.toJSON());
    return agent;
  }

  spawnChildAgent(parentName, childOptions) {
    const parent = this.agents.get(parentName);
    if (!parent) throw new Error(`Parent agent '${parentName}' not found`);
    if (!parent.canSpawnChild()) {
      throw new Error(`Agent '${parentName}' at max depth (${parent.depth}/${parent.maxDepth})`);
    }
    return this.createAgent({
      ...childOptions,
      depth: parent.depth + 1,
      maxDepth: parent.maxDepth
    });
  }

  getAgent(name) {
    return this.agents.get(name) || null;
  }

  listAgents() {
    return Array.from(this.agents.values()).map(a => a.toJSON());
  }

  killAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent '${name}' not found`);
    agent.kill();
    this.agents.delete(name);
    this.emit('agent:killed', { name });
    return true;
  }

  killAll() {
    for (const agent of this.agents.values()) {
      agent.kill();
    }
    const count = this.agents.size;
    this.agents.clear();
    return count;
  }

  async ask(message, options = {}) {
    const name = `ephemeral_${Date.now()}_${this._ephemeralId++}`;
    const agent = this.createAgent({ name, ...options });
    try {
      return await agent.ask(message);
    } finally {
      agent.kill();
      this.agents.delete(name);
    }
  }

  sendMessage(from, to, content) {
    const target = this.agents.get(to);
    if (!target) throw new Error(`Agent '${to}' not found`);
    target.receiveMessage(from, content);
    this.emit('message', { from, to, content });
    return true;
  }

  broadcast(from, content) {
    let count = 0;
    for (const [name, agent] of this.agents) {
      if (name !== from) {
        agent.receiveMessage(from, content);
        count++;
      }
    }
    this.emit('message', { from, to: '*', content });
    return count;
  }
}

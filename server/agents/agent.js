import { getProvider } from '../providers/index.js';
import { AGENT_STATUS, PERMISSION_PRESETS } from './types.js';

const MAX_HISTORY = 50;

export class Agent {
  constructor({ name, provider = 'claude', model, systemPrompt, permissions = 'full' }) {
    if (!name) throw new Error('Agent name is required');

    this.name = name;
    this.providerName = provider;
    this.model = model;
    this.systemPrompt = systemPrompt || '';
    this.permissions = permissions;
    this.status = AGENT_STATUS.idle;
    this.createdAt = Date.now();
    this.chatId = `agent_${name}_${this.createdAt}`;
    this.history = [];
    this.inbox = [];
    this._queue = Promise.resolve();
  }

  get allowedTools() {
    const preset = PERMISSION_PRESETS[this.permissions];
    return preset ? preset.allowedTools : PERMISSION_PRESETS.full.allowedTools;
  }

  _buildPrompt(message) {
    const parts = [];
    if (this.systemPrompt) {
      parts.push(`System: ${this.systemPrompt}`);
    }
    const historySlice = this.history.slice(-MAX_HISTORY);
    for (const msg of historySlice) {
      parts.push(`${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`);
    }
    parts.push(`Human: ${message}`);
    return parts.join('\n\n');
  }

  _addToHistory(role, content) {
    this.history.push({ role, content, timestamp: Date.now() });
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
  }

  async ask(message) {
    return this._enqueue(async () => {
      this.status = AGENT_STATUS.busy;
      this._addToHistory('user', message);

      try {
        const provider = getProvider(this.providerName);
        const prompt = this._buildPrompt(message);
        let fullResponse = '';

        for await (const chunk of provider.query({
          prompt,
          chatId: this.chatId,
          userId: `agent:${this.name}`,
          model: this.model,
          allowedTools: this.allowedTools,
          maxTurns: 10
        })) {
          if (chunk.type === 'text' && chunk.content) {
            fullResponse += chunk.content;
          }
        }

        if (!fullResponse) {
          fullResponse = 'No response generated.';
        }

        this._addToHistory('assistant', fullResponse);
        this.status = AGENT_STATUS.idle;
        return fullResponse;
      } catch (error) {
        this.status = AGENT_STATUS.error;
        throw error;
      }
    });
  }

  async *stream(message) {
    if (this.status === AGENT_STATUS.busy) {
      throw new Error('Agent is busy');
    }
    this.status = AGENT_STATUS.busy;
    this._addToHistory('user', message);

    try {
      const provider = getProvider(this.providerName);
      const prompt = this._buildPrompt(message);
      let fullResponse = '';

      for await (const chunk of provider.query({
        prompt,
        chatId: this.chatId,
        userId: `agent:${this.name}`,
        model: this.model,
        allowedTools: this.allowedTools,
        maxTurns: 10
      })) {
        if (chunk.type === 'text' && chunk.content) {
          fullResponse += chunk.content;
        }
        yield chunk;
      }

      this._addToHistory('assistant', fullResponse || 'No response generated.');
      this.status = AGENT_STATUS.idle;
    } catch (error) {
      this.status = AGENT_STATUS.error;
      throw error;
    }
  }

  receiveMessage(from, content) {
    this.inbox.push({ from, content, timestamp: Date.now() });
  }

  kill() {
    try {
      const provider = getProvider(this.providerName);
      provider.abort(this.chatId);
    } catch {
    }
    this.status = AGENT_STATUS.killed;
  }

  toJSON() {
    return {
      name: this.name,
      provider: this.providerName,
      model: this.model,
      status: this.status,
      permissions: this.permissions,
      chatId: this.chatId,
      createdAt: this.createdAt,
      messageCount: this.history.length,
      inboxCount: this.inbox.length
    };
  }

  _enqueue(fn) {
    this._queue = this._queue.then(fn, fn);
    return this._queue;
  }
}

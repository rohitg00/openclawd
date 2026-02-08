import { getOrCreateSession, addMessage, resetSession } from './session-manager.js';
import { getProvider, getAvailableProviders } from '../providers/index.js';
import { parseModelRef } from '../providers/model-selection.js';

export class BaseChannel {
  constructor(platform) {
    this.platform = platform;
    this.active = false;
    this.mcpServers = {};
  }

  setMcpServers(servers) {
    this.mcpServers = servers;
  }

  async start(_config) {
    this.active = true;
  }

  async stop() {
    this.active = false;
  }

  getStatus() {
    return { active: this.active, platform: this.platform };
  }

  async handleIncomingMessage(userId, text) {
    const session = getOrCreateSession(this.platform, userId);

    const command = this.parseCommand(text);
    if (command) {
      return this.handleCommand(command, session, userId);
    }

    addMessage(session, 'user', text);

    try {
      const providerName = session.provider || 'claude';
      const { modelId } = parseModelRef(session.model);
      const provider = getProvider(providerName);

      const conversationPrompt = session.messages
        .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      let fullResponse = '';

      for await (const chunk of provider.query({
        prompt: conversationPrompt,
        chatId: `${this.platform}_${userId}_${Date.now()}`,
        userId: `${this.platform}:${userId}`,
        mcpServers: this.mcpServers,
        model: modelId,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
        maxTurns: 10
      })) {
        if (chunk.type === 'text' && chunk.content) {
          fullResponse += chunk.content;
        }
      }

      if (!fullResponse) {
        fullResponse = 'I received your message but had no response to generate.';
      }

      addMessage(session, 'assistant', fullResponse);
      return fullResponse;
    } catch (error) {
      console.error(`[${this.platform}] Error handling message:`, error.message);
      return `Error: ${error.message}`;
    }
  }

  parseCommand(text) {
    const trimmed = text.trim();
    if (trimmed === '/reset' || trimmed === '!reset') return { name: 'reset' };
    if (trimmed === '/status' || trimmed === '!status') return { name: 'status' };
    if (trimmed.startsWith('/model ') || trimmed.startsWith('!model ')) {
      return { name: 'model', args: trimmed.split(' ').slice(1).join(' ') };
    }
    return null;
  }

  handleCommand(command, session, userId) {
    switch (command.name) {
      case 'reset':
        resetSession(this.platform, userId);
        return 'Conversation reset. Start fresh!';

      case 'status': {
        const msgCount = session.messages.length;
        return `Provider: ${session.provider}\nModel: ${session.model}\nMessages: ${msgCount}\nAvailable providers: ${getAvailableProviders().join(', ')}`;
      }

      case 'model': {
        const modelRef = command.args.trim();
        if (modelRef) {
          session.model = modelRef;
          const { provider, modelId } = parseModelRef(modelRef);
          if (provider) session.provider = provider;
          return `Switched to model: ${modelRef}`;
        }
        return `Current model: ${session.model}\nUsage: /model provider/model-name`;
      }

      default:
        return 'Unknown command';
    }
  }
}

export function chunkText(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf('. ', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

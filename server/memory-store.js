import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export class MemoryStore {
  constructor(storagePath) {
    if (!storagePath) throw new Error('Storage path is required');
    this.storagePath = path.resolve(storagePath);
    this.conversations = new Map();
    this._dirty = false;
    this._loaded = false;
  }

  _ensureDir() {
    const dir = path.dirname(this.storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  load() {
    if (this._loaded) return;

    try {
      if (existsSync(this.storagePath)) {
        const data = JSON.parse(readFileSync(this.storagePath, 'utf-8'));
        if (data.conversations) {
          for (const [id, convo] of Object.entries(data.conversations)) {
            this.conversations.set(id, convo);
          }
        }
      }
    } catch (error) {
      console.error('[MemoryStore] Failed to load:', error.message);
    }

    this._loaded = true;
  }

  save() {
    if (!this._dirty) return;

    this._ensureDir();

    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      conversations: Object.fromEntries(this.conversations)
    };

    writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    this._dirty = false;
  }

  getConversation(chatId) {
    this.load();
    return this.conversations.get(chatId) || null;
  }

  addMessage(chatId, role, content, metadata = {}) {
    this.load();

    if (!this.conversations.has(chatId)) {
      if (this.conversations.size >= MAX_CONVERSATIONS) {
        this._evictOldest();
      }
      this.conversations.set(chatId, {
        id: chatId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        summary: null
      });
    }

    const convo = this.conversations.get(chatId);

    convo.messages.push({
      ...metadata,
      role,
      content,
      timestamp: new Date().toISOString()
    });

    if (convo.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
      convo.messages = convo.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
    }

    convo.updatedAt = new Date().toISOString();
    this._dirty = true;
  }

  getMessages(chatId, limit = 50) {
    const convo = this.getConversation(chatId);
    if (!convo) return [];
    return convo.messages.slice(-limit);
  }

  setSummary(chatId, summary) {
    this.load();
    const convo = this.conversations.get(chatId);
    if (!convo) return;
    convo.summary = summary;
    convo.updatedAt = new Date().toISOString();
    this._dirty = true;
  }

  listConversations() {
    this.load();
    return Array.from(this.conversations.values()).map(c => ({
      id: c.id,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      hasSummary: !!c.summary
    }));
  }

  deleteConversation(chatId) {
    this.load();
    const deleted = this.conversations.delete(chatId);
    if (deleted) this._dirty = true;
    return deleted;
  }

  clear() {
    this.load();
    this.conversations.clear();
    this._dirty = true;
  }

  _evictOldest() {
    let oldestId = null;
    let oldestTime = Infinity;

    for (const [id, convo] of this.conversations) {
      const time = new Date(convo.updatedAt).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.conversations.delete(oldestId);
    }
  }
}

export function createMemoryStore(storagePath) {
  return new MemoryStore(storagePath);
}

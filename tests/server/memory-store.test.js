import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore, createMemoryStore } from '../../server/memory-store.js';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

describe('MemoryStore', () => {
  const testDir = path.join(os.tmpdir(), 'openclawd-memory-test');
  const testFile = path.join(testDir, 'memory.json');
  let store;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new MemoryStore(testFile);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('throws without storage path', () => {
    expect(() => new MemoryStore()).toThrow('Storage path is required');
  });

  it('adds a message to a new conversation', () => {
    store.addMessage('chat1', 'user', 'hello');
    const messages = store.getMessages('chat1');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('hello');
  });

  it('adds multiple messages', () => {
    store.addMessage('chat1', 'user', 'hello');
    store.addMessage('chat1', 'assistant', 'hi there');
    const messages = store.getMessages('chat1');
    expect(messages).toHaveLength(2);
  });

  it('returns empty array for unknown conversation', () => {
    store.load();
    expect(store.getMessages('unknown')).toEqual([]);
  });

  it('getConversation returns null for unknown', () => {
    store.load();
    expect(store.getConversation('unknown')).toBeNull();
  });

  it('limits messages per conversation', () => {
    for (let i = 0; i < 210; i++) {
      store.addMessage('chat1', 'user', `msg ${i}`);
    }
    const messages = store.getMessages('chat1', 300);
    expect(messages.length).toBeLessThanOrEqual(200);
  });

  it('getMessages respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      store.addMessage('chat1', 'user', `msg ${i}`);
    }
    const messages = store.getMessages('chat1', 3);
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('msg 7');
  });

  it('saves and loads from disk', () => {
    store.addMessage('chat1', 'user', 'persistent');
    store.save();

    expect(existsSync(testFile)).toBe(true);

    const store2 = new MemoryStore(testFile);
    const messages = store2.getMessages('chat1');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('persistent');
  });

  it('setSummary stores summary on conversation', () => {
    store.addMessage('chat1', 'user', 'hello');
    store.setSummary('chat1', 'A greeting conversation');
    const convo = store.getConversation('chat1');
    expect(convo.summary).toBe('A greeting conversation');
  });

  it('listConversations returns metadata', () => {
    store.addMessage('chat1', 'user', 'hello');
    store.addMessage('chat2', 'user', 'world');
    const list = store.listConversations();
    expect(list).toHaveLength(2);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('messageCount');
    expect(list[0]).toHaveProperty('hasSummary');
  });

  it('deleteConversation removes conversation', () => {
    store.addMessage('chat1', 'user', 'hello');
    expect(store.deleteConversation('chat1')).toBe(true);
    expect(store.getConversation('chat1')).toBeNull();
  });

  it('deleteConversation returns false for unknown', () => {
    store.load();
    expect(store.deleteConversation('unknown')).toBe(false);
  });

  it('clear removes all conversations', () => {
    store.addMessage('chat1', 'user', 'hello');
    store.addMessage('chat2', 'user', 'world');
    store.clear();
    expect(store.listConversations()).toHaveLength(0);
  });

  it('evicts oldest conversation when at capacity', () => {
    for (let i = 0; i < 101; i++) {
      store.addMessage(`chat${i}`, 'user', `msg ${i}`);
    }
    expect(store.conversations.size).toBeLessThanOrEqual(100);
  });

  it('save is no-op when not dirty', () => {
    store.load();
    store.save();
    expect(existsSync(testFile)).toBe(false);
  });

  it('createMemoryStore helper works', () => {
    const ms = createMemoryStore(testFile);
    expect(ms).toBeInstanceOf(MemoryStore);
  });

  it('handles corrupted file gracefully', async () => {
    const { writeFileSync } = await import('fs');
    writeFileSync(testFile, 'not json');
    const badStore = new MemoryStore(testFile);
    badStore.load();
    expect(badStore.listConversations()).toHaveLength(0);
  });

  it('messages include timestamps', () => {
    store.addMessage('chat1', 'user', 'hello');
    const messages = store.getMessages('chat1');
    expect(messages[0].timestamp).toBeDefined();
  });

  it('messages include custom metadata', () => {
    store.addMessage('chat1', 'user', 'hello', { provider: 'claude', model: 'opus' });
    const messages = store.getMessages('chat1');
    expect(messages[0].provider).toBe('claude');
    expect(messages[0].model).toBe('opus');
  });

  it('metadata cannot overwrite reserved fields', () => {
    store.addMessage('chat1', 'user', 'hello', { role: 'hacked', content: 'injected' });
    const messages = store.getMessages('chat1');
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('hello');
  });
});

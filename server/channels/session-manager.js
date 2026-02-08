const sessions = new Map();

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export function getOrCreateSession(platform, userId) {
  const key = `${platform}:${userId}`;
  let session = sessions.get(key);

  if (!session) {
    session = {
      platform,
      userId,
      messages: [],
      provider: process.env.DEFAULT_PROVIDER || 'claude',
      model: process.env.DEFAULT_MODEL || 'anthropic/claude-sonnet-4-5-20250929',
      lastActivity: Date.now(),
      createdAt: Date.now()
    };
    sessions.set(key, session);
  }

  session.lastActivity = Date.now();
  return session;
}

export function addMessage(session, role, content) {
  session.messages.push({ role, content, timestamp: Date.now() });
  session.lastActivity = Date.now();

  if (session.messages.length > 50) {
    session.messages = session.messages.slice(-40);
  }
}

export function resetSession(platform, userId) {
  const key = `${platform}:${userId}`;
  const session = sessions.get(key);
  if (session) {
    session.messages = [];
    session.lastActivity = Date.now();
  }
}

export function listSessions() {
  const result = [];
  for (const [key, session] of sessions.entries()) {
    result.push({
      key,
      platform: session.platform,
      userId: session.userId,
      messageCount: session.messages.length,
      provider: session.provider,
      model: session.model,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt
    });
  }
  return result;
}

export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(key);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Provider Registry for OpenClawd - Minimal version for provider discovery
 * Full implementation in server/providers/provider-registry.js
 */

export const BUILT_IN_PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022']
  },
  'claude-pro': {
    baseUrl: 'https://claude.ai/api',
    envKey: 'CLAUDE_SESSION_KEY',
    subscription: true,
    models: ['claude-opus-4-5', 'claude-sonnet-4', 'claude-3-5-sonnet', 'claude-3-5-haiku']
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini']
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GEMINI_API_KEY',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash']
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    requiresAuth: false,
    models: []
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768']
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    models: []
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
  }
};

export function resolveApiKey(provider) {
  const config = BUILT_IN_PROVIDERS[provider];
  if (!config) return null;
  if (config.requiresAuth === false) return { apiKey: null, source: 'none' };
  if (!config.envKey) return null;
  const value = process.env[config.envKey]?.trim();
  return value ? { apiKey: value, source: `env:${config.envKey}` } : null;
}

export async function getAvailableProviders() {
  const available = [];
  for (const [name, config] of Object.entries(BUILT_IN_PROVIDERS)) {
    const auth = resolveApiKey(name);
    if (auth || config.requiresAuth === false) {
      available.push({
        name,
        modelCount: config.models.length,
        hasAuth: !!auth
      });
    }
  }
  return available;
}

export async function discoverOllamaModels() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

/**
 * Provider Registry - 20+ LLM providers with auto-discovery
 */

import { API_TYPES, AUTH_MODES } from './types.js';

export const BUILT_IN_PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    api: API_TYPES.ANTHROPIC,
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', reasoning: true, input: ['text', 'image'], cost: { input: 15, output: 75 }, contextWindow: 200000, maxTokens: 32000 },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', reasoning: true, input: ['text', 'image'], cost: { input: 3, output: 15 }, contextWindow: 200000, maxTokens: 64000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', reasoning: false, input: ['text', 'image'], cost: { input: 3, output: 15 }, contextWindow: 200000, maxTokens: 8192 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', reasoning: false, input: ['text', 'image'], cost: { input: 0.8, output: 4 }, contextWindow: 200000, maxTokens: 8192 }
    ]
  },
  'claude-pro': {
    baseUrl: 'https://claude.ai/api',
    api: API_TYPES.ANTHROPIC,
    auth: AUTH_MODES.SESSION,
    envKey: 'CLAUDE_SESSION_KEY',
    description: 'Claude Pro/Max subscription via claude.ai',
    subscription: true,
    models: [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5 (Pro/Max)', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 32000, subscription: true },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4 (Pro/Max)', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 64000, subscription: true },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Pro/Max)', reasoning: false, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 8192, subscription: true },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku (Pro/Max)', reasoning: false, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 8192, subscription: true }
    ]
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    api: API_TYPES.OPENAI,
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', reasoning: false, input: ['text', 'image'], cost: { input: 2.5, output: 10 }, contextWindow: 128000, maxTokens: 16384 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', reasoning: false, input: ['text', 'image'], cost: { input: 0.15, output: 0.6 }, contextWindow: 128000, maxTokens: 16384 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', reasoning: false, input: ['text', 'image'], cost: { input: 10, output: 30 }, contextWindow: 128000, maxTokens: 4096 },
      { id: 'o1', name: 'o1', reasoning: true, input: ['text', 'image'], cost: { input: 15, output: 60 }, contextWindow: 200000, maxTokens: 100000 },
      { id: 'o1-mini', name: 'o1 Mini', reasoning: true, input: ['text'], cost: { input: 3, output: 12 }, contextWindow: 128000, maxTokens: 65536 }
    ]
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    api: API_TYPES.GOOGLE,
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', reasoning: false, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 1000000, maxTokens: 8192 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', reasoning: false, input: ['text', 'image'], cost: { input: 1.25, output: 5 }, contextWindow: 2000000, maxTokens: 8192 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', reasoning: false, input: ['text', 'image'], cost: { input: 0.075, output: 0.3 }, contextWindow: 1000000, maxTokens: 8192 }
    ]
  },
  venice: {
    baseUrl: 'https://api.venice.ai/api/v1',
    api: API_TYPES.OPENAI,
    envKey: 'VENICE_API_KEY',
    models: []
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    api: API_TYPES.OPENAI,
    envKey: 'OLLAMA_API_KEY',
    requiresAuth: false,
    models: []
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    api: API_TYPES.OPENAI,
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5 (OpenRouter)', reasoning: true, input: ['text', 'image'], cost: { input: 15, output: 75 }, contextWindow: 200000, maxTokens: 32000 },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (OpenRouter)', reasoning: true, input: ['text', 'image'], cost: { input: 3, output: 15 }, contextWindow: 200000, maxTokens: 64000 },
      { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)', reasoning: false, input: ['text', 'image'], cost: { input: 2.5, output: 10 }, contextWindow: 128000, maxTokens: 16384 },
      { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro (OpenRouter)', reasoning: false, input: ['text', 'image'], cost: { input: 1.25, output: 5 }, contextWindow: 2000000, maxTokens: 8192 }
    ]
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    api: API_TYPES.OPENAI,
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', reasoning: false, input: ['text'], cost: { input: 0.59, output: 0.79 }, contextWindow: 128000, maxTokens: 32768 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', reasoning: false, input: ['text'], cost: { input: 0.05, output: 0.08 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', reasoning: false, input: ['text'], cost: { input: 0.24, output: 0.24 }, contextWindow: 32768, maxTokens: 32768 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', reasoning: false, input: ['text'], cost: { input: 0.2, output: 0.2 }, contextWindow: 8192, maxTokens: 8192 }
    ]
  },
  'amazon-bedrock': {
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    api: API_TYPES.BEDROCK,
    auth: AUTH_MODES.AWS_SDK,
    models: [
      { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet (Bedrock)', reasoning: false, input: ['text', 'image'], cost: { input: 3, output: 15 }, contextWindow: 200000, maxTokens: 8192 },
      { id: 'anthropic.claude-3-5-haiku-20241022-v1:0', name: 'Claude 3.5 Haiku (Bedrock)', reasoning: false, input: ['text', 'image'], cost: { input: 0.8, output: 4 }, contextWindow: 200000, maxTokens: 8192 },
      { id: 'amazon.titan-text-premier-v1:0', name: 'Titan Text Premier', reasoning: false, input: ['text'], cost: { input: 0.5, output: 1.5 }, contextWindow: 32000, maxTokens: 8192 },
      { id: 'meta.llama3-1-70b-instruct-v1:0', name: 'Llama 3.1 70B (Bedrock)', reasoning: false, input: ['text'], cost: { input: 0.99, output: 0.99 }, contextWindow: 128000, maxTokens: 2048 }
    ]
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    api: API_TYPES.OPENAI,
    envKey: 'MOONSHOT_API_KEY',
    models: [
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', reasoning: false, input: ['text'], cost: { input: 0.6, output: 0.6 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', reasoning: false, input: ['text'], cost: { input: 0.24, output: 0.24 }, contextWindow: 32000, maxTokens: 8192 },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', reasoning: false, input: ['text'], cost: { input: 0.12, output: 0.12 }, contextWindow: 8000, maxTokens: 8192 }
    ]
  },
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1',
    api: API_TYPES.OPENAI,
    envKey: 'MINIMAX_API_KEY',
    models: [
      { id: 'abab6.5s-chat', name: 'MiniMax abab6.5s', reasoning: false, input: ['text'], cost: { input: 0.5, output: 0.5 }, contextWindow: 245760, maxTokens: 8192 },
      { id: 'abab6-chat', name: 'MiniMax abab6', reasoning: false, input: ['text'], cost: { input: 1, output: 1 }, contextWindow: 32768, maxTokens: 8192 }
    ]
  },
  xai: {
    baseUrl: 'https://api.x.ai/v1',
    api: API_TYPES.OPENAI,
    envKey: 'XAI_API_KEY',
    models: [
      { id: 'grok-2', name: 'Grok 2', reasoning: false, input: ['text'], cost: { input: 2, output: 10 }, contextWindow: 131072, maxTokens: 4096 },
      { id: 'grok-2-mini', name: 'Grok 2 Mini', reasoning: false, input: ['text'], cost: { input: 0.2, output: 0.6 }, contextWindow: 131072, maxTokens: 4096 },
      { id: 'grok-beta', name: 'Grok Beta', reasoning: false, input: ['text'], cost: { input: 5, output: 15 }, contextWindow: 131072, maxTokens: 4096 }
    ]
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    api: API_TYPES.OPENAI,
    envKey: 'MISTRAL_API_KEY',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', reasoning: false, input: ['text'], cost: { input: 3, output: 9 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', reasoning: false, input: ['text'], cost: { input: 2.7, output: 8.1 }, contextWindow: 32000, maxTokens: 8192 },
      { id: 'mistral-small-latest', name: 'Mistral Small', reasoning: false, input: ['text'], cost: { input: 1, output: 3 }, contextWindow: 32000, maxTokens: 8192 },
      { id: 'codestral-latest', name: 'Codestral', reasoning: false, input: ['text'], cost: { input: 1, output: 3 }, contextWindow: 32000, maxTokens: 8192 },
      { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', reasoning: false, input: ['text'], cost: { input: 2, output: 6 }, contextWindow: 64000, maxTokens: 8192 }
    ]
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    api: API_TYPES.OPENAI,
    envKey: 'CEREBRAS_API_KEY',
    models: [
      { id: 'llama3.1-70b', name: 'Llama 3.1 70B (Cerebras)', reasoning: false, input: ['text'], cost: { input: 0.6, output: 0.6 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B (Cerebras)', reasoning: false, input: ['text'], cost: { input: 0.1, output: 0.1 }, contextWindow: 128000, maxTokens: 8192 }
    ]
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    api: API_TYPES.OPENAI,
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', reasoning: false, input: ['text'], cost: { input: 0.14, output: 0.28 }, contextWindow: 64000, maxTokens: 8192 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', reasoning: false, input: ['text'], cost: { input: 0.14, output: 0.28 }, contextWindow: 64000, maxTokens: 8192 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', reasoning: true, input: ['text'], cost: { input: 0.55, output: 2.19 }, contextWindow: 64000, maxTokens: 8192 }
    ]
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    api: API_TYPES.OPENAI,
    envKey: 'TOGETHER_API_KEY',
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B (Together)', reasoning: false, input: ['text'], cost: { input: 3.5, output: 3.5 }, contextWindow: 130000, maxTokens: 4096 },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B (Together)', reasoning: false, input: ['text'], cost: { input: 0.88, output: 0.88 }, contextWindow: 130000, maxTokens: 4096 },
      { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B (Together)', reasoning: false, input: ['text'], cost: { input: 1.2, output: 1.2 }, contextWindow: 65536, maxTokens: 4096 }
    ]
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    api: API_TYPES.OPENAI,
    envKey: 'FIREWORKS_API_KEY',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p1-405b-instruct', name: 'Llama 3.1 405B (Fireworks)', reasoning: false, input: ['text'], cost: { input: 3, output: 3 }, contextWindow: 131072, maxTokens: 16384 },
      { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama 3.1 70B (Fireworks)', reasoning: false, input: ['text'], cost: { input: 0.9, output: 0.9 }, contextWindow: 131072, maxTokens: 16384 },
      { id: 'accounts/fireworks/models/mixtral-8x22b-instruct', name: 'Mixtral 8x22B (Fireworks)', reasoning: false, input: ['text'], cost: { input: 0.9, output: 0.9 }, contextWindow: 65536, maxTokens: 16384 }
    ]
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
    api: API_TYPES.OPENAI,
    envKey: 'PERPLEXITY_API_KEY',
    models: [
      { id: 'llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge 128K Online', reasoning: false, input: ['text'], cost: { input: 5, output: 5 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large 128K Online', reasoning: false, input: ['text'], cost: { input: 1, output: 1 }, contextWindow: 128000, maxTokens: 8192 },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small 128K Online', reasoning: false, input: ['text'], cost: { input: 0.2, output: 0.2 }, contextWindow: 128000, maxTokens: 8192 }
    ]
  },
  'github-copilot': {
    baseUrl: 'https://api.githubcopilot.com',
    api: API_TYPES.COPILOT,
    auth: AUTH_MODES.TOKEN,
    envKey: 'GITHUB_TOKEN',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Copilot)', reasoning: false, input: ['text', 'image'], cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 16384 }
    ]
  },
  cloudflare: {
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run',
    api: API_TYPES.OPENAI,
    envKey: 'CLOUDFLARE_API_KEY',
    models: [
      { id: '@cf/meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B (Cloudflare)', reasoning: false, input: ['text'], cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 8192 },
      { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B (Cloudflare)', reasoning: false, input: ['text'], cost: { input: 0, output: 0 }, contextWindow: 128000, maxTokens: 8192 },
      { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B (Cloudflare)', reasoning: false, input: ['text'], cost: { input: 0, output: 0 }, contextWindow: 32000, maxTokens: 8192 }
    ]
  }
};

export function resolveApiKey(provider) {
  const config = BUILT_IN_PROVIDERS[provider];
  if (!config) return null;

  if (config.requiresAuth === false) {
    return { apiKey: null, source: 'none' };
  }

  if (config.auth === AUTH_MODES.AWS_SDK) {
    const hasAwsCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    return hasAwsCreds ? { apiKey: 'aws-sdk', source: 'aws-sdk' } : null;
  }

  if (config.auth === AUTH_MODES.SESSION) {
    const sessionKey = process.env[config.envKey]?.trim();
    if (sessionKey) {
      return {
        apiKey: sessionKey,
        source: `session:${config.envKey}`,
        isSubscription: true,
        authType: 'session'
      };
    }
    return null;
  }

  if (!config.envKey) return null;

  const value = process.env[config.envKey]?.trim();
  return value ? { apiKey: value, source: `env:${config.envKey}` } : null;
}

export async function discoverOllamaModels() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map(m => ({
      id: m.name,
      name: m.name,
      reasoning: m.name.includes('r1') || m.name.includes('reasoning') || m.name.includes('deepseek-r1'),
      input: ['text'],
      cost: { input: 0, output: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
      local: true
    }));
  } catch {
    return [];
  }
}

export async function discoverVeniceModels() {
  const auth = resolveApiKey('venice');
  if (!auth?.apiKey) return [];

  try {
    const response = await fetch('https://api.venice.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${auth.apiKey}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map(m => ({
      id: m.id,
      name: m.id,
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0 },
      contextWindow: 128000,
      maxTokens: 8192
    }));
  } catch {
    return [];
  }
}

export async function getAvailableProviders() {
  const available = [];

  for (const [name, config] of Object.entries(BUILT_IN_PROVIDERS)) {
    const auth = resolveApiKey(name);
    const hasAuth = !!auth || config.requiresAuth === false;

    if (hasAuth) {
      available.push({
        name,
        baseUrl: config.baseUrl,
        api: config.api,
        modelCount: config.models.length,
        hasAuth: true,
        authSource: auth?.source || 'none'
      });
    }
  }

  return available;
}

export function getProviderConfig(providerName) {
  return BUILT_IN_PROVIDERS[providerName] || null;
}

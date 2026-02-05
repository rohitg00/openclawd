/**
 * Model Selection and Resolution
 */

import { BUILT_IN_PROVIDERS, resolveApiKey, discoverOllamaModels, discoverVeniceModels } from './provider-registry.js';

const dynamicModelsCache = {
  ollama: { models: [], lastFetch: 0 },
  venice: { models: [], lastFetch: 0 }
};

const CACHE_TTL = 60000;

export function parseModelRef(ref) {
  if (!ref) return { provider: 'anthropic', modelId: 'claude-opus-4-5-20251101' };

  const parts = ref.split('/');
  if (parts.length >= 2) {
    const provider = parts[0];
    const modelId = parts.slice(1).join('/');
    return { provider, modelId };
  }

  for (const [provider, config] of Object.entries(BUILT_IN_PROVIDERS)) {
    const model = config.models.find(m => m.id === ref);
    if (model) return { provider, modelId: ref };
  }

  return { provider: 'anthropic', modelId: ref };
}

export function getModelDefinition(provider, modelId) {
  const config = BUILT_IN_PROVIDERS[provider];
  if (!config) return null;
  return config.models.find(m => m.id === modelId) || null;
}

export async function refreshDynamicModels() {
  const now = Date.now();

  if (now - dynamicModelsCache.ollama.lastFetch > CACHE_TTL) {
    dynamicModelsCache.ollama.models = await discoverOllamaModels();
    dynamicModelsCache.ollama.lastFetch = now;
  }

  if (now - dynamicModelsCache.venice.lastFetch > CACHE_TTL) {
    dynamicModelsCache.venice.models = await discoverVeniceModels();
    dynamicModelsCache.venice.lastFetch = now;
  }
}

export async function listAvailableModels() {
  await refreshDynamicModels();

  const models = [];

  for (const [provider, config] of Object.entries(BUILT_IN_PROVIDERS)) {
    const auth = resolveApiKey(provider);
    const available = !!auth || config.requiresAuth === false;

    let providerModels = [...config.models];

    if (provider === 'ollama' && dynamicModelsCache.ollama.models.length > 0) {
      providerModels = dynamicModelsCache.ollama.models;
    }

    if (provider === 'venice' && dynamicModelsCache.venice.models.length > 0) {
      providerModels = dynamicModelsCache.venice.models;
    }

    for (const model of providerModels) {
      models.push({
        ref: `${provider}/${model.id}`,
        provider,
        ...model,
        available
      });
    }
  }

  return models;
}

export function listProviderNames() {
  return Object.keys(BUILT_IN_PROVIDERS);
}

export function resolveModelForProvider(provider, preferredModel = null) {
  const config = BUILT_IN_PROVIDERS[provider];
  if (!config || config.models.length === 0) return null;

  if (preferredModel) {
    const model = config.models.find(m => m.id === preferredModel);
    if (model) return model;
  }

  return config.models[0];
}

export function findEquivalentModel(currentProvider, currentModelId, targetProvider) {
  const currentModel = getModelDefinition(currentProvider, currentModelId);
  if (!currentModel) return null;

  const targetConfig = BUILT_IN_PROVIDERS[targetProvider];
  if (!targetConfig) return null;

  const equivalentMap = {
    'claude-opus-4-5-20251101': { openai: 'gpt-4o', google: 'gemini-1.5-pro', groq: 'llama-3.3-70b-versatile' },
    'claude-sonnet-4-20250514': { openai: 'gpt-4o', google: 'gemini-1.5-flash', groq: 'llama-3.3-70b-versatile' },
    'claude-3-5-sonnet-20241022': { openai: 'gpt-4o-mini', google: 'gemini-1.5-flash', groq: 'llama-3.3-70b-versatile' },
    'gpt-4o': { anthropic: 'claude-sonnet-4-20250514', google: 'gemini-1.5-pro', groq: 'llama-3.3-70b-versatile' },
    'gpt-4o-mini': { anthropic: 'claude-3-5-haiku-20241022', google: 'gemini-1.5-flash', groq: 'llama-3.1-8b-instant' }
  };

  const mapped = equivalentMap[currentModelId]?.[targetProvider];
  if (mapped) {
    return targetConfig.models.find(m => m.id === mapped) || targetConfig.models[0];
  }

  const byCapability = targetConfig.models.find(m =>
    m.reasoning === currentModel.reasoning &&
    m.input.includes('text')
  );

  return byCapability || targetConfig.models[0];
}

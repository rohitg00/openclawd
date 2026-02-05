/**
 * Model Fallback System - Automatic provider failover
 */

import { BUILT_IN_PROVIDERS, resolveApiKey } from './provider-registry.js';
import {
  loadAuthProfiles,
  saveAuthProfiles,
  isProfileInCooldown,
  listProfilesForProvider,
  markProfileUsed,
  markProfileFailure,
  getNextAvailableProfile,
  resolveApiKeyForProfile
} from './auth-profiles.js';
import { findEquivalentModel } from './model-selection.js';
import { FAILURE_TYPES } from './types.js';

export const DEFAULT_FALLBACKS = {
  anthropic: ['openai', 'google', 'groq', 'deepseek'],
  openai: ['anthropic', 'google', 'groq', 'deepseek'],
  google: ['anthropic', 'openai', 'groq', 'deepseek'],
  groq: ['anthropic', 'openai', 'google', 'deepseek'],
  deepseek: ['anthropic', 'openai', 'groq', 'google'],
  mistral: ['anthropic', 'openai', 'groq'],
  xai: ['anthropic', 'openai', 'groq']
};

export function categorizeError(error) {
  const msg = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode;

  if (status === 401 || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('authentication')) {
    return FAILURE_TYPES.AUTH;
  }

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('quota exceeded')) {
    return FAILURE_TYPES.RATE_LIMIT;
  }

  if (status === 402 || msg.includes('billing') || msg.includes('payment') || msg.includes('insufficient') || msg.includes('credit')) {
    return FAILURE_TYPES.BILLING;
  }

  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset') || msg.includes('socket hang up')) {
    return FAILURE_TYPES.TIMEOUT;
  }

  return FAILURE_TYPES.UNKNOWN;
}

export function isProviderAvailable(provider, authStore = null) {
  if (resolveApiKey(provider)) return true;

  if (authStore) {
    const profiles = listProfilesForProvider(authStore, provider);
    const available = profiles.some(id => !isProfileInCooldown(authStore, id));
    if (available) return true;
  }

  const config = BUILT_IN_PROVIDERS[provider];
  if (config?.requiresAuth === false) return true;

  return false;
}

export function getApiKeyForProvider(provider, authStore = null) {
  const envAuth = resolveApiKey(provider);
  if (envAuth?.apiKey) {
    return { apiKey: envAuth.apiKey, source: envAuth.source };
  }

  if (authStore) {
    const profileId = getNextAvailableProfile(authStore, provider);
    if (profileId) {
      const key = resolveApiKeyForProfile(authStore, profileId);
      if (key) {
        return { apiKey: key, source: `profile:${profileId}`, profileId };
      }
    }
  }

  return null;
}

export async function runWithFallback(params) {
  const {
    provider,
    model,
    fallbacks = DEFAULT_FALLBACKS[provider] || [],
    run,
    configDir,
    onFallback,
    onError
  } = params;

  const authStore = configDir ? loadAuthProfiles(configDir) : null;

  const candidates = [
    { provider, model },
    ...fallbacks.map(p => ({
      provider: p,
      model: findEquivalentModel(provider, model, p)?.id || null
    }))
  ];

  const attempts = [];

  for (const candidate of candidates) {
    if (!isProviderAvailable(candidate.provider, authStore)) {
      attempts.push({
        provider: candidate.provider,
        skipped: true,
        reason: 'no_auth'
      });
      continue;
    }

    const auth = getApiKeyForProvider(candidate.provider, authStore);
    if (!auth && BUILT_IN_PROVIDERS[candidate.provider]?.requiresAuth !== false) {
      attempts.push({
        provider: candidate.provider,
        skipped: true,
        reason: 'no_api_key'
      });
      continue;
    }

    try {
      if (candidate.provider !== provider && onFallback) {
        onFallback({
          from: { provider, model },
          to: { provider: candidate.provider, model: candidate.model }
        });
      }

      const result = await run(candidate.provider, candidate.model, auth?.apiKey);

      if (authStore && auth?.profileId) {
        markProfileUsed(authStore, auth.profileId);
        if (configDir) saveAuthProfiles(configDir, authStore);
      }

      return {
        result,
        provider: candidate.provider,
        model: candidate.model,
        attempts,
        fallbackUsed: candidate.provider !== provider
      };

    } catch (error) {
      const failureType = categorizeError(error);

      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: error.message,
        failureType,
        timestamp: Date.now()
      });

      if (authStore && auth?.profileId) {
        markProfileFailure(authStore, auth.profileId, failureType);
        if (configDir) saveAuthProfiles(configDir, authStore);
      }

      if (onError) {
        onError({
          provider: candidate.provider,
          model: candidate.model,
          error,
          failureType,
          willRetry: candidates.indexOf(candidate) < candidates.length - 1
        });
      }

      if (failureType === FAILURE_TYPES.AUTH && !auth?.profileId) {
        console.error(`[Fallback] ${candidate.provider}: Auth error, skipping provider entirely`);
      }
    }
  }

  const errorSummary = attempts
    .filter(a => a.error)
    .map(a => `${a.provider}: ${a.error}`)
    .join('; ');

  throw new Error(`All providers failed. Attempts: ${errorSummary || 'none'}`);
}

export function getFallbackChain(provider, customFallbacks = null) {
  const chain = customFallbacks || DEFAULT_FALLBACKS[provider] || [];
  return [provider, ...chain];
}

export function setCustomFallbacks(provider, fallbacks) {
  DEFAULT_FALLBACKS[provider] = fallbacks;
}

/**
 * Auth Profiles System - Multi-credential management with cooldowns
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { CREDENTIAL_TYPES } from './types.js';

const AUTH_PROFILES_FILE = 'auth-profiles.json';

export function getAuthProfilesPath(configDir) {
  return path.join(configDir, AUTH_PROFILES_FILE);
}

export function loadAuthProfiles(configDir) {
  const filePath = getAuthProfilesPath(configDir);
  if (!existsSync(filePath)) {
    return {
      version: 1,
      profiles: {},
      order: {},
      usageStats: {}
    };
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[AuthProfiles] Failed to load:', error.message);
    return { version: 1, profiles: {}, order: {}, usageStats: {} };
  }
}

export function saveAuthProfiles(configDir, store) {
  const filePath = getAuthProfilesPath(configDir);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(store, null, 2));
}

export function addProfile(store, profileId, credential) {
  store.profiles[profileId] = {
    type: credential.type || CREDENTIAL_TYPES.API_KEY,
    ...credential,
    createdAt: Date.now()
  };

  const provider = profileId.split(':')[0];
  if (!store.order[provider]) {
    store.order[provider] = [];
  }
  if (!store.order[provider].includes(profileId)) {
    store.order[provider].push(profileId);
  }

  return store;
}

export function removeProfile(store, profileId) {
  delete store.profiles[profileId];
  delete store.usageStats?.[profileId];

  const provider = profileId.split(':')[0];
  if (store.order[provider]) {
    store.order[provider] = store.order[provider].filter(id => id !== profileId);
  }

  return store;
}

export function listProfilesForProvider(store, provider) {
  return Object.keys(store.profiles).filter(id => id.startsWith(`${provider}:`));
}

export function resolveApiKeyForProfile(store, profileId) {
  const cred = store.profiles[profileId];
  if (!cred) return null;

  if (cred.type === CREDENTIAL_TYPES.API_KEY) return cred.key;
  if (cred.type === CREDENTIAL_TYPES.TOKEN) return cred.token;
  if (cred.type === CREDENTIAL_TYPES.OAUTH) return cred.access;

  return null;
}

export function isProfileInCooldown(store, profileId) {
  const stats = store.usageStats?.[profileId];
  if (!stats?.cooldownUntil) return false;
  return Date.now() < stats.cooldownUntil;
}

export function getCooldownRemaining(store, profileId) {
  const stats = store.usageStats?.[profileId];
  if (!stats?.cooldownUntil) return 0;
  const remaining = stats.cooldownUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function markProfileUsed(store, profileId) {
  if (!store.usageStats) store.usageStats = {};
  store.usageStats[profileId] = {
    ...store.usageStats[profileId],
    lastUsed: Date.now(),
    errorCount: 0,
    cooldownUntil: null,
    successCount: (store.usageStats[profileId]?.successCount || 0) + 1
  };
  return store;
}

export function markProfileFailure(store, profileId, failureType) {
  if (!store.usageStats) store.usageStats = {};
  const stats = store.usageStats[profileId] || { errorCount: 0, successCount: 0 };
  const errorCount = (stats.errorCount || 0) + 1;

  const backoffMs = Math.min(60000 * Math.pow(5, errorCount - 1), 3600000);

  let cooldownMs;
  switch (failureType) {
    case 'billing':
      cooldownMs = Math.min(backoffMs * 5, 86400000);
      break;
    case 'auth':
      cooldownMs = 86400000;
      break;
    case 'rate_limit':
      cooldownMs = backoffMs;
      break;
    case 'timeout':
      cooldownMs = Math.min(backoffMs / 2, 300000);
      break;
    default:
      cooldownMs = backoffMs;
  }

  store.usageStats[profileId] = {
    ...stats,
    errorCount,
    lastFailure: Date.now(),
    lastFailureType: failureType,
    cooldownUntil: Date.now() + cooldownMs
  };

  return store;
}

export function resetProfileCooldown(store, profileId) {
  if (store.usageStats?.[profileId]) {
    store.usageStats[profileId].cooldownUntil = null;
    store.usageStats[profileId].errorCount = 0;
  }
  return store;
}

export function orderProfilesByAvailability(store, profileIds) {
  const available = [];
  const inCooldown = [];

  for (const id of profileIds) {
    if (isProfileInCooldown(store, id)) {
      inCooldown.push(id);
    } else {
      available.push(id);
    }
  }

  available.sort((a, b) =>
    (store.usageStats?.[a]?.lastUsed || 0) - (store.usageStats?.[b]?.lastUsed || 0)
  );

  inCooldown.sort((a, b) =>
    (store.usageStats?.[a]?.cooldownUntil || 0) - (store.usageStats?.[b]?.cooldownUntil || 0)
  );

  return [...available, ...inCooldown];
}

export function getNextAvailableProfile(store, provider) {
  const profiles = listProfilesForProvider(store, provider);
  if (profiles.length === 0) return null;

  const ordered = orderProfilesByAvailability(store, profiles);
  const available = ordered.find(id => !isProfileInCooldown(store, id));

  return available || null;
}

export function getProfileStats(store, profileId) {
  const stats = store.usageStats?.[profileId];
  const profile = store.profiles[profileId];

  if (!profile) return null;

  return {
    profileId,
    type: profile.type,
    createdAt: profile.createdAt,
    lastUsed: stats?.lastUsed,
    successCount: stats?.successCount || 0,
    errorCount: stats?.errorCount || 0,
    lastFailure: stats?.lastFailure,
    lastFailureType: stats?.lastFailureType,
    inCooldown: isProfileInCooldown(store, profileId),
    cooldownRemaining: getCooldownRemaining(store, profileId)
  };
}

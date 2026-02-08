import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAuthProfiles,
  addProfile,
  removeProfile,
  listProfilesForProvider,
  isProfileInCooldown,
  getProfileStats,
  markProfileUsed,
  markProfileFailure,
  resetProfileCooldown,
  getNextAvailableProfile,
  orderProfilesByAvailability
} from '../../server/providers/auth-profiles.js';

function emptyStore() {
  return { version: 1, profiles: {}, order: {}, usageStats: {} };
}

describe('addProfile', () => {
  it('adds a profile with api_key credential', () => {
    const store = emptyStore();
    addProfile(store, 'anthropic:main', { key: 'sk-ant-test' });
    expect(store.profiles['anthropic:main']).toBeDefined();
    expect(store.profiles['anthropic:main'].key).toBe('sk-ant-test');
    expect(store.profiles['anthropic:main'].createdAt).toBeGreaterThan(0);
  });

  it('adds profile to provider order list', () => {
    const store = emptyStore();
    addProfile(store, 'openai:work', { key: 'sk-test' });
    expect(store.order.openai).toContain('openai:work');
  });

  it('does not duplicate in order list on re-add', () => {
    const store = emptyStore();
    addProfile(store, 'openai:work', { key: 'sk-1' });
    addProfile(store, 'openai:work', { key: 'sk-2' });
    expect(store.order.openai.filter(id => id === 'openai:work').length).toBe(1);
  });
});

describe('removeProfile', () => {
  it('removes a profile and its stats', () => {
    const store = emptyStore();
    addProfile(store, 'anthropic:test', { key: 'sk-test' });
    markProfileUsed(store, 'anthropic:test');
    removeProfile(store, 'anthropic:test');
    expect(store.profiles['anthropic:test']).toBeUndefined();
  });

  it('removes from order list', () => {
    const store = emptyStore();
    addProfile(store, 'openai:a', { key: '1' });
    addProfile(store, 'openai:b', { key: '2' });
    removeProfile(store, 'openai:a');
    expect(store.order.openai).not.toContain('openai:a');
    expect(store.order.openai).toContain('openai:b');
  });
});

describe('listProfilesForProvider', () => {
  it('returns profiles matching provider prefix', () => {
    const store = emptyStore();
    addProfile(store, 'openai:a', { key: '1' });
    addProfile(store, 'openai:b', { key: '2' });
    addProfile(store, 'anthropic:c', { key: '3' });
    const result = listProfilesForProvider(store, 'openai');
    expect(result).toHaveLength(2);
    expect(result).toContain('openai:a');
    expect(result).toContain('openai:b');
  });

  it('returns empty array for unknown provider', () => {
    const store = emptyStore();
    expect(listProfilesForProvider(store, 'unknown')).toHaveLength(0);
  });
});

describe('cooldown system', () => {
  it('profile is not in cooldown by default', () => {
    const store = emptyStore();
    addProfile(store, 'openai:main', { key: 'test' });
    expect(isProfileInCooldown(store, 'openai:main')).toBe(false);
  });

  it('marks profile in cooldown after failure', () => {
    const store = emptyStore();
    addProfile(store, 'openai:main', { key: 'test' });
    markProfileFailure(store, 'openai:main', 'rate_limit');
    expect(isProfileInCooldown(store, 'openai:main')).toBe(true);
  });

  it('resets cooldown', () => {
    const store = emptyStore();
    addProfile(store, 'openai:main', { key: 'test' });
    markProfileFailure(store, 'openai:main', 'rate_limit');
    resetProfileCooldown(store, 'openai:main');
    expect(isProfileInCooldown(store, 'openai:main')).toBe(false);
  });

  it('auth failure sets long cooldown', () => {
    const store = emptyStore();
    addProfile(store, 'openai:main', { key: 'test' });
    markProfileFailure(store, 'openai:main', 'auth');
    const stats = store.usageStats['openai:main'];
    expect(stats.cooldownUntil - stats.lastFailure).toBe(86400000);
  });
});

describe('getProfileStats', () => {
  it('returns null for nonexistent profile', () => {
    const store = emptyStore();
    expect(getProfileStats(store, 'noexist')).toBeNull();
  });

  it('returns stats for existing profile', () => {
    const store = emptyStore();
    addProfile(store, 'openai:work', { key: 'test' });
    markProfileUsed(store, 'openai:work');
    const stats = getProfileStats(store, 'openai:work');
    expect(stats.successCount).toBe(1);
    expect(stats.inCooldown).toBe(false);
  });
});

describe('getNextAvailableProfile', () => {
  it('returns null when no profiles exist', () => {
    const store = emptyStore();
    expect(getNextAvailableProfile(store, 'openai')).toBeNull();
  });

  it('returns available profile skipping cooled-down ones', () => {
    const store = emptyStore();
    addProfile(store, 'openai:a', { key: '1' });
    addProfile(store, 'openai:b', { key: '2' });
    markProfileFailure(store, 'openai:a', 'rate_limit');
    const next = getNextAvailableProfile(store, 'openai');
    expect(next).toBe('openai:b');
  });

  it('returns null when all profiles are in cooldown', () => {
    const store = emptyStore();
    addProfile(store, 'openai:a', { key: '1' });
    markProfileFailure(store, 'openai:a', 'auth');
    expect(getNextAvailableProfile(store, 'openai')).toBeNull();
  });
});

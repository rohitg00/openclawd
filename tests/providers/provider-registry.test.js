import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PROVIDERS,
  resolveApiKey,
  getProviderConfig
} from '../../server/providers/provider-registry.js';

describe('BUILT_IN_PROVIDERS', () => {
  it('has at least 10 providers', () => {
    expect(Object.keys(BUILT_IN_PROVIDERS).length).toBeGreaterThanOrEqual(10);
  });

  it('each provider has baseUrl and api type', () => {
    for (const [name, config] of Object.entries(BUILT_IN_PROVIDERS)) {
      expect(config.baseUrl, `${name} missing baseUrl`).toBeDefined();
      expect(config.api, `${name} missing api`).toBeDefined();
    }
  });

  it('each provider has a models array', () => {
    for (const [name, config] of Object.entries(BUILT_IN_PROVIDERS)) {
      expect(Array.isArray(config.models), `${name} models not array`).toBe(true);
    }
  });

  it('models have required fields', () => {
    for (const [providerName, config] of Object.entries(BUILT_IN_PROVIDERS)) {
      for (const model of config.models) {
        expect(model.id, `${providerName} model missing id`).toBeDefined();
        expect(model.name, `${providerName}/${model.id} missing name`).toBeDefined();
      }
    }
  });
});

describe('resolveApiKey', () => {
  it('returns null for unknown provider', () => {
    expect(resolveApiKey('nonexistent')).toBeNull();
  });

  it('returns null when env key is not set', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(resolveApiKey('anthropic')).toBeNull();
    if (original) process.env.ANTHROPIC_API_KEY = original;
  });

  it('returns api key from env when set', () => {
    process.env.GROQ_API_KEY = 'gsk_test_key';
    const result = resolveApiKey('groq');
    expect(result).not.toBeNull();
    expect(result.apiKey).toBe('gsk_test_key');
    expect(result.source).toContain('env:');
    delete process.env.GROQ_API_KEY;
  });

  it('returns null for ollama (no auth required)', () => {
    const result = resolveApiKey('ollama');
    expect(result).not.toBeNull();
    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('none');
  });
});

describe('getProviderConfig', () => {
  it('returns config for known provider', () => {
    const config = getProviderConfig('anthropic');
    expect(config).not.toBeNull();
    expect(config.baseUrl).toContain('anthropic');
  });

  it('returns null for unknown provider', () => {
    expect(getProviderConfig('nonexistent')).toBeNull();
  });
});

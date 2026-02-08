import { describe, it, expect } from 'vitest';
import { parseModelRef } from '../../server/providers/model-selection.js';

describe('parseModelRef', () => {
  it('returns default anthropic model for null/undefined', () => {
    const result = parseModelRef(null);
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBeDefined();
  });

  it('returns default for empty string', () => {
    const result = parseModelRef('');
    expect(result.provider).toBe('anthropic');
  });

  it('parses provider/model format', () => {
    const result = parseModelRef('openai/gpt-4o');
    expect(result.provider).toBe('openai');
    expect(result.modelId).toBe('gpt-4o');
  });

  it('handles nested model paths with multiple slashes', () => {
    const result = parseModelRef('google/models/gemini-pro');
    expect(result.provider).toBe('google');
    expect(result.modelId).toBe('models/gemini-pro');
  });

  it('falls back to anthropic for bare model id not found in providers', () => {
    const result = parseModelRef('some-unknown-model');
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('some-unknown-model');
  });
});

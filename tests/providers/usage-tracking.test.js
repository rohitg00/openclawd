import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackUsage,
  getUsageKey,
  getUsageForProvider,
  getUsageSummary,
  formatUsageLine,
  clearUsageCache,
  getUsageStats
} from '../../server/providers/usage-tracking.js';

beforeEach(() => {
  clearUsageCache();
});

describe('getUsageKey', () => {
  it('creates key with provider and date', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    const key = getUsageKey('anthropic', date);
    expect(key).toBe('anthropic:2025-06-15');
  });

  it('uses current date by default', () => {
    const key = getUsageKey('openai');
    const today = new Date().toISOString().slice(0, 10);
    expect(key).toBe(`openai:${today}`);
  });
});

describe('trackUsage', () => {
  it('tracks token counts', () => {
    const result = trackUsage('anthropic', 'claude-opus', 1000, 500);
    expect(result.input).toBe(1000);
    expect(result.output).toBe(500);
    expect(result.requests).toBe(1);
  });

  it('accumulates across multiple calls', () => {
    trackUsage('anthropic', 'claude-opus', 1000, 500);
    const result = trackUsage('anthropic', 'claude-opus', 2000, 1000);
    expect(result.input).toBe(3000);
    expect(result.output).toBe(1500);
    expect(result.requests).toBe(2);
  });

  it('tracks per-model breakdown', () => {
    trackUsage('anthropic', 'claude-opus', 1000, 500);
    trackUsage('anthropic', 'claude-sonnet', 2000, 1000);
    const result = trackUsage('anthropic', 'claude-opus', 500, 250);

    expect(result.models['claude-opus'].input).toBe(1500);
    expect(result.models['claude-opus'].requests).toBe(2);
    expect(result.models['claude-sonnet'].input).toBe(2000);
    expect(result.models['claude-sonnet'].requests).toBe(1);
  });
});

describe('getUsageForProvider', () => {
  it('returns null for untracked provider', () => {
    const result = getUsageForProvider('unknown');
    expect(result).toBeNull();
  });

  it('returns usage after tracking', () => {
    trackUsage('anthropic', 'claude-opus', 1000, 500);
    const result = getUsageForProvider('anthropic');
    expect(result).not.toBeNull();
    expect(result.input).toBe(1000);
  });
});

describe('getUsageSummary', () => {
  it('returns empty array with no usage', () => {
    const result = getUsageSummary();
    expect(result).toEqual([]);
  });

  it('returns summary sorted by requests', () => {
    trackUsage('openai', 'gpt-4o', 100, 50);
    trackUsage('anthropic', 'claude', 100, 50);
    trackUsage('anthropic', 'claude', 100, 50);

    const summary = getUsageSummary();
    expect(summary.length).toBe(2);
    expect(summary[0].provider).toBe('anthropic');
    expect(summary[0].requests).toBe(2);
  });
});

describe('formatUsageLine', () => {
  it('returns no usage message for empty summary', () => {
    expect(formatUsageLine([])).toBe('No usage today');
    expect(formatUsageLine(null)).toBe('No usage today');
  });
});

describe('getUsageStats', () => {
  it('returns zeroed stats with no usage', () => {
    const stats = getUsageStats();
    expect(stats.totalProviders).toBe(0);
    expect(stats.totalRequests).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it('aggregates stats across providers', () => {
    trackUsage('anthropic', 'claude', 1000, 500);
    trackUsage('openai', 'gpt-4o', 2000, 1000);

    const stats = getUsageStats();
    expect(stats.totalProviders).toBe(2);
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalTokens).toBe(4500);
    expect(stats.byProvider).toHaveProperty('anthropic');
    expect(stats.byProvider).toHaveProperty('openai');
  });
});

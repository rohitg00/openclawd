/**
 * Usage Tracking System - Quota monitoring and cost estimation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { BUILT_IN_PROVIDERS } from './provider-registry.js';

const usageCache = new Map();

const USAGE_FILE = 'usage-history.json';

export function getUsageKey(provider, date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  return `${provider}:${dateStr}`;
}

export function trackUsage(provider, model, inputTokens, outputTokens, metadata = {}) {
  const key = getUsageKey(provider);
  const current = usageCache.get(key) || {
    input: 0,
    output: 0,
    requests: 0,
    models: {},
    firstRequest: Date.now(),
    lastRequest: null
  };

  current.input += inputTokens;
  current.output += outputTokens;
  current.requests += 1;
  current.lastRequest = Date.now();

  if (!current.models[model]) {
    current.models[model] = { input: 0, output: 0, requests: 0 };
  }
  current.models[model].input += inputTokens;
  current.models[model].output += outputTokens;
  current.models[model].requests += 1;

  usageCache.set(key, current);

  return current;
}

export function getUsageForProvider(provider, date = new Date()) {
  const key = getUsageKey(provider, date);
  return usageCache.get(key) || null;
}

export function getUsageSummary(date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const summary = [];

  for (const [key, usage] of usageCache.entries()) {
    if (key.endsWith(dateStr)) {
      const provider = key.split(':')[0];
      const cost = estimateCost(provider, usage.input, usage.output);

      summary.push({
        provider,
        date: dateStr,
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: usage.input + usage.output,
        requests: usage.requests,
        models: usage.models,
        estimatedCost: cost,
        firstRequest: usage.firstRequest,
        lastRequest: usage.lastRequest
      });
    }
  }

  return summary.sort((a, b) => b.requests - a.requests);
}

export function estimateCost(provider, inputTokens, outputTokens) {
  const config = BUILT_IN_PROVIDERS[provider];
  if (!config?.models?.[0]?.cost) {
    return 0;
  }

  const avgCost = config.models.reduce((acc, m) => ({
    input: acc.input + (m.cost?.input || 0),
    output: acc.output + (m.cost?.output || 0)
  }), { input: 0, output: 0 });

  const modelCount = config.models.length;
  const inputCostPerMillion = avgCost.input / modelCount;
  const outputCostPerMillion = avgCost.output / modelCount;

  const cost = (inputTokens * inputCostPerMillion + outputTokens * outputCostPerMillion) / 1000000;
  return parseFloat(cost.toFixed(6));
}

export function estimateCostForModel(provider, modelId, inputTokens, outputTokens) {
  const config = BUILT_IN_PROVIDERS[provider];
  const model = config?.models?.find(m => m.id === modelId);

  if (!model?.cost) {
    return estimateCost(provider, inputTokens, outputTokens);
  }

  const cost = (inputTokens * model.cost.input + outputTokens * model.cost.output) / 1000000;
  return parseFloat(cost.toFixed(6));
}

export function formatUsageLine(summary) {
  if (!summary || summary.length === 0) {
    return 'No usage today';
  }

  const parts = summary.map(s => {
    const cost = s.estimatedCost > 0 ? `, $${s.estimatedCost.toFixed(4)}` : '';
    return `${s.provider}: ${s.requests} req${cost}`;
  });

  return `Today: ${parts.join(' | ')}`;
}

export function formatUsageDetailed(summary) {
  if (!summary || summary.length === 0) {
    return 'No usage recorded today.';
  }

  const lines = ['Usage Summary:', ''];
  let totalCost = 0;
  let totalRequests = 0;
  let totalTokens = 0;

  for (const s of summary) {
    lines.push(`${s.provider}:`);
    lines.push(`  Requests: ${s.requests}`);
    lines.push(`  Tokens: ${s.inputTokens.toLocaleString()} in / ${s.outputTokens.toLocaleString()} out`);
    if (s.estimatedCost > 0) {
      lines.push(`  Est. Cost: $${s.estimatedCost.toFixed(4)}`);
    }

    if (Object.keys(s.models).length > 1) {
      lines.push('  By Model:');
      for (const [model, usage] of Object.entries(s.models)) {
        lines.push(`    ${model}: ${usage.requests} req, ${usage.input + usage.output} tokens`);
      }
    }

    lines.push('');
    totalCost += s.estimatedCost;
    totalRequests += s.requests;
    totalTokens += s.totalTokens;
  }

  lines.push('─'.repeat(40));
  lines.push(`Total: ${totalRequests} requests, ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(4)}`);

  return lines.join('\n');
}

export function saveUsageHistory(configDir) {
  const filePath = path.join(configDir, USAGE_FILE);
  const dir = path.dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const history = {};
  for (const [key, value] of usageCache.entries()) {
    history[key] = value;
  }

  writeFileSync(filePath, JSON.stringify(history, null, 2));
}

export function loadUsageHistory(configDir) {
  const filePath = path.join(configDir, USAGE_FILE);

  if (!existsSync(filePath)) {
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const history = JSON.parse(content);

    for (const [key, value] of Object.entries(history)) {
      usageCache.set(key, value);
    }
  } catch (error) {
    console.error('[UsageTracking] Failed to load history:', error.message);
  }
}

export function clearUsageCache() {
  usageCache.clear();
}

export function getUsageStats() {
  const stats = {
    totalProviders: 0,
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    byProvider: {}
  };

  for (const [key, usage] of usageCache.entries()) {
    const provider = key.split(':')[0];

    if (!stats.byProvider[provider]) {
      stats.byProvider[provider] = { requests: 0, tokens: 0, cost: 0 };
      stats.totalProviders++;
    }

    stats.byProvider[provider].requests += usage.requests;
    stats.byProvider[provider].tokens += usage.input + usage.output;
    stats.byProvider[provider].cost += estimateCost(provider, usage.input, usage.output);

    stats.totalRequests += usage.requests;
    stats.totalTokens += usage.input + usage.output;
    stats.totalCost += estimateCost(provider, usage.input, usage.output);
  }

  return stats;
}

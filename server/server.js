import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getProvider, getAvailableProviders, initializeProviders } from './providers/index.js';
import {
  loadMcpServers,
  addMcpServer,
  updateMcpServer,
  enableMcpServer,
  removeMcpServer,
  listConfiguredServers,
  getServerConfig
} from './mcp-loader.js';
import {
  MCP_CATALOG,
  MCP_CATEGORIES,
  getRecommendedServers,
  getServersByCategory,
  getAllServers,
  getAvailableServers,
  generateServerConfig
} from './mcp-catalog.js';
import {
  getAvailableProviders as getLlmProviders,
  discoverOllamaModels,
  discoverVeniceModels,
  getProviderConfig,
  BUILT_IN_PROVIDERS
} from './providers/provider-registry.js';
import { parseModelRef, listAvailableModels } from './providers/model-selection.js';
import {
  loadAuthProfiles,
  saveAuthProfiles,
  listProfilesForProvider,
  isProfileInCooldown,
  getProfileStats,
  addProfile,
  removeProfile
} from './providers/auth-profiles.js';
import {
  trackUsage,
  getUsageSummary,
  formatUsageLine,
  formatUsageDetailed,
  loadUsageHistory,
  saveUsageHistory,
  getUsageStats
} from './providers/usage-tracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = process.env.OPENCLAWD_USER_DATA || __dirname;
const envFilePath = process.env.OPENCLAWD_envFilePath || path.join(__dirname, '..', '.env');

dotenv.config({ path: envFilePath });

const app = express();
const PORT = process.env.PORT || 3001;

let mcpServers = {};

async function initializeMcpServers() {
  console.log('[MCP] Loading configuration...');
  mcpServers = loadMcpServers();
  console.log(`[MCP] ${Object.keys(mcpServers).length} server(s) configured`);
}

async function initializeLlmProviders() {
  console.log('[LLM] Discovering providers...');
  const providers = await getLlmProviders();
  console.log(`[LLM] ${providers.length} provider(s) available: ${providers.map(p => p.name).join(', ')}`);

  const ollamaModels = await discoverOllamaModels();
  if (ollamaModels.length > 0) {
    console.log(`[LLM] Discovered ${ollamaModels.length} Ollama model(s)`);
  }

  const veniceModels = await discoverVeniceModels();
  if (veniceModels.length > 0) {
    console.log(`[LLM] Discovered ${veniceModels.length} Venice model(s)`);
  }

  loadUsageHistory(configDir);
}

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const {
    message,
    chatId,
    userId = 'default-user',
    provider: providerName = 'claude',
    model = 'anthropic/claude-opus-4-5-20251101'
  } = req.body;

  const { provider: llmProvider, modelId } = parseModelRef(model);
  console.log('[CHAT] Request received:', message?.substring(0, 100));
  console.log('[CHAT] Chat ID:', chatId);
  console.log('[CHAT] LLM Provider:', llmProvider, '/', modelId);
  console.log('[CHAT] Backend Provider:', providerName);

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const availableProviders = getAvailableProviders();
  if (!availableProviders.includes(providerName.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid provider: ${providerName}. Available: ${availableProviders.join(', ')}`
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Processing request...', llmProvider, modelId })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  try {
    const provider = getProvider(providerName);

    console.log('[CHAT] Using provider:', provider.name);
    console.log('[CHAT] MCP servers:', Object.keys(mcpServers).join(', ') || 'none');

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const chunk of provider.query({
        prompt: message,
        chatId,
        userId,
        mcpServers,
        model: modelId,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Skill'],
        maxTurns: 100
      })) {
        if (chunk.type === 'tool_use') {
          console.log('[SSE] Sending tool_use:', chunk.name);
        }
        if (chunk.type === 'text') {
          console.log('[SSE] Sending text chunk, length:', chunk.content?.length || 0);
          outputTokens += Math.ceil((chunk.content?.length || 0) / 4);
        }
        if (chunk.type === 'usage') {
          inputTokens = chunk.inputTokens || inputTokens;
          outputTokens = chunk.outputTokens || outputTokens;
        }
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
      }
    } catch (streamError) {
      console.error('[CHAT] Stream error during iteration:', streamError);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message })}\n\n`);
      }
    }

    if (inputTokens > 0 || outputTokens > 0) {
      trackUsage(llmProvider, modelId, inputTokens, outputTokens);
      saveUsageHistory(configDir);
    }

    clearInterval(heartbeatInterval);
    if (!res.writableEnded) {
      res.end();
    }
    console.log('[CHAT] Stream completed');
  } catch (error) {
    clearInterval(heartbeatInterval);
    console.error('[CHAT] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/abort', (req, res) => {
  const { chatId, provider: providerName = 'claude' } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  console.log('[ABORT] Request to abort chatId:', chatId, 'provider:', providerName);

  try {
    const provider = getProvider(providerName);
    const aborted = provider.abort(chatId);

    if (aborted) {
      console.log('[ABORT] Successfully aborted chatId:', chatId);
      res.json({ success: true, message: 'Query aborted' });
    } else {
      console.log('[ABORT] No active query found for chatId:', chatId);
      res.json({ success: false, message: 'No active query to abort' });
    }
  } catch (error) {
    console.error('[ABORT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/providers', (_req, res) => {
  res.json({
    providers: getAvailableProviders(),
    default: 'claude'
  });
});

app.get('/api/llm/providers', async (_req, res) => {
  try {
    const providers = await getLlmProviders();
    res.json({
      providers,
      total: providers.length,
      builtIn: Object.keys(BUILT_IN_PROVIDERS).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/llm/models', async (_req, res) => {
  try {
    const models = await listAvailableModels();
    const available = models.filter(m => m.available);
    res.json({
      models,
      total: models.length,
      available: available.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/llm/providers/:provider', (req, res) => {
  const { provider } = req.params;
  const config = getProviderConfig(provider);

  if (!config) {
    return res.status(404).json({ error: `Provider not found: ${provider}` });
  }

  res.json({
    name: provider,
    ...config,
    models: config.models.map(m => ({
      ...m,
      ref: `${provider}/${m.id}`
    }))
  });
});

app.get('/api/llm/usage', (_req, res) => {
  const summary = getUsageSummary();
  const stats = getUsageStats();
  res.json({
    summary,
    formatted: formatUsageLine(summary),
    detailed: formatUsageDetailed(summary),
    stats
  });
});

app.get('/api/auth/profiles', (_req, res) => {
  try {
    const store = loadAuthProfiles(configDir);
    const profiles = Object.keys(store.profiles).map(id => ({
      id,
      ...getProfileStats(store, id)
    }));
    res.json({
      profiles,
      total: profiles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/profiles', (req, res) => {
  const { profileId, type, key, token, access } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'profileId is required (format: provider:name)' });
  }

  if (!profileId.includes(':')) {
    return res.status(400).json({ error: 'profileId must be in format provider:name' });
  }

  try {
    const store = loadAuthProfiles(configDir);
    const credential = { type: type || 'api_key' };

    if (key) credential.key = key;
    if (token) credential.token = token;
    if (access) credential.access = access;

    addProfile(store, profileId, credential);
    saveAuthProfiles(configDir, store);

    res.json({ success: true, profileId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/auth/profiles/:profileId', (req, res) => {
  const { profileId } = req.params;

  try {
    const store = loadAuthProfiles(configDir);
    removeProfile(store, profileId);
    saveAuthProfiles(configDir, store);

    res.json({ success: true, profileId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mcp/servers', (_req, res) => {
  res.json({
    servers: Object.keys(mcpServers).map(name => ({
      name,
      type: mcpServers[name].type,
      enabled: true
    })),
    total: Object.keys(mcpServers).length
  });
});

// MCP Catalog - Browse available servers
app.get('/api/mcp/catalog', (_req, res) => {
  res.json({
    servers: getAllServers(),
    categories: MCP_CATEGORIES,
    total: Object.keys(MCP_CATALOG).length
  });
});

// MCP Recommended - Servers that work without auth
app.get('/api/mcp/recommended', (_req, res) => {
  const recommended = getRecommendedServers();
  res.json({
    servers: recommended,
    total: recommended.length,
    message: 'These servers work without API keys - just enable them!'
  });
});

// MCP Available - Servers that can be enabled based on current env vars
app.get('/api/mcp/available', (_req, res) => {
  const available = getAvailableServers();
  res.json({
    servers: available,
    total: available.length,
    message: 'These servers can be enabled with your current configuration'
  });
});

// MCP by Category
app.get('/api/mcp/catalog/:category', (req, res) => {
  const { category } = req.params;
  if (!MCP_CATEGORIES[category]) {
    return res.status(404).json({ error: `Category '${category}' not found` });
  }
  const servers = getServersByCategory(category);
  res.json({
    category: MCP_CATEGORIES[category],
    servers,
    total: servers.length
  });
});

// Generate config for a specific server
app.get('/api/mcp/config/:serverId', (req, res) => {
  const { serverId } = req.params;
  const config = generateServerConfig(serverId);
  if (!config) {
    return res.status(404).json({ error: `Server '${serverId}' not found in catalog` });
  }
  res.json({
    serverId,
    config,
    usage: `Add this to your mcp-servers.json: "${serverId}": ${JSON.stringify(config, null, 2)}`
  });
});

app.get('/api/mcp/configured', (_req, res) => {
  const servers = listConfiguredServers();
  res.json({
    servers,
    total: servers.length,
    message: 'All servers in mcp-servers.json (enabled and disabled)'
  });
});

app.get('/api/mcp/configured/:serverId', (req, res) => {
  const { serverId } = req.params;
  const config = getServerConfig(serverId);
  if (!config) {
    return res.status(404).json({ error: `Server '${serverId}' not found in configuration` });
  }
  res.json({ serverId, config });
});

app.post('/api/mcp/servers', (req, res) => {
  const { serverId, type, command, args, url, headers, env, enabled = true, force = false, _description } = req.body;

  if (!serverId) {
    return res.status(400).json({ error: 'serverId is required' });
  }

  if (!type || !['stdio', 'http'].includes(type)) {
    return res.status(400).json({ error: 'type must be "stdio" or "http"' });
  }

  if (type === 'stdio' && !command) {
    return res.status(400).json({ error: 'command is required for stdio servers' });
  }

  if (type === 'http' && !url) {
    return res.status(400).json({ error: 'url is required for http servers' });
  }

  const serverConfig = { type, enabled, force };
  if (type === 'stdio') {
    serverConfig.command = command;
    serverConfig.args = args || [];
    if (env) serverConfig.env = env;
  } else {
    serverConfig.url = url;
    if (headers) serverConfig.headers = headers;
  }
  if (_description) serverConfig._description = _description;

  const result = addMcpServer(serverId, serverConfig);

  if (!result.success) {
    return res.status(400).json(result);
  }

  mcpServers = loadMcpServers();
  res.json({
    ...result,
    tip: 'Server added. Restart to apply changes, or use PUT to enable/disable.'
  });
});

app.post('/api/mcp/servers/from-catalog/:serverId', (req, res) => {
  const { serverId } = req.params;
  const { enabled = true, force = false } = req.body;

  const catalogConfig = generateServerConfig(serverId);
  if (!catalogConfig) {
    return res.status(404).json({ error: `Server '${serverId}' not found in catalog` });
  }

  const serverConfig = { ...catalogConfig, enabled, force };
  const result = addMcpServer(serverId, serverConfig);

  if (!result.success) {
    return res.status(400).json(result);
  }

  mcpServers = loadMcpServers();
  res.json({
    ...result,
    config: catalogConfig,
    tip: 'Server added from catalog. Restart to apply changes.'
  });
});

app.put('/api/mcp/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const updates = req.body;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  const result = updateMcpServer(serverId, updates);

  if (!result.success) {
    return res.status(404).json(result);
  }

  mcpServers = loadMcpServers();
  res.json({
    ...result,
    tip: 'Server updated. Restart to apply changes.'
  });
});

app.put('/api/mcp/servers/:serverId/enable', (req, res) => {
  const { serverId } = req.params;
  const result = enableMcpServer(serverId, true);

  if (!result.success) {
    return res.status(404).json(result);
  }

  mcpServers = loadMcpServers();
  res.json({
    ...result,
    enabled: true,
    tip: 'Server enabled. Restart to apply changes.'
  });
});

app.put('/api/mcp/servers/:serverId/disable', (req, res) => {
  const { serverId } = req.params;
  const result = enableMcpServer(serverId, false);

  if (!result.success) {
    return res.status(404).json(result);
  }

  mcpServers = loadMcpServers();
  res.json({
    ...result,
    enabled: false,
    tip: 'Server disabled. Restart to apply changes.'
  });
});

app.delete('/api/mcp/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const result = removeMcpServer(serverId);

  if (!result.success) {
    return res.status(404).json(result);
  }

  mcpServers = loadMcpServers();
  res.json(result);
});

app.get('/api/mcp/config', (_req, res) => {
  const configPath = process.env.OPENCLAWD_MCP_CONFIG_PATH || path.join(__dirname, 'mcp-servers.json');
  try {
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');
      res.json({ config: JSON.parse(content) });
    } else {
      res.json({ config: {} });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config: ' + err.message });
  }
});

app.put('/api/mcp/config', (req, res) => {
  const { config } = req.body;
  const configPath = process.env.OPENCLAWD_MCP_CONFIG_PATH || path.join(__dirname, 'mcp-servers.json');

  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'config object is required' });
  }

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    mcpServers = loadMcpServers();
    res.json({ success: true, message: 'Configuration saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save config: ' + err.message });
  }
});

app.get('/api/health', async (_req, res) => {
  const llmProviders = await getLlmProviders();
  const summary = getUsageSummary();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: getAvailableProviders(),
    llmProviders: llmProviders.length,
    mcpServers: Object.keys(mcpServers).length,
    usage: formatUsageLine(summary)
  });
});

import { readFileSync, writeFileSync, existsSync } from 'fs';

function loadEnvFile() {
  if (!existsSync(envFilePath)) return {};
  const content = readFileSync(envFilePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      env[key] = value;
    }
  }
  return env;
}

function saveEnvFile(env) {
  const lines = [];
  lines.push('# OpenClawd Configuration');
  lines.push('# Generated by Settings UI');
  lines.push('');
  for (const [key, value] of Object.entries(env)) {
    if (value) lines.push(`${key}=${value}`);
  }
  writeFileSync(envFilePath, lines.join('\n') + '\n');
}

app.get('/api/settings', (_req, res) => {
  const env = loadEnvFile();
  const masked = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) {
      masked[key] = value ? '••••••••' + value.slice(-4) : '';
    } else {
      masked[key] = value;
    }
  }
  res.json({
    settings: masked,
    configured: Object.keys(env).filter(k => env[k]).length
  });
});

app.post('/api/settings', (req, res) => {
  const { apiKeys = {}, general = {} } = req.body;

  const env = loadEnvFile();

  const keyMap = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    xai: 'XAI_API_KEY',
    venice: 'VENICE_API_KEY'
  };

  for (const [provider, key] of Object.entries(apiKeys)) {
    const envKey = keyMap[provider];
    if (envKey && key && !key.includes('••••')) {
      env[envKey] = key;
    }
  }

  if (general.backendUrl) {
    env.BACKEND_URL = general.backendUrl;
  }

  saveEnvFile(env);

  Object.assign(process.env, env);

  res.json({
    success: true,
    message: 'Settings saved. Restart server for full effect.',
    configured: Object.keys(env).filter(k => env[k]).length
  });
});

app.get('/api/settings/providers-status', async (_req, res) => {
  const env = loadEnvFile();
  const status = {};

  const checks = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    xai: 'XAI_API_KEY',
    venice: 'VENICE_API_KEY'
  };

  for (const [provider, envKey] of Object.entries(checks)) {
    status[provider] = !!env[envKey];
  }

  res.json({ status });
});

await initializeProviders();
await initializeMcpServers();
await initializeLlmProviders();

const server = app.listen(PORT, () => {
  console.log(`\n✓ Backend server running on http://localhost:${PORT}`);
  console.log(`✓ Chat endpoint: POST http://localhost:${PORT}/api/chat`);
  console.log(`✓ LLM Providers: GET http://localhost:${PORT}/api/llm/providers`);
  console.log(`✓ LLM Models: GET http://localhost:${PORT}/api/llm/models`);
  console.log(`✓ Usage Stats: GET http://localhost:${PORT}/api/llm/usage`);
  console.log(`✓ Auth Profiles: GET http://localhost:${PORT}/api/auth/profiles`);
  console.log(`✓ MCP Servers: GET http://localhost:${PORT}/api/mcp/servers`);
  console.log(`✓ MCP Catalog: GET http://localhost:${PORT}/api/mcp/catalog`);
  console.log(`✓ MCP Add Server: POST http://localhost:${PORT}/api/mcp/servers`);
  console.log(`✓ MCP Add from Catalog: POST http://localhost:${PORT}/api/mcp/servers/from-catalog/:id`);
  console.log(`✓ Health check: GET http://localhost:${PORT}/api/health`);
  console.log(`✓ Available backend providers: ${getAvailableProviders().join(', ')}\n`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  saveUsageHistory(configDir);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

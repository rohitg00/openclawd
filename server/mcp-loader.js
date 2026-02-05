/**
 * MCP Server Configuration Loader
 * Loads MCP servers from mcp-servers.json with environment variable substitution
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONFIG_PATH = path.join(__dirname, 'mcp-servers.json');

export function loadMcpServers(configPath = DEFAULT_CONFIG_PATH) {
  const filePath = configPath;

  if (!existsSync(filePath)) {
    console.log('[MCP] No mcp-servers.json found at:', filePath);
    return {};
  }

  try {
    let content = readFileSync(filePath, 'utf-8');

    content = content.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const value = process.env[key];
      if (!value) {
        console.log(`[MCP] Warning: Environment variable ${key} not set`);
      }
      return value || '';
    });

    const config = JSON.parse(content);
    const mcpServers = {};
    let loadedCount = 0;
    let skippedCount = 0;

    for (const [name, serverConfig] of Object.entries(config)) {
      if (name.startsWith('_')) continue;

      if (serverConfig.enabled === false) {
        skippedCount++;
        continue;
      }

      if (serverConfig.type === 'http' || serverConfig.type === 'remote') {
        if (!serverConfig.url) {
          console.log(`[MCP] Skipping ${name}: missing url`);
          skippedCount++;
          continue;
        }

        mcpServers[name] = {
          type: 'http',
          url: serverConfig.url,
          headers: serverConfig.headers || {}
        };
        loadedCount++;
        console.log(`[MCP] Loaded: ${name} (HTTP)`);

      } else if (serverConfig.type === 'stdio') {
        if (!serverConfig.command) {
          console.log(`[MCP] Skipping ${name}: missing command`);
          skippedCount++;
          continue;
        }

        mcpServers[name] = {
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {}
        };
        loadedCount++;
        console.log(`[MCP] Loaded: ${name} (stdio)`);

      } else {
        console.log(`[MCP] Skipping ${name}: unknown type ${serverConfig.type}`);
        skippedCount++;
      }
    }

    console.log(`[MCP] ${loadedCount} server(s) loaded, ${skippedCount} skipped`);
    return mcpServers;

  } catch (error) {
    console.error('[MCP] Config error:', error.message);
    return {};
  }
}

export function getMcpServerConfig(mcpServers, serverName) {
  return mcpServers[serverName] || null;
}

export function listMcpServers(mcpServers) {
  return Object.keys(mcpServers);
}

export function validateMcpConfig(configPath) {
  if (!existsSync(configPath)) {
    return { valid: false, error: 'File not found' };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function loadRawConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function addMcpServer(serverId, serverConfig, configPath = DEFAULT_CONFIG_PATH) {
  if (!serverId || typeof serverId !== 'string') {
    return { success: false, error: 'serverId must be a non-empty string' };
  }

  if (!serverConfig || typeof serverConfig !== 'object') {
    return { success: false, error: 'serverConfig must be an object' };
  }

  if (!serverConfig.type || !['stdio', 'http'].includes(serverConfig.type)) {
    return { success: false, error: 'serverConfig.type must be "stdio" or "http"' };
  }

  if (serverConfig.type === 'stdio' && !serverConfig.command) {
    return { success: false, error: 'stdio servers require a command' };
  }

  if (serverConfig.type === 'http' && !serverConfig.url) {
    return { success: false, error: 'http servers require a url' };
  }

  const config = loadRawConfig(configPath);

  if (config[serverId] && !serverConfig.force) {
    return { success: false, error: `Server '${serverId}' already exists. Use force: true to overwrite.` };
  }

  const { force, ...cleanConfig } = serverConfig;
  config[serverId] = {
    ...cleanConfig,
    enabled: cleanConfig.enabled !== false
  };

  try {
    saveConfig(config, configPath);
    return { success: true, serverId, message: `Server '${serverId}' added successfully` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function updateMcpServer(serverId, updates, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadRawConfig(configPath);

  if (!config[serverId]) {
    return { success: false, error: `Server '${serverId}' not found` };
  }

  config[serverId] = { ...config[serverId], ...updates };

  try {
    saveConfig(config, configPath);
    return { success: true, serverId, message: `Server '${serverId}' updated successfully` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function enableMcpServer(serverId, enabled = true, configPath = DEFAULT_CONFIG_PATH) {
  return updateMcpServer(serverId, { enabled }, configPath);
}

export function removeMcpServer(serverId, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadRawConfig(configPath);

  if (!config[serverId]) {
    return { success: false, error: `Server '${serverId}' not found` };
  }

  delete config[serverId];

  try {
    saveConfig(config, configPath);
    return { success: true, serverId, message: `Server '${serverId}' removed successfully` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function listConfiguredServers(configPath = DEFAULT_CONFIG_PATH) {
  const config = loadRawConfig(configPath);
  return Object.entries(config)
    .filter(([name]) => !name.startsWith('_'))
    .map(([id, cfg]) => ({
      id,
      type: cfg.type,
      enabled: cfg.enabled !== false,
      description: cfg._description || null
    }));
}

export function getServerConfig(serverId, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadRawConfig(configPath);
  return config[serverId] || null;
}

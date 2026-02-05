/**
 * MCP Server Configuration Loader for Clawd
 * Loads MCP servers from mcp-servers.json with environment variable substitution
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadMcpServers(configPath = null) {
  const defaultPath = path.join(__dirname, 'mcp-servers.json');
  const filePath = configPath || defaultPath;

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

    for (const [name, serverConfig] of Object.entries(config)) {
      if (name.startsWith('_')) continue;
      if (serverConfig.enabled === false) continue;

      if (serverConfig.type === 'http' || serverConfig.type === 'remote') {
        if (!serverConfig.url) continue;
        mcpServers[name] = {
          type: 'http',
          url: serverConfig.url,
          headers: serverConfig.headers || {}
        };
        loadedCount++;
        console.log(`[MCP] Loaded: ${name} (HTTP)`);
      } else if (serverConfig.type === 'stdio') {
        if (!serverConfig.command) continue;
        mcpServers[name] = {
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {}
        };
        loadedCount++;
        console.log(`[MCP] Loaded: ${name} (stdio)`);
      }
    }

    console.log(`[MCP] ${loadedCount} server(s) loaded`);
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

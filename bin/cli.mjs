#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { fork } from 'child_process';
import * as p from '@clack/prompts';
import color from 'picocolors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, '..', 'server', 'server.js');
const envFilePath = path.join(__dirname, '..', '.env');

const PORT = process.env.PORT || 3001;

function printBanner() {
  const width = process.stdout.columns || 80;
  const logo = width >= 60
    ? `
  ${color.yellow('╔═══════════════════════════════════════╗')}
  ${color.yellow('║')}        ${color.bold(color.yellow('OpenClawd'))} ${color.dim('Server')}           ${color.yellow('║')}
  ${color.yellow('║')}  ${color.dim('20+ LLM Providers · MCP Integrations')} ${color.yellow('║')}
  ${color.yellow('╚═══════════════════════════════════════╝')}
`
    : `\n  ${color.bold(color.yellow('OpenClawd'))} ${color.dim('Server')}\n`;

  console.log(logo);
}

function loadEnvFile() {
  if (!fs.existsSync(envFilePath)) return {};
  const content = fs.readFileSync(envFilePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
    }
  }
  return env;
}

function saveEnvFile(env) {
  const lines = ['# OpenClawd Configuration', ''];
  for (const [key, value] of Object.entries(env)) {
    if (value) lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(envFilePath, lines.join('\n') + '\n');
}

function isFirstRun() {
  return !fs.existsSync(envFilePath);
}

async function runOnboarding() {
  p.intro(color.bgYellow(color.black(' OpenClawd Setup ')));

  const shouldSetup = await p.confirm({
    message: 'This looks like your first run. Set up API keys now?',
    initialValue: true,
  });

  if (p.isCancel(shouldSetup) || !shouldSetup) {
    saveEnvFile(loadEnvFile());
    p.log.info('Skipping setup. You can configure keys later via the Settings UI.');
    p.outro(color.dim('Starting server...'));
    return;
  }

  const env = loadEnvFile();

  const keys = await p.group({
    anthropic: () => p.password({
      message: `Anthropic API key ${color.dim('(recommended)')}`,
      validate: () => undefined,
    }),
    openai: () => p.password({
      message: `OpenAI API key ${color.dim('(optional)')}`,
      validate: () => undefined,
    }),
    gemini: () => p.password({
      message: `Google Gemini API key ${color.dim('(optional)')}`,
      validate: () => undefined,
    }),
  }, {
    onCancel: () => {
      p.log.info('Setup cancelled.');
    }
  });

  if (p.isCancel(keys)) {
    saveEnvFile(loadEnvFile());
    p.outro(color.dim('Starting server...'));
    return;
  }

  if (keys.anthropic) env.ANTHROPIC_API_KEY = keys.anthropic;
  if (keys.openai) env.OPENAI_API_KEY = keys.openai;
  if (keys.gemini) env.GEMINI_API_KEY = keys.gemini;

  const configured = [
    keys.anthropic && 'Anthropic',
    keys.openai && 'OpenAI',
    keys.gemini && 'Gemini',
  ].filter(Boolean);

  const s = p.spinner();
  s.start('Saving configuration');
  saveEnvFile(env);
  if (configured.length > 0) {
    s.stop(`Saved ${configured.length} key(s): ${configured.join(', ')}`);
  } else {
    s.stop('Configuration saved');
    p.log.info(
      `No keys added. You can use ${color.bold('Opencode')} provider for free models,\n  or run ${color.bold('Ollama')} locally for offline access.`
    );
  }

  const mcpSetup = await p.multiselect({
    message: 'Enable MCP servers? (space to toggle, enter to confirm)',
    options: [
      { value: 'filesystem', label: 'Filesystem', hint: 'Read/write local files' },
      { value: 'memory', label: 'Memory', hint: 'Persistent knowledge graph' },
      { value: 'fetch', label: 'Fetch', hint: 'Fetch web pages and APIs' },
      { value: 'brave-search', label: 'Brave Search', hint: 'Web search' },
    ],
    initialValues: ['filesystem'],
    required: false,
  });

  if (!p.isCancel(mcpSetup) && mcpSetup.length > 0) {
    p.log.success(`Will enable ${mcpSetup.length} MCP server(s) after server starts.`);
    process.env.__OPENCLAWD_ONBOARD_MCP = mcpSetup.join(',');
  }

  p.outro(color.green('Setup complete!'));
}

function getAuthHeaders() {
  const key = process.env.OPENCLAWD_API_KEY || loadEnvFile().OPENCLAWD_API_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function installMcpServers(servers) {
  const baseUrl = `http://localhost:${PORT}`;
  let serverHealthy = false;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        serverHealthy = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!serverHealthy) {
    console.error(`  ${color.red('!')} Server on port ${PORT} did not become healthy; skipping MCP install`);
    return;
  }

  const authHeaders = getAuthHeaders();

  for (const serverId of servers) {
    try {
      await fetch(`${baseUrl}/api/mcp/servers/from-catalog/${serverId}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ enabled: true }),
      });
      console.log(`  ${color.green('+')} MCP server ${color.bold(serverId)} installed`);
    } catch {
      console.log(`  ${color.yellow('!')} Failed to install ${serverId} (server may not have catalog entry)`);
    }
  }
}

function startServer() {
  printBanner();
  console.log(`  ${color.dim('Port:')} ${color.bold(String(PORT))}`);
  console.log(`  ${color.dim('API:')}  ${color.cyan(`http://localhost:${PORT}`)}`);
  console.log(`  ${color.dim('Health:')} ${color.cyan(`http://localhost:${PORT}/api/health`)}`);
  console.log();

  const child = fork(serverPath, [], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
  });

  child.on('error', (err) => {
    console.error(color.red('Failed to start server:'), err.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  let isShuttingDown = false;

  function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(color.dim('\nShutting down OpenClawd...'));
    child.kill('SIGINT');
    setTimeout(() => {
      child.kill('SIGTERM');
      process.exit(0);
    }, 5000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return child;
}

async function main() {
  if (isFirstRun()) {
    await runOnboarding();
  }

  startServer();

  const mcpToInstall = process.env.__OPENCLAWD_ONBOARD_MCP;
  if (mcpToInstall) {
    const servers = mcpToInstall.split(',').filter(Boolean);
    if (servers.length > 0) {
      await installMcpServers(servers);
    }
  }
}

main().catch((err) => {
  console.error(color.red('Error:'), err.message);
  process.exit(1);
});

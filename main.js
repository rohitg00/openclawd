const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      ignored: /server|node_modules/
    });
  } catch (err) {
    console.warn('Live reload unavailable:', err);
  }
}

let mainWindow;
let serverProcess = null;
let isShuttingDown = false;

const SERVER_PORT = 3456;
process.env.OPENCLAWD_SERVER_PORT = String(SERVER_PORT);
const userDataPath = app.getPath('userData');

function getServerDir() {
  if (isDev) {
    return path.join(__dirname, 'server');
  }
  return path.join(process.resourcesPath, 'server');
}

function getEnvExamplePath() {
  if (isDev) {
    return path.join(__dirname, '.env.example');
  }
  return path.join(process.resourcesPath, '.env.example');
}

function getMcpExamplePath() {
  if (isDev) {
    return path.join(__dirname, 'mcp-servers.example.json');
  }
  return path.join(process.resourcesPath, 'mcp-servers.example.json');
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

function saveEnvFile(envPath, env) {
  const lines = ['# OpenClawd Configuration', ''];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== null) lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, lines.join('\n') + '\n');
}

function ensureApiKey() {
  const envPath = path.join(userDataPath, '.env');
  const env = loadEnvFile(envPath);
  if (!env.OPENCLAWD_API_KEY) {
    const newApiKey = 'oc_' + crypto.randomBytes(32).toString('hex');
    env.OPENCLAWD_API_KEY = newApiKey;
    saveEnvFile(envPath, env);
    process.env.OPENCLAWD_API_KEY = newApiKey;
    console.log('[Config] Generated API key (saved to .env)');
  } else {
    process.env.OPENCLAWD_API_KEY = env.OPENCLAWD_API_KEY;
  }
}

function ensureConfigFiles() {
  const envPath = path.join(userDataPath, '.env');
  const mcpPath = path.join(userDataPath, 'mcp-servers.json');

  if (!fs.existsSync(envPath)) {
    const exampleEnv = getEnvExamplePath();
    if (fs.existsSync(exampleEnv)) {
      fs.copyFileSync(exampleEnv, envPath);
      console.log('[Config] Created .env from example at', envPath);
    }
  }

  ensureApiKey();

  if (!fs.existsSync(mcpPath)) {
    const exampleMcp = getMcpExamplePath();
    if (fs.existsSync(exampleMcp)) {
      fs.copyFileSync(exampleMcp, mcpPath);
      console.log('[Config] Created mcp-servers.json from example at', mcpPath);
    }
  }
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function probe() {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          retry();
        }
        res.resume();
      });

      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Server did not respond on port ${port} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(probe, 500);
    }

    probe();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverDir = getServerDir();
    const serverEntry = path.join(serverDir, 'server.js');

    if (!fs.existsSync(serverEntry)) {
      reject(new Error(`Server not found at ${serverEntry}`));
      return;
    }

    const envPath = path.join(userDataPath, '.env');
    const mcpPath = path.join(userDataPath, 'mcp-servers.json');

    const serverEnv = {
      ...process.env,
      PORT: String(SERVER_PORT),
      OPENCLAWD_USER_DATA: userDataPath,
      OPENCLAWD_ENV_PATH: envPath,
      OPENCLAWD_MCP_CONFIG_PATH: mcpPath
    };

    const execArgs = isDev
      ? ['node', [serverEntry]]
      : [process.execPath, ['--no-warnings', serverEntry]];

    serverProcess = spawn(execArgs[0], execArgs[1], {
      cwd: serverDir,
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      process.stdout.write(`[Server] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[Server:err] ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Server] Failed to start:', err);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[Server] Exited with code=${code} signal=${signal}`);
      serverProcess = null;
    });

    waitForServer(SERVER_PORT, 15000).then(resolve).catch(reject);
  });
}

function stopServer() {
  if (!serverProcess) return Promise.resolve();

  return new Promise((resolve) => {
    const forceTimeout = setTimeout(() => {
      if (serverProcess) {
        console.warn('[Server] Force killing after timeout');
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    serverProcess.once('exit', () => {
      clearTimeout(forceTimeout);
      resolve();
    });

    serverProcess.kill('SIGTERM');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableWebSQL: false,
      webSecurity: true,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'desktop', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        shell.openExternal(url);
      }
    }
  });
}

async function launchWithRetry() {
  ensureConfigFiles();

  while (true) {
    try {
      await startServer();
      console.log('[Server] Backend started successfully');
      createWindow();
      return;
    } catch (err) {
      console.error('[Server] Failed to start backend:', err.message);
      const { response } = await dialog.showMessageBox({
        type: 'error',
        title: 'OpenClawd - Server Error',
        message: 'Failed to start the backend server.',
        detail: err.message,
        buttons: ['Retry', 'Exit'],
        defaultId: 0,
        cancelId: 1
      });
      if (response === 1) {
        app.quit();
        return;
      }
      await stopServer();
    }
  }
}

app.on('ready', () => {
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' http://localhost:* http://127.0.0.1:*; " +
          "img-src 'self' data: https:; " +
          "frame-src https://browser.anchor.dev"
        ]
      }
    });
  });

  launchWithRetry();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async (event) => {
  if (serverProcess && !isShuttingDown) {
    isShuttingDown = true;
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess && !isShuttingDown) {
    serverProcess.kill('SIGKILL');
    serverProcess = null;
  }
});

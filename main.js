const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

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

  if (!fs.existsSync(mcpPath)) {
    const exampleMcp = getMcpExamplePath();
    if (fs.existsSync(exampleMcp)) {
      fs.copyFileSync(exampleMcp, mcpPath);
      console.log('[Config] Created mcp-servers.json from example at', mcpPath);
    }
  }
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
      OPENCLAWD_USER_DATA: userDataPath,
      OPENCLAWD_ENV_PATH: envPath,
      OPENCLAWD_MCP_CONFIG_PATH: mcpPath
    };

    serverProcess = spawn('node', [serverEntry], {
      cwd: serverDir,
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[Server] Startup timeout -- showing window anyway');
        resolve();
      }
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[Server] ${output}`);
      if (!resolved && output.includes('Backend server running')) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[Server:err] ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Server] Failed to start:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`[Server] Exited with code=${code} signal=${signal}`);
      serverProcess = null;
    });
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
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'desktop', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.on('ready', async () => {
  console.log('Electron app ready');
  ensureConfigFiles();

  try {
    await startServer();
    console.log('[Server] Backend started successfully');
  } catch (err) {
    console.error('[Server] Failed to start backend:', err.message);
  }

  createWindow();
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

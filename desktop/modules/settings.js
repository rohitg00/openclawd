import { API_BASE } from './state.js';
import { showToast } from './toast.js';
import { escapeHtml, escapeAttr } from './ui.js';
import { initUsageTab } from './usage-dashboard.js';
import { initChannelsTab } from './channels.js';
import { initAgentsTab } from './agents.js';

let catalogData = [];
let installedServerIds = new Set();

export function initSettings() {
  const settingsModal = document.getElementById('settingsModal');
  const mcpCatalogModal = document.getElementById('mcpCatalogModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettings');
  const closeCatalogBtn = document.getElementById('closeCatalog');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const cancelSettingsBtn = document.getElementById('cancelSettings');
  const browseCatalogBtn = document.getElementById('browseCatalogBtn');

  function openSettings() {
    settingsModal?.classList.remove('hidden');
    loadProviderStatus();
    loadMcpServers();
    checkConnection();
  }

  function closeSettings() {
    settingsModal?.classList.add('hidden');
  }

  function openCatalog() {
    mcpCatalogModal?.classList.remove('hidden');
    loadCatalog();
  }

  function closeCatalog() {
    mcpCatalogModal?.classList.add('hidden');
  }

  settingsBtn?.addEventListener('click', openSettings);
  closeSettingsBtn?.addEventListener('click', closeSettings);
  cancelSettingsBtn?.addEventListener('click', closeSettings);
  closeCatalogBtn?.addEventListener('click', closeCatalog);
  browseCatalogBtn?.addEventListener('click', () => {
    closeSettings();
    openCatalog();
  });

  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  mcpCatalogModal?.addEventListener('click', (e) => {
    if (e.target === mcpCatalogModal) closeCatalog();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${tabId}-tab`)?.classList.add('active');
      if (tabId === 'usage') {
        initUsageTab();
      }
      if (tabId === 'channels') {
        initChannelsTab();
      }
      if (tabId === 'agents') {
        initAgentsTab();
      }
    });
  });

  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  initAddServerForm();
  initJsonEditor();
  initSaveSettings(saveSettingsBtn, closeSettings);
  initCatalogFilters();

  const enableFallback = document.getElementById('enableFallback');
  const fallbackSettings = document.getElementById('fallbackSettings');
  const fallbackModelSetting = document.getElementById('fallbackModelSetting');

  if (enableFallback) {
    enableFallback.addEventListener('change', () => {
      const show = enableFallback.checked;
      if (fallbackSettings) fallbackSettings.style.display = show ? '' : 'none';
      if (fallbackModelSetting) fallbackModelSetting.style.display = show ? '' : 'none';
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!mcpCatalogModal?.classList.contains('hidden')) {
        closeCatalog();
      } else if (!settingsModal?.classList.contains('hidden')) {
        closeSettings();
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettings();
    }
  });
}

async function loadProviderStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/settings/providers-status`);
    const data = await response.json();

    for (const [provider, configured] of Object.entries(data.status)) {
      const statusEl = document.getElementById(`${provider}-status`);
      if (statusEl) {
        statusEl.textContent = configured ? 'Configured' : '';
        statusEl.className = `provider-status${configured ? ' connected' : ''}`;
      }
      const dotEl = document.getElementById(`${provider}-dot`);
      if (dotEl) {
        dotEl.className = `provider-status-dot ${configured ? 'configured' : 'not-configured'}`;
      }
    }
  } catch (err) {
    console.error('Failed to load provider status:', err);
  }
}

async function checkConnection() {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');

  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();

    if (statusDot && statusText) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = `Connected - ${data.llmProviders} providers, ${data.mcpServers} MCP servers`;
    }
  } catch (err) {
    if (statusDot && statusText) {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Disconnected - Server not running';
    }
  }
}

async function loadMcpServers() {
  const listEl = document.getElementById('mcpServerList');
  if (!listEl) return;

  try {
    const response = await fetch(`${API_BASE}/api/mcp/servers`);
    if (!response.ok) throw new Error('Failed to load servers');
    const data = await response.json();

    if (data.servers.length === 0) {
      listEl.innerHTML = `
        <div class="mcp-empty-state">
          <p>No MCP servers configured yet.</p>
          <p>Browse the catalog to add integrations like GitHub, Slack, Google Drive, and more.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = data.servers.map(server => `
      <div class="mcp-server-item">
        <div class="mcp-server-info">
          <span class="mcp-server-name">${escapeHtml(server.name)}</span>
          <span class="mcp-server-desc">${escapeHtml(server.type)} · ${server.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div class="mcp-server-actions">
          <button class="mcp-server-toggle ${server.enabled ? 'enabled' : ''}" data-server="${escapeAttr(server.name)}" title="${server.enabled ? 'Disable' : 'Enable'}"></button>
          <button class="mcp-server-delete" data-server="${escapeAttr(server.name)}" title="Remove server">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.mcp-server-toggle').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const serverName = toggle.dataset.server;
        const isEnabled = toggle.classList.contains('enabled');
        const endpoint = isEnabled ? 'disable' : 'enable';

        try {
          const res = await fetch(`${API_BASE}/api/mcp/servers/${serverName}/${endpoint}`, { method: 'PUT' });
          if (!res.ok) throw new Error('Toggle failed');
          toggle.classList.toggle('enabled');
          const desc = toggle.closest('.mcp-server-item').querySelector('.mcp-server-desc');
          const type = desc.textContent.split(' · ')[0];
          desc.textContent = `${type} · ${isEnabled ? 'Disabled' : 'Enabled'}`;
        } catch (err) {
          console.error('Failed to toggle server:', err);
        }
      });
    });

    listEl.querySelectorAll('.mcp-server-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const serverName = btn.dataset.server;
        if (!confirm(`Remove "${serverName}" server?`)) return;

        try {
          const response = await fetch(`${API_BASE}/api/mcp/servers/${serverName}`, { method: 'DELETE' });
          if (response.ok) {
            loadMcpServers();
          } else {
            showToast('Failed to remove server', 'error');
          }
        } catch (err) {
          console.error('Failed to delete server:', err);
          showToast('Failed to remove server', 'error');
        }
      });
    });
  } catch (err) {
    console.error('Failed to load MCP servers:', err);
    listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Failed to load servers</p>';
  }
}

async function loadCatalog(category = 'all') {
  const listEl = document.getElementById('catalogList');
  if (!listEl) return;

  listEl.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Loading catalog...</p>';

  try {
    await loadInstalledServerIds();
    const endpoint = category === 'all' ? '/api/mcp/catalog' : `/api/mcp/catalog/${category}`;
    const response = await fetch(`${API_BASE}${endpoint}`);
    const data = await response.json();

    catalogData = data.servers;
    renderCatalog(catalogData);
  } catch (err) {
    console.error('Failed to load catalog:', err);
    listEl.innerHTML = '<p style="color: var(--text-muted);">Failed to load catalog</p>';
  }
}

async function loadInstalledServerIds() {
  try {
    const response = await fetch(`${API_BASE}/api/mcp/servers`);
    const data = await response.json();
    installedServerIds = new Set(data.servers.map(s => s.name));
  } catch (err) {
    console.error('Failed to load installed servers:', err);
  }
}

function renderCatalog(servers) {
  const listEl = document.getElementById('catalogList');
  if (!listEl) return;

  listEl.innerHTML = servers.map(server => {
    const isInstalled = installedServerIds.has(server.id);
    return `
    <div class="catalog-item ${isInstalled ? 'installed' : ''}">
      <div class="catalog-item-info">
        <div class="catalog-item-name">
          ${escapeHtml(server.name)}
          ${!server.requiresAuth ? '<span class="catalog-item-badge no-auth">No API key</span>' : '<span class="catalog-item-badge requires-auth">Requires API key</span>'}
        </div>
        <div class="catalog-item-desc">${escapeHtml(server.description || '')}</div>
        <div class="catalog-item-package">${escapeHtml(server.package || '')}</div>
      </div>
      <button class="install-btn ${isInstalled ? 'installed' : ''}" data-server="${escapeAttr(server.id)}" ${isInstalled ? 'disabled' : ''}>
        ${isInstalled ? '&#10003; Installed' : 'Install'}
      </button>
    </div>
  `}).join('');

  listEl.querySelectorAll('.install-btn:not(.installed)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const serverId = btn.dataset.server;
      btn.textContent = 'Installing...';
      btn.disabled = true;

      try {
        const response = await fetch(`${API_BASE}/api/mcp/servers/from-catalog/${serverId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        if (response.ok) {
          btn.textContent = '\u2713 Installed';
          btn.classList.add('installed');
          installedServerIds.add(serverId);
          loadMcpServers();
        } else {
          const data = await response.json();
          btn.textContent = data.message?.includes('exists') ? '\u2713 Installed' : 'Failed';
          if (data.message?.includes('exists')) {
            btn.classList.add('installed');
          }
        }
      } catch (err) {
        console.error('Failed to install server:', err);
        btn.textContent = 'Failed';
        btn.disabled = false;
      }
    });
  });
}

function initCatalogFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadCatalog(category);
    });
  });
}

function initAddServerForm() {
  const addServerForm = document.getElementById('addServerForm');
  const addServerBtn = document.getElementById('addServerBtn');
  const closeAddServerFormBtn = document.getElementById('closeAddServerForm');
  const cancelAddServerBtn = document.getElementById('cancelAddServer');
  const saveNewServerBtn = document.getElementById('saveNewServer');
  const serverTypeSelect = document.getElementById('serverType');
  const stdioFields = document.getElementById('stdioFields');
  const httpFields = document.getElementById('httpFields');

  addServerBtn?.addEventListener('click', () => {
    addServerForm?.classList.remove('hidden');
  });

  closeAddServerFormBtn?.addEventListener('click', () => {
    addServerForm?.classList.add('hidden');
  });

  cancelAddServerBtn?.addEventListener('click', () => {
    addServerForm?.classList.add('hidden');
  });

  serverTypeSelect?.addEventListener('change', () => {
    if (serverTypeSelect.value === 'stdio') {
      stdioFields?.classList.remove('hidden');
      httpFields?.classList.add('hidden');
    } else {
      stdioFields?.classList.add('hidden');
      httpFields?.classList.remove('hidden');
    }
  });

  saveNewServerBtn?.addEventListener('click', async () => {
    const serverId = document.getElementById('serverName')?.value?.trim();
    const type = serverTypeSelect?.value;
    const command = document.getElementById('serverCommand')?.value?.trim();
    const argsText = document.getElementById('serverArgs')?.value || '';
    const urlVal = document.getElementById('serverUrl')?.value?.trim();
    const envText = document.getElementById('serverEnv')?.value || '';

    if (!serverId) {
      showToast('Server name is required', 'error');
      return;
    }

    const body = { serverId, type, enabled: true };

    if (type === 'stdio') {
      if (!command) {
        showToast('Command is required for stdio servers', 'error');
        return;
      }
      body.command = command;
      body.args = argsText.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      if (!urlVal) {
        showToast('URL is required for http servers', 'error');
        return;
      }
      body.url = urlVal;
    }

    if (envText.trim()) {
      body.env = {};
      envText.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
          body.env[key.trim()] = rest.join('=').trim();
        }
      });
    }

    saveNewServerBtn.textContent = 'Adding...';
    saveNewServerBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        addServerForm?.classList.add('hidden');
        const fields = ['serverName', 'serverCommand', 'serverArgs', 'serverUrl', 'serverEnv'];
        fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        loadMcpServers();
      } else {
        const data = await response.json();
        showToast(data.error || 'Failed to add server', 'error');
      }
    } catch (err) {
      console.error('Failed to add server:', err);
      showToast('Failed to add server', 'error');
    }

    saveNewServerBtn.textContent = 'Add Server';
    saveNewServerBtn.disabled = false;
  });
}

function initJsonEditor() {
  const jsonEditorSection = document.getElementById('jsonEditorSection');
  const viewJsonBtn = document.getElementById('viewJsonBtn');
  const closeJsonEditorBtn = document.getElementById('closeJsonEditor');
  const cancelJsonEditBtn = document.getElementById('cancelJsonEdit');
  const saveJsonEditBtn = document.getElementById('saveJsonEdit');
  const mcpJsonEditor = document.getElementById('mcpJsonEditor');

  viewJsonBtn?.addEventListener('click', async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mcp/config`);
      const data = await response.json();
      if (mcpJsonEditor) mcpJsonEditor.value = JSON.stringify(data.config || {}, null, 2);
      jsonEditorSection?.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to load MCP config:', err);
      if (mcpJsonEditor) mcpJsonEditor.value = '{\n  \n}';
      jsonEditorSection?.classList.remove('hidden');
    }
  });

  closeJsonEditorBtn?.addEventListener('click', () => {
    jsonEditorSection?.classList.add('hidden');
  });

  cancelJsonEditBtn?.addEventListener('click', () => {
    jsonEditorSection?.classList.add('hidden');
  });

  saveJsonEditBtn?.addEventListener('click', async () => {
    let config;
    try {
      config = JSON.parse(mcpJsonEditor.value);
    } catch (err) {
      showToast('Invalid JSON: ' + err.message, 'error');
      return;
    }

    saveJsonEditBtn.textContent = 'Saving...';
    saveJsonEditBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/mcp/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (response.ok) {
        jsonEditorSection?.classList.add('hidden');
        loadMcpServers();
      } else {
        const data = await response.json();
        showToast(data.error || 'Failed to save config', 'error');
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showToast('Failed to save config', 'error');
    }

    saveJsonEditBtn.textContent = 'Save Configuration';
    saveJsonEditBtn.disabled = false;
  });
}

function initSaveSettings(saveSettingsBtn, closeSettings) {
  saveSettingsBtn?.addEventListener('click', async () => {
    const apiKeys = {
      anthropic: document.getElementById('anthropic-key')?.value,
      openai: document.getElementById('openai-key')?.value,
      gemini: document.getElementById('gemini-key')?.value,
      groq: document.getElementById('groq-key')?.value,
      openrouter: document.getElementById('openrouter-key')?.value,
      deepseek: document.getElementById('deepseek-key')?.value,
      mistral: document.getElementById('mistral-key')?.value,
      xai: document.getElementById('xai-key')?.value,
      venice: document.getElementById('venice-key')?.value
    };

    const general = {
      backendUrl: document.getElementById('backendUrl')?.value,
      fallbackProvider: document.getElementById('enableFallback')?.checked ? document.getElementById('fallbackProvider')?.value : '',
      fallbackModel: document.getElementById('enableFallback')?.checked ? document.getElementById('fallbackModel')?.value : ''
    };

    const keysToSave = {};
    for (const [k, v] of Object.entries(apiKeys)) {
      if (v && !v.includes('\u2022\u2022\u2022\u2022')) keysToSave[k] = v;
    }

    if (Object.keys(keysToSave).length === 0 && !general.backendUrl && !general.fallbackProvider && !general.fallbackModel) {
      closeSettings();
      return;
    }

    saveSettingsBtn.textContent = 'Saving...';
    saveSettingsBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys: keysToSave, general })
      });

      const data = await response.json();

      if (data.success) {
        saveSettingsBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveSettingsBtn.textContent = 'Save Changes';
          saveSettingsBtn.disabled = false;
          closeSettings();
          loadProviderStatus();
        }, 1000);
      } else {
        saveSettingsBtn.textContent = 'Failed';
        setTimeout(() => {
          saveSettingsBtn.textContent = 'Save Changes';
          saveSettingsBtn.disabled = false;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      saveSettingsBtn.textContent = 'Error';
      setTimeout(() => {
        saveSettingsBtn.textContent = 'Save Changes';
        saveSettingsBtn.disabled = false;
      }, 2000);
    }
  });
}

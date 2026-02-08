import { API_BASE } from './state.js';
import { showToast } from './toast.js';
import { escapeHtml } from './ui.js';

const CHANNEL_ICONS = {
  telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.073l3.9 1.205 2.07 6.094a1.096 1.096 0 0 0 1.85.278l2.45-2.786 4.224 3.233a2.246 2.246 0 0 0 3.458-1.36l3.375-16.5a2.25 2.25 0 0 0-2.931-2.652z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M9.5 11.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/><path d="M5.5 16c1.5 2 4 3 6.5 3s5-1 6.5-3M8 8c1.5-1 3-1.5 4-1.5s2.5.5 4 1.5"/><rect x="2" y="4" width="20" height="16" rx="4"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2z"/><path d="M8 12a4 4 0 0 0 4 4l1.5-1.5L12 13l-1-1 1.5-1.5A4 4 0 0 0 8 12z"/></svg>',
  slack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M14.5 2a2.5 2.5 0 0 0 0 5H17V4.5A2.5 2.5 0 0 0 14.5 2z"/><path d="M9.5 7a2.5 2.5 0 0 1 0-5H7v2.5A2.5 2.5 0 0 0 9.5 7z"/><path d="M22 9.5a2.5 2.5 0 0 0-5 0V12h2.5A2.5 2.5 0 0 0 22 9.5z"/><path d="M17 14.5a2.5 2.5 0 0 1 5 0V17h-2.5A2.5 2.5 0 0 1 17 14.5z"/></svg>'
};

const CHANNEL_LABELS = {
  telegram: 'Telegram',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  slack: 'Slack'
};

export async function initChannelsTab() {
  const container = document.getElementById('channels-tab');
  if (!container) return;

  container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Loading channels...</p>';

  try {
    const [statusRes, sessionsRes] = await Promise.all([
      fetch(`${API_BASE}/api/channels/status`),
      fetch(`${API_BASE}/api/channels/sessions`)
    ]);

    if (!statusRes.ok || !sessionsRes.ok) {
      throw new Error('Failed to fetch channel data');
    }

    const statusData = await statusRes.json();
    const sessionsData = await sessionsRes.json();

    container.innerHTML = '';
    renderChannelCards(container, statusData);
    renderSessions(container, sessionsData.sessions || []);
  } catch (err) {
    console.error('Failed to load channels:', err);
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Failed to load channels. Is the server running?</p>';
  }
}

function renderChannelCards(container, status) {
  const grid = document.createElement('div');
  grid.className = 'channel-grid';

  for (const channelId of ['telegram', 'discord', 'whatsapp', 'slack']) {
    const channelStatus = status[channelId] || { active: false };
    const card = createChannelCard(channelId, channelStatus);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function createChannelCard(channelId, status) {
  const card = document.createElement('div');
  card.className = 'channel-card';

  const isWhatsApp = channelId === 'whatsapp';
  const isActive = status.active;

  let inputHtml;
  if (isWhatsApp) {
    inputHtml = `
      <div class="channel-qr" id="whatsapp-qr">
        ${status.hasQr ? '<p style="color: var(--accent-amber);">QR code available - scan with WhatsApp</p>' : '<p style="color: var(--text-muted);">Start to generate QR code</p>'}
      </div>
    `;
  } else if (channelId === 'slack') {
    inputHtml = `
      <input type="password" class="channel-token-input" id="${channelId}-token" placeholder="Bot Token (xoxb-...)" autocomplete="off">
      <input type="password" class="channel-token-input" id="${channelId}-app-token" placeholder="App Token (xapp-...)" autocomplete="off" style="margin-top: 8px;">
    `;
  } else {
    inputHtml = `
      <input type="password" class="channel-token-input" id="${channelId}-token" placeholder="Bot token..." autocomplete="off">
    `;
  }

  card.innerHTML = `
    <div class="channel-card-header">
      <div class="channel-icon">${CHANNEL_ICONS[channelId]}</div>
      <div class="channel-info">
        <span class="channel-name">${CHANNEL_LABELS[channelId]}</span>
        <span class="channel-status ${isActive ? 'active' : ''}">${isActive ? 'Connected' : 'Disconnected'}</span>
      </div>
      <button class="channel-toggle ${isActive ? 'active' : ''}" data-channel="${channelId}">
        ${isActive ? 'Stop' : 'Start'}
      </button>
    </div>
    <div class="channel-card-body">
      ${inputHtml}
    </div>
  `;

  const toggleBtn = card.querySelector('.channel-toggle');
  toggleBtn.addEventListener('click', () => toggleChannel(channelId, isActive));

  return card;
}

async function toggleChannel(channelId, isCurrentlyActive) {
  if (isCurrentlyActive) {
    try {
      await fetch(`${API_BASE}/api/channels/${channelId}/stop`, { method: 'POST' });
      showToast(`${CHANNEL_LABELS[channelId]} stopped`, 'info');
      initChannelsTab();
    } catch (err) {
      showToast(`Failed to stop ${CHANNEL_LABELS[channelId]}`, 'error');
    }
  } else {
    const config = {};

    if (channelId === 'slack') {
      config.token = document.getElementById('slack-token')?.value;
      config.appToken = document.getElementById('slack-app-token')?.value;
    } else if (channelId !== 'whatsapp') {
      config.token = document.getElementById(`${channelId}-token`)?.value;
    }

    if (channelId !== 'whatsapp' && !config.token) {
      showToast('Please enter a bot token', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/channels/${channelId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        showToast(`${CHANNEL_LABELS[channelId]} started`, 'success');
        initChannelsTab();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to start', 'error');
      }
    } catch (err) {
      showToast(`Failed to start ${CHANNEL_LABELS[channelId]}`, 'error');
    }
  }
}

function renderSessions(container, sessions) {
  if (sessions.length === 0) return;

  const section = document.createElement('div');
  section.className = 'settings-section settings-card';

  const rows = sessions.map(s => `
    <tr>
      <td>${escapeHtml(s.platform)}</td>
      <td>${escapeHtml(String(s.userId || '').substring(0, 12))}...</td>
      <td>${escapeHtml(String(s.messageCount))}</td>
      <td>${escapeHtml(new Date(s.lastActivity).toLocaleTimeString())}</td>
    </tr>
  `).join('');

  section.innerHTML = `
    <h3>Active Sessions</h3>
    <table class="usage-table">
      <thead>
        <tr>
          <th>Platform</th>
          <th>User</th>
          <th>Messages</th>
          <th>Last Active</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.appendChild(section);
}

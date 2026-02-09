import { API_BASE } from './state.js';
import { showToast } from './toast.js';
import { escapeHtml, escapeAttr } from './ui.js';

const STATUS_COLORS = {
  idle: 'var(--accent-amber)',
  busy: '#eab308',
  error: '#ef4444',
  killed: 'var(--text-muted)'
};

export async function initAgentsTab() {
  const container = document.getElementById('agents-tab');
  if (!container) return;

  container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Loading agents...</p>';

  try {
    const [agentsRes, tasksRes, sessionsRes] = await Promise.all([
      fetch(`${API_BASE}/api/agents`),
      fetch(`${API_BASE}/api/agents/tasks`),
      fetch(`${API_BASE}/api/agents/sessions`)
    ]);

    if (!agentsRes.ok) throw new Error('Failed to fetch agents');
    if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
    if (!sessionsRes.ok) throw new Error('Failed to fetch sessions');

    const agentsData = await agentsRes.json();
    const tasksData = await tasksRes.json();
    const sessionsData = await sessionsRes.json();

    container.innerHTML = '';
    renderSpawnForm(container);
    renderAgentCards(container, agentsData.agents || []);
    renderTaskSection(container, tasksData.tasks || []);
    renderSessionSection(container, sessionsData.sessions || []);
  } catch (err) {
    console.error('Failed to load agents:', err);
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Failed to load agents. Is the server running?</p>';
  }
}

function renderSpawnForm(container) {
  const section = document.createElement('div');
  section.className = 'settings-section settings-card';
  section.innerHTML = `
    <h3>Spawn Agent</h3>
    <div class="form-group">
      <label for="agent-name-input">Name</label>
      <input type="text" id="agent-name-input" placeholder="e.g., researcher">
    </div>
    <div class="form-group">
      <label for="agent-provider-select">Provider</label>
      <select id="agent-provider-select">
        <option value="claude">Claude</option>
        <option value="opencode">Opencode</option>
      </select>
    </div>
    <div class="form-group">
      <label for="agent-permissions-select">Permissions</label>
      <select id="agent-permissions-select">
        <option value="full">Full</option>
        <option value="edit">Edit</option>
        <option value="plan">Plan</option>
        <option value="ask">Ask</option>
      </select>
    </div>
    <div class="form-group">
      <label for="agent-prompt-input">System Prompt</label>
      <textarea id="agent-prompt-input" rows="2" placeholder="Optional system prompt..."></textarea>
    </div>
    <button class="btn-primary" id="spawn-agent-btn">Spawn</button>
  `;
  container.appendChild(section);

  section.querySelector('#spawn-agent-btn').addEventListener('click', spawnAgent);
}

async function spawnAgent() {
  const name = document.getElementById('agent-name-input')?.value?.trim();
  const provider = document.getElementById('agent-provider-select')?.value;
  const permissions = document.getElementById('agent-permissions-select')?.value;
  const systemPrompt = document.getElementById('agent-prompt-input')?.value?.trim();

  if (!name) {
    showToast('Agent name is required', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, provider, permissions, systemPrompt: systemPrompt || undefined })
    });

    if (res.ok) {
      showToast(`Agent "${name}" spawned`, 'success');
      initAgentsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to spawn agent', 'error');
    }
  } catch (err) {
    showToast('Failed to spawn agent', 'error');
  }
}

function renderAgentCards(container, agents) {
  if (agents.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color: var(--text-muted); text-align: center; padding: 16px;';
    empty.textContent = 'No agents running';
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'agent-grid';

  for (const agent of agents) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    const attrName = escapeAttr(agent.name);
    card.innerHTML = `
      <div class="agent-card-header">
        <div class="agent-info">
          <span class="agent-status-dot" style="background: ${STATUS_COLORS[agent.status] || 'var(--text-muted)'}"></span>
          <span class="agent-name">${escapeHtml(agent.name)}</span>
          <span class="agent-provider-badge">${escapeHtml(agent.provider || 'claude')}</span>
        </div>
        <button class="agent-kill-btn" data-name="${attrName}">Kill</button>
      </div>
      <div class="agent-card-body">
        <div class="agent-meta">
          <span>Status: ${escapeHtml(agent.status)}</span>
          <span>Messages: ${agent.messageCount || 0}</span>
          <span>Permissions: ${escapeHtml(agent.permissions || 'full')}</span>
        </div>
        <div class="agent-chat-area">
          <input type="text" class="agent-msg-input" placeholder="Send message..." data-agent="${attrName}">
          <button class="agent-send-btn" data-agent="${attrName}">Send</button>
        </div>
        <div class="agent-response" data-agent-response="${attrName}"></div>
      </div>
    `;
    grid.appendChild(card);
  }

  container.appendChild(grid);

  grid.querySelectorAll('.agent-kill-btn').forEach(btn => {
    btn.addEventListener('click', () => killAgent(btn.dataset.name));
  });

  grid.querySelectorAll('.agent-send-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.agent;
      const input = grid.querySelector(`.agent-msg-input[data-agent="${CSS.escape(name)}"]`);
      if (input?.value?.trim()) {
        sendToAgent(name, input.value.trim());
        input.value = '';
      }
    });
  });
}

async function killAgent(name) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(name)}/kill`, { method: 'POST' });
    if (res.ok) {
      showToast(`Agent "${name}" killed`, 'info');
      initAgentsTab();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to kill agent', 'error');
    }
  } catch {
    showToast('Failed to kill agent', 'error');
  }
}

async function sendToAgent(name, message) {
  const responseEl = document.querySelector(`.agent-response[data-agent-response="${CSS.escape(name)}"]`);
  if (responseEl) responseEl.textContent = 'Thinking...';

  try {
    const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(name)}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    if (responseEl) {
      responseEl.textContent = data.response || data.error || 'No response';
    }
  } catch {
    if (responseEl) responseEl.textContent = 'Error sending message';
  }
}

function renderTaskSection(container, tasks) {
  const section = document.createElement('div');
  section.className = 'settings-section settings-card';

  const taskRows = tasks.map(t => `
    <tr>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.title)}</td>
      <td><span class="task-status-badge task-${escapeAttr(t.status)}">${escapeHtml(t.status)}</span></td>
      <td>${escapeHtml(t.owner || '—')}</td>
    </tr>
  `).join('');

  section.innerHTML = `
    <h3>Tasks</h3>
    <div class="task-create-row">
      <input type="text" id="task-title-input" placeholder="Task title...">
      <button class="btn-primary" id="create-task-btn">Create</button>
    </div>
    ${tasks.length > 0 ? `
      <table class="usage-table">
        <thead>
          <tr><th>ID</th><th>Title</th><th>Status</th><th>Owner</th></tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
    ` : '<p style="color: var(--text-muted);">No tasks</p>'}
  `;

  container.appendChild(section);

  section.querySelector('#create-task-btn')?.addEventListener('click', async () => {
    const title = document.getElementById('task-title-input')?.value?.trim();
    if (!title) return;

    try {
      const res = await fetch(`${API_BASE}/api/agents/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        showToast('Task created', 'success');
        initAgentsTab();
      }
    } catch {
      showToast('Failed to create task', 'error');
    }
  });
}

function renderSessionSection(container, sessions) {
  const section = document.createElement('div');
  section.className = 'settings-section settings-card';

  section.innerHTML = `
    <h3>Sessions</h3>
    <button class="btn-primary" id="create-session-btn" style="margin-bottom: 12px;">New Session</button>
    ${sessions.length > 0 ? sessions.map(s => `
      <div class="session-item">
        <span>${escapeHtml(s.name)} (${s.agents?.length || 0} agents)</span>
        <button class="btn-secondary session-close-btn" data-id="${escapeAttr(s.id)}">Close</button>
      </div>
    `).join('') : '<p style="color: var(--text-muted);">No sessions</p>'}
  `;

  container.appendChild(section);

  section.querySelector('#create-session-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        showToast('Session created', 'success');
        initAgentsTab();
      }
    } catch {
      showToast('Failed to create session', 'error');
    }
  });

  section.querySelectorAll('.session-close-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agents/sessions/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Session closed', 'info');
          initAgentsTab();
        }
      } catch {
        showToast('Failed to close session', 'error');
      }
    });
  });
}

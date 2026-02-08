import { API_BASE } from './state.js';
import { escapeHtml } from './ui.js';

export async function initUsageTab() {
  const container = document.getElementById('usage-tab');
  if (!container) return;

  container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Loading usage data...</p>';

  try {
    const [usageRes, historyRes] = await Promise.all([
      fetch(`${API_BASE}/api/llm/usage`),
      fetch(`${API_BASE}/api/llm/usage/history`)
    ]);

    if (!usageRes.ok || !historyRes.ok) {
      throw new Error('Failed to fetch usage data');
    }

    const usageData = await usageRes.json();
    const historyData = await historyRes.json();

    container.innerHTML = '';

    renderSummaryCards(container, usageData.stats);
    renderDailyChart(container, historyData.days);
    renderProviderBreakdown(container, usageData.summary);
  } catch (err) {
    console.error('Failed to load usage data:', err);
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Failed to load usage data</p>';
  }
}

function renderSummaryCards(container, stats) {
  const section = document.createElement('div');
  section.className = 'usage-cards';

  const totalTokens = stats?.totalTokens || 0;
  const totalCost = stats?.totalCost || 0;
  const totalRequests = stats?.totalRequests || 0;

  section.innerHTML = `
    <div class="usage-card">
      <div class="usage-card-value">${totalTokens.toLocaleString()}</div>
      <div class="usage-card-label">Total Tokens</div>
    </div>
    <div class="usage-card">
      <div class="usage-card-value">$${totalCost.toFixed(4)}</div>
      <div class="usage-card-label">Est. Cost</div>
    </div>
    <div class="usage-card">
      <div class="usage-card-value">${totalRequests}</div>
      <div class="usage-card-label">Requests</div>
    </div>
  `;

  container.appendChild(section);
}

function renderDailyChart(container, days) {
  const section = document.createElement('div');
  section.className = 'settings-section settings-card';

  const last7 = getLast7DaysData(days);
  const maxTokens = Math.max(...last7.map(d => d.tokens), 1);

  let barsHtml = last7.map(d => {
    const height = Math.max((d.tokens / maxTokens) * 100, 2);
    const label = d.date.slice(5);
    return `
      <div class="usage-bar-wrapper">
        <div class="usage-bar" style="height: ${height}%" title="${d.tokens.toLocaleString()} tokens"></div>
        <span class="usage-bar-label">${label}</span>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <h3>Last 7 Days</h3>
    <div class="usage-chart">${barsHtml}</div>
  `;

  container.appendChild(section);
}

function getLast7DaysData(days) {
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let tokens = 0, cost = 0;
    for (const e of days) {
      if (e.date === dateStr) {
        tokens += e.inputTokens + e.outputTokens;
        cost += e.cost;
      }
    }

    result.push({ date: dateStr, tokens, cost });
  }

  return result;
}

function renderProviderBreakdown(container, summary) {
  if (!summary || summary.length === 0) return;

  const section = document.createElement('div');
  section.className = 'settings-section settings-card';

  const rows = summary.map(s => `
    <tr>
      <td>${escapeHtml(s.provider)}</td>
      <td>${s.inputTokens.toLocaleString()}</td>
      <td>${s.outputTokens.toLocaleString()}</td>
      <td>$${s.estimatedCost.toFixed(4)}</td>
      <td>${s.requests}</td>
    </tr>
  `).join('');

  section.innerHTML = `
    <h3>Provider Breakdown (Today)</h3>
    <table class="usage-table">
      <thead>
        <tr>
          <th>Provider</th>
          <th>Tokens In</th>
          <th>Tokens Out</th>
          <th>Cost</th>
          <th>Requests</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.appendChild(section);
}

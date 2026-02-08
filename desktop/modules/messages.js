import { state, dom, saveState } from './state.js';
import { escapeHtml, scrollToBottom, copyMessage } from './ui.js';
import { handleBrowserTransitionOnMessage, extractBrowserUrl, addInlineBrowserEmbed } from './browser.js';

export function addUserMessage(text) {
  handleBrowserTransitionOnMessage();

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;

  messageDiv.appendChild(contentDiv);
  dom.chatMessages.appendChild(messageDiv);
  scrollToBottom();
  saveState();
}

export function createAssistantMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-indicator skeleton-loader';
  loadingDiv.innerHTML = `
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
  `;

  contentDiv.appendChild(loadingDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'message-actions hidden';
  actionsDiv.innerHTML = `
    <button class="action-btn copy-msg-btn" title="Copy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  `;

  actionsDiv.querySelector('.copy-msg-btn').addEventListener('click', function() {
    copyMessage(this);
  });

  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(actionsDiv);
  dom.chatMessages.appendChild(messageDiv);
  scrollToBottom();
  saveState();

  return messageDiv;
}

export function formatToolPreview(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') {
    return String(toolInput || '').substring(0, 50);
  }

  const keys = Object.keys(toolInput);
  if (keys.length === 0) return '';

  const previewKeys = ['pattern', 'command', 'file_path', 'path', 'query', 'content', 'description'];
  const key = previewKeys.find(k => toolInput[k]) || keys[0];
  const value = toolInput[key];

  if (typeof value === 'string') {
    return `${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`;
  } else if (Array.isArray(value)) {
    return `${key}: [${value.length} items]`;
  } else if (typeof value === 'object') {
    return `${key}: {...}`;
  }
  return `${key}: ${String(value).substring(0, 30)}`;
}

export function addInlineToolCall(contentDiv, toolName, toolInput, toolId) {
  const toolDiv = document.createElement('div');
  toolDiv.className = 'inline-tool-call expanded';
  toolDiv.dataset.toolId = toolId;

  const inputPreview = formatToolPreview(toolInput);
  const inputStr = JSON.stringify(toolInput, null, 2);

  toolDiv.innerHTML = `
    <div class="inline-tool-header">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>
      <span class="tool-name">${escapeHtml(toolName)}</span>
      <span class="tool-preview">${escapeHtml(inputPreview)}</span>
      <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
    <div class="inline-tool-result">
      <div class="tool-section">
        <div class="tool-section-label">Input</div>
        <pre>${escapeHtml(inputStr)}</pre>
      </div>
      <div class="tool-section tool-output-section" style="display: none;">
        <div class="tool-section-label">Output</div>
        <pre class="tool-output-content"></pre>
      </div>
    </div>
  `;

  toolDiv.querySelector('.inline-tool-header').addEventListener('click', function() {
    toolDiv.classList.toggle('expanded');
  });

  contentDiv.appendChild(toolDiv);

  const currentChunk = parseInt(contentDiv.dataset.currentChunk || '0');
  contentDiv.dataset.currentChunk = currentChunk + 1;
}

export function updateInlineToolResult(toolId, result) {
  const toolDiv = document.querySelector(`.inline-tool-call[data-tool-id="${toolId}"]`);
  if (toolDiv) {
    const outputSection = toolDiv.querySelector('.tool-output-section');
    const outputContent = toolDiv.querySelector('.tool-output-content');
    if (outputSection && outputContent) {
      const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      outputContent.textContent = resultStr.substring(0, 2000) + (resultStr.length > 2000 ? '...' : '');
      outputSection.style.display = 'block';

      const browserInfo = extractBrowserUrl(resultStr);
      if (browserInfo) {
        const contentDiv = toolDiv.closest('.message-content');
        if (contentDiv) {
          addInlineBrowserEmbed(contentDiv, browserInfo.url, browserInfo.sessionId);
        }
      }
    }
  }
}

export function addToolCall(name, input, status = 'running') {
  const id = 'tool_' + Date.now();
  const toolCall = { id, name, input, status, result: null };
  state.toolCalls.push(toolCall);

  dom.emptyTools.style.display = 'none';

  const toolDiv = document.createElement('div');
  toolDiv.className = 'tool-call-item expanded';
  toolDiv.dataset.toolId = id;

  toolDiv.innerHTML = `
    <div class="tool-call-header">
      <div class="tool-call-icon ${status}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
      </div>
      <div class="tool-call-info">
        <div class="tool-call-name">${escapeHtml(name)}</div>
        <div class="tool-call-status">${status === 'running' ? 'Running...' : 'Completed'}</div>
      </div>
      <div class="tool-call-expand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
    <div class="tool-call-details">
      <div class="tool-detail-section">
        <div class="tool-detail-label">Input</div>
        <pre>${escapeHtml(JSON.stringify(input, null, 2))}</pre>
      </div>
      <div class="tool-detail-section tool-output-section" style="display: none;">
        <div class="tool-detail-label">Output</div>
        <pre class="sidebar-tool-output"></pre>
      </div>
    </div>
  `;

  toolDiv.querySelector('.tool-call-header').addEventListener('click', function() {
    toolDiv.classList.toggle('expanded');
  });

  dom.toolCallsList.appendChild(toolDiv);
  return toolCall;
}

export function updateToolCallStatus(toolId, status) {
  const toolDiv = document.querySelector(`.tool-call-item[data-tool-id="${toolId}"]`);
  if (toolDiv) {
    const icon = toolDiv.querySelector('.tool-call-icon');
    const statusText = toolDiv.querySelector('.tool-call-status');
    icon.className = `tool-call-icon ${status}`;
    statusText.textContent = status === 'success' ? 'Completed' : status === 'error' ? 'Failed' : 'Running...';
  }

  const toolCall = state.toolCalls.find(t => t.id === toolId);
  if (toolCall) {
    toolCall.status = status;
  }
}

export function updateToolCallResult(toolId, result) {
  const toolCall = state.toolCalls.find(t => t.id === toolId);
  if (toolCall) {
    toolCall.result = result;
  }

  const toolDiv = document.querySelector(`.tool-call-item[data-tool-id="${toolId}"]`);
  if (toolDiv) {
    const outputSection = toolDiv.querySelector('.tool-output-section');
    const outputContent = toolDiv.querySelector('.sidebar-tool-output');
    if (outputSection && outputContent) {
      const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      outputContent.textContent = resultStr.substring(0, 2000) + (resultStr.length > 2000 ? '...' : '');
      outputSection.style.display = 'block';
    }
  }
}

export function updateTodos(newTodos) {
  state.todos = newTodos;
  renderTodos();
}

export function renderTodos() {
  dom.stepsList.innerHTML = '';

  if (state.todos.length === 0) {
    dom.emptySteps.style.display = 'block';
    dom.stepsCount.textContent = '0 steps';
    return;
  }

  dom.emptySteps.style.display = 'none';
  dom.stepsCount.textContent = `${state.todos.length} steps`;

  state.todos.forEach((todo) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';

    const statusIcon = todo.status === 'completed'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : todo.status === 'in_progress'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>'
      : '';

    const displayText = todo.status === 'in_progress' ? (todo.activeForm || todo.content) : todo.content;

    stepDiv.innerHTML = `
      <div class="step-status ${todo.status}">${statusIcon}</div>
      <div class="step-content">
        <div class="step-text">${escapeHtml(displayText)}</div>
      </div>
    `;

    dom.stepsList.appendChild(stepDiv);
  });
}

import { state, dom } from './state.js';
import { escapeHtml, scrollToBottom } from './ui.js';

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function extractBrowserUrl(text) {
  const regex = /https:\/\/live\.anchorbrowser\.io\?sessionId=([a-f0-9-]+)/i;
  const match = text.match(regex);
  if (match) {
    return { url: match[0], sessionId: match[1] };
  }
  return null;
}

export function addInlineBrowserEmbed(contentDiv, url, sessionId) {
  const existingEmbed = document.querySelector('.inline-browser-embed');
  if (existingEmbed) {
    existingEmbed.remove();
  }

  const browserDiv = document.createElement('div');
  browserDiv.className = 'inline-browser-embed';
  browserDiv.dataset.sessionId = sessionId;
  browserDiv.dataset.url = url;

  browserDiv.innerHTML = `
    <div class="browser-embed-header">
      <div class="browser-header-left">
        <svg class="browser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="browser-title">Live Browser</span>
        <span class="browser-session-badge">Session Active</span>
      </div>
      <div class="browser-header-actions">
        <button class="browser-action-btn open-new-window-btn" title="Open in new window">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <button class="browser-action-btn move-to-sidebar-btn" title="Move to sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
        </button>
        <button class="browser-action-btn browser-fullscreen-btn" title="Fullscreen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>
    </div>
    <div class="browser-embed-content">
      <iframe
        src="${escapeAttr(url)}"
        class="browser-iframe"
        allow="clipboard-read; clipboard-write; camera; microphone"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
      ></iframe>
    </div>
    <div class="browser-embed-footer">
      <span class="browser-url">${escapeHtml(url)}</span>
      <button class="browser-copy-url" title="Copy URL">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  `;

  browserDiv.querySelector('.open-new-window-btn').addEventListener('click', () => {
    window.open(url, '_blank', 'width=1200,height=800');
  });

  browserDiv.querySelector('.move-to-sidebar-btn').addEventListener('click', () => {
    moveBrowserToSidebar();
  });

  browserDiv.querySelector('.browser-fullscreen-btn').addEventListener('click', function() {
    toggleBrowserFullscreen(this);
  });

  browserDiv.querySelector('.browser-copy-url').addEventListener('click', function() {
    navigator.clipboard.writeText(url).then(() => {
      this.style.color = '#4ade80';
      setTimeout(() => { this.style.color = ''; }, 1000);
    });
  });

  state.activeBrowserSession = {
    url: url,
    sessionId: sessionId,
    inlineElement: browserDiv
  };
  state.browserDisplayMode = 'inline';

  contentDiv.appendChild(browserDiv);

  const currentChunk = parseInt(contentDiv.dataset.currentChunk || '0');
  contentDiv.dataset.currentChunk = currentChunk + 1;

  scrollToBottom();
}

export function moveBrowserToSidebar() {
  if (!state.activeBrowserSession) return;

  if (state.activeBrowserSession.inlineElement) {
    state.activeBrowserSession.inlineElement.remove();
  }

  showBrowserInSidebar(state.activeBrowserSession.url, state.activeBrowserSession.sessionId);
  state.browserDisplayMode = 'sidebar';
}

function showBrowserInSidebar(url, sessionId) {
  let browserSection = document.getElementById('browserSection');

  if (!browserSection) {
    browserSection = document.createElement('div');
    browserSection.id = 'browserSection';
    browserSection.className = 'sidebar-section browser-section';
    browserSection.innerHTML = `
      <div class="section-header browser-section-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>Live Browser</span>
        <div class="browser-sidebar-actions">
          <button class="browser-sidebar-btn move-inline-btn" title="Show inline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <button class="browser-sidebar-btn close-browser-btn" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="browser-sidebar-content">
        <iframe
          src="${escapeAttr(url)}"
          class="browser-sidebar-iframe"
          allow="clipboard-read; clipboard-write; camera; microphone"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        ></iframe>
      </div>
    `;

    browserSection.querySelector('.move-inline-btn').addEventListener('click', () => {
      moveBrowserToInline();
    });

    browserSection.querySelector('.close-browser-btn').addEventListener('click', () => {
      closeBrowserSession();
    });

    const toolCallsSection = dom.sidebar.querySelector('.sidebar-section:last-child');
    dom.sidebar.insertBefore(browserSection, toolCallsSection);
  } else {
    const iframe = browserSection.querySelector('.browser-sidebar-iframe');
    if (iframe) {
      iframe.src = url;
    }
  }

  dom.sidebar.classList.remove('collapsed');

  state.activeBrowserSession = {
    ...state.activeBrowserSession,
    url: url,
    sessionId: sessionId,
    sidebarElement: browserSection
  };
}

export function moveBrowserToInline() {
  if (!state.activeBrowserSession) return;

  const browserSection = document.getElementById('browserSection');
  if (browserSection) {
    browserSection.remove();
  }

  const lastAssistantMessage = dom.chatMessages.querySelector('.message.assistant:last-child .message-content');
  if (lastAssistantMessage && state.activeBrowserSession.url) {
    addInlineBrowserEmbed(lastAssistantMessage, state.activeBrowserSession.url, state.activeBrowserSession.sessionId);
  }

  state.browserDisplayMode = 'inline';
}

export function closeBrowserSession() {
  const inlineEmbed = document.querySelector('.inline-browser-embed');
  if (inlineEmbed) {
    inlineEmbed.remove();
  }

  const browserSection = document.getElementById('browserSection');
  if (browserSection) {
    browserSection.remove();
  }

  state.activeBrowserSession = null;
  state.browserDisplayMode = 'hidden';
}

function toggleBrowserFullscreen(button) {
  const embedDiv = button.closest('.inline-browser-embed');
  if (embedDiv) {
    embedDiv.classList.toggle('fullscreen');

    const svg = button.querySelector('svg');
    if (embedDiv.classList.contains('fullscreen')) {
      svg.innerHTML = `
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      `;
    } else {
      svg.innerHTML = `
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      `;
    }
  }
}

export function handleBrowserTransitionOnMessage() {
  if (state.activeBrowserSession && state.browserDisplayMode === 'inline') {
    moveBrowserToSidebar();
  }
}

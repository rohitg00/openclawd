export const API_BASE = 'http://localhost:3001';

export const providerModels = {
  claude: [
    { value: 'claude-opus-4-5-20250514', label: 'Opus 4.5', desc: 'Most capable for complex work' },
    { value: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5', desc: 'Best for everyday tasks', default: true },
    { value: 'claude-haiku-4-5-20250514', label: 'Haiku 4.5', desc: 'Fastest for quick answers' }
  ],
  opencode: [
    { value: 'opencode/big-pickle', label: 'Big Pickle', desc: 'Reasoning model', default: true },
    { value: 'opencode/gpt-5-nano', label: 'GPT-5 Nano', desc: 'OpenAI reasoning' },
    { value: 'opencode/glm-4.7-free', label: 'GLM-4.7', desc: 'Zhipu GLM free' },
    { value: 'opencode/grok-code', label: 'Grok Code Fast', desc: 'xAI coding model' },
    { value: 'opencode/minimax-m2.1-free', label: 'MiniMax M2.1', desc: 'MiniMax free' },
    { value: 'anthropic/claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', desc: 'Best balance' },
    { value: 'anthropic/claude-opus-4-5-20251101', label: 'Claude Opus 4.5', desc: 'Most capable' },
    { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'Fastest' }
  ]
};

export const state = {
  isFirstMessage: true,
  todos: [],
  toolCalls: [],
  attachedFiles: [],
  selectedProvider: 'claude',
  selectedModel: 'claude-sonnet-4-5-20250514',
  thinkingMode: 'normal',
  isWaitingForResponse: false,
  activeBrowserSession: null,
  browserDisplayMode: 'hidden',
  allChats: [],
  currentChatId: null,
};

export const dom = {
  get homeView() { return document.getElementById('homeView'); },
  get chatView() { return document.getElementById('chatView'); },
  get homeForm() { return document.getElementById('homeForm'); },
  get homeInput() { return document.getElementById('homeInput'); },
  get homeSendBtn() { return document.getElementById('homeSendBtn'); },
  get chatForm() { return document.getElementById('chatForm'); },
  get messageInput() { return document.getElementById('messageInput'); },
  get chatSendBtn() { return document.getElementById('chatSendBtn'); },
  get chatMessages() { return document.getElementById('chatMessages'); },
  get chatTitle() { return document.getElementById('chatTitle'); },
  get sidebar() { return document.getElementById('sidebar'); },
  get sidebarToggle() { return document.getElementById('sidebarToggle'); },
  get rightSidebarExpand() { return document.getElementById('rightSidebarExpand'); },
  get stepsList() { return document.getElementById('stepsList'); },
  get stepsCount() { return document.getElementById('stepsCount'); },
  get toolCallsList() { return document.getElementById('toolCallsList'); },
  get emptySteps() { return document.getElementById('emptySteps'); },
  get emptyTools() { return document.getElementById('emptyTools'); },
  get chatHistoryList() { return document.getElementById('chatHistoryList'); },
  get leftSidebar() { return document.getElementById('leftSidebar'); },
  get leftSidebarToggle() { return document.getElementById('leftSidebarToggle'); },
  get leftSidebarExpand() { return document.getElementById('leftSidebarExpand'); },
};

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      const chats = JSON.parse(localStorage.getItem('allChats') || '[]');
      if (chats.length > 1) {
        chats.shift();
        localStorage.setItem('allChats', JSON.stringify(chats));
        localStorage.setItem(key, value);
      }
    }
  }
}

export function generateId() {
  return 'chat_' + crypto.randomUUID();
}

export function saveState() {
  if (!state.currentChatId) return;
  if (state.isWaitingForResponse) {
    console.log('[Save] Skipping save during streaming');
    return;
  }

  const chatData = {
    id: state.currentChatId,
    title: dom.chatTitle?.textContent || 'Untitled',
    messages: Array.from(dom.chatMessages?.children || []).map(msg => {
      const contentDiv = msg.querySelector('.message-content');
      const rawContent = contentDiv?.dataset.rawContent || contentDiv?.textContent || '';
      return {
        class: msg.className,
        content: rawContent,
        html: contentDiv?.innerHTML || ''
      };
    }),
    todos: state.todos,
    toolCalls: state.toolCalls,
    provider: state.selectedProvider,
    model: state.selectedModel,
    updatedAt: Date.now()
  };

  const index = state.allChats.findIndex(c => c.id === state.currentChatId);
  if (index >= 0) {
    state.allChats[index] = chatData;
  } else {
    state.allChats.unshift(chatData);
  }

  safeSetItem('allChats', JSON.stringify(state.allChats));
  safeSetItem('currentChatId', state.currentChatId);
  safeSetItem('selectedProvider', state.selectedProvider);
  safeSetItem('selectedModel', state.selectedModel);
}

export function loadAllChats(renderChatHistory, loadChat, updateProviderUI) {
  try {
    const saved = localStorage.getItem('allChats');
    state.allChats = saved ? JSON.parse(saved) : [];
    state.currentChatId = localStorage.getItem('currentChatId');

    const savedProvider = localStorage.getItem('selectedProvider');
    const savedModel = localStorage.getItem('selectedModel');
    if (savedProvider && providerModels[savedProvider]) {
      state.selectedProvider = savedProvider;
      updateProviderUI(savedProvider);
    }
    if (savedModel) {
      state.selectedModel = savedModel;
      const models = providerModels[state.selectedProvider] || [];
      const modelInfo = models.find(m => m.value === savedModel);
      if (modelInfo) {
        document.querySelectorAll('.model-selector .model-label').forEach(l => {
          l.textContent = modelInfo.label;
        });
      }
    }

    if (state.currentChatId) {
      const chat = state.allChats.find(c => c.id === state.currentChatId);
      if (chat) {
        loadChat(chat);
      } else {
        state.currentChatId = null;
        localStorage.removeItem('currentChatId');
      }
    }
  } catch (err) {
    console.error('Failed to load chats:', err);
    state.allChats = [];
  }
}

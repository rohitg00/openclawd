import { state, dom, generateId, saveState, safeSetItem, providerModels } from './state.js';
import { scrollToBottom, updateSendButton, resetTextareaHeight, switchToChatView, escapeHtml, copyMessage } from './ui.js';
import { renderMarkdown } from './markdown.js';
import { appendToContent, appendToThinking } from './markdown.js';
import { addUserMessage, createAssistantMessage, addToolCall, addInlineToolCall, updateToolCallStatus, updateToolCallResult, updateInlineToolResult, updateTodos, renderTodos } from './messages.js';
import { updateProviderUI } from './dropdowns.js';

export function loadChat(chat) {
  state.currentChatId = chat.id;
  dom.chatTitle.textContent = chat.title;
  state.isFirstMessage = false;
  state.todos = chat.todos || [];
  state.toolCalls = chat.toolCalls || [];

  if (chat.provider && providerModels[chat.provider]) {
    state.selectedProvider = chat.provider;
    updateProviderUI(chat.provider);
  }
  if (chat.model) {
    state.selectedModel = chat.model;
    const models = providerModels[state.selectedProvider] || [];
    const modelInfo = models.find(m => m.value === chat.model);
    if (modelInfo) {
      document.querySelectorAll('.model-selector .model-label').forEach(l => {
        l.textContent = modelInfo.label;
      });
      document.querySelectorAll('.model-menu .dropdown-item').forEach(item => {
        const isSelected = item.dataset.value === chat.model;
        item.classList.toggle('selected', isSelected);
        const checkIcon = item.querySelector('.check-icon');
        if (checkIcon) {
          checkIcon.style.display = isSelected ? 'block' : 'none';
        }
      });
    }
  }

  switchToChatView();

  dom.chatMessages.innerHTML = '';
  (chat.messages || []).forEach(msgData => {
    const messageDiv = document.createElement('div');
    messageDiv.className = msgData.class;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.dataset.rawContent = msgData.content;

    if (msgData.class.includes('user')) {
      contentDiv.textContent = msgData.content;
    } else if (msgData.class.includes('assistant')) {
      if (msgData.html) {
        contentDiv.innerHTML = msgData.html;
      } else {
        renderMarkdown(contentDiv);
      }
    }

    messageDiv.appendChild(contentDiv);

    if (msgData.class.includes('assistant')) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
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
      messageDiv.appendChild(actionsDiv);
    }

    dom.chatMessages.appendChild(messageDiv);
  });

  renderTodos();
  scrollToBottom();
  renderChatHistory();
  safeSetItem('currentChatId', state.currentChatId);
}

export function renderChatHistory(filter = '') {
  dom.chatHistoryList.innerHTML = '';

  if (state.allChats.length === 0) {
    dom.chatHistoryList.innerHTML = '<div class="chat-history-empty">No chats yet</div>';
    return;
  }

  const sortedChats = [...state.allChats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const filterLower = filter.toLowerCase();
  const filteredChats = filterLower
    ? sortedChats.filter(c => (c.title || '').toLowerCase().includes(filterLower))
    : sortedChats;

  if (filteredChats.length === 0) {
    dom.chatHistoryList.innerHTML = '<div class="chat-history-empty">No matching chats</div>';
    return;
  }

  filteredChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-history-item' + (chat.id === state.currentChatId ? ' active' : '');
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="chat-title">${escapeHtml(chat.title || 'New chat')}</span>
      <button class="delete-chat-btn" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    item.querySelector('.delete-chat-btn').addEventListener('click', (event) => {
      deleteChat(chat.id, event);
    });

    item.addEventListener('click', (e) => {
      if (!e.target.closest('.delete-chat-btn')) {
        switchToChat(chat.id);
      }
    });

    dom.chatHistoryList.appendChild(item);
  });
}

export function switchToChat(chatId) {
  if (state.isWaitingForResponse) {
    window.electronAPI.abortCurrentRequest();
    state.isWaitingForResponse = false;
  }

  if (state.currentChatId) {
    saveState();
  }

  const chat = state.allChats.find(c => c.id === chatId);
  if (chat) {
    loadChat(chat);
  }

  updateSendButton(dom.homeInput, dom.homeSendBtn);
  updateSendButton(dom.messageInput, dom.chatSendBtn);
}

export function deleteChat(chatId, event) {
  event.stopPropagation();

  state.allChats = state.allChats.filter(c => c.id !== chatId);
  safeSetItem('allChats', JSON.stringify(state.allChats));

  if (state.currentChatId === chatId) {
    if (state.allChats.length > 0) {
      loadChat(state.allChats[0]);
    } else {
      state.currentChatId = null;
      localStorage.removeItem('currentChatId');
      dom.homeView.classList.remove('hidden');
      dom.chatView.classList.add('hidden');
      state.isFirstMessage = true;
    }
  }

  renderChatHistory();
}

export function startNewChat() {
  if (state.isWaitingForResponse) {
    window.electronAPI.abortCurrentRequest();
    state.isWaitingForResponse = false;
  }

  if (state.currentChatId && dom.chatMessages.children.length > 0) {
    saveState();
  }

  state.currentChatId = null;
  dom.chatMessages.innerHTML = '';
  dom.messageInput.value = '';
  dom.homeInput.value = '';
  dom.chatTitle.textContent = 'New chat';
  state.isFirstMessage = true;
  state.todos = [];
  state.toolCalls = [];
  state.attachedFiles = [];

  dom.stepsList.innerHTML = '';
  dom.emptySteps.style.display = 'block';
  dom.stepsCount.textContent = '0 steps';
  dom.toolCallsList.innerHTML = '';
  dom.emptyTools.style.display = 'block';

  dom.homeView.classList.remove('hidden');
  dom.chatView.classList.add('hidden');
  dom.homeInput.focus();

  localStorage.removeItem('currentChatId');
  renderChatHistory();
  updateSendButton(dom.homeInput, dom.homeSendBtn);
  updateSendButton(dom.messageInput, dom.chatSendBtn);
}

export async function stopCurrentQuery() {
  if (!state.isWaitingForResponse || !state.currentChatId) return;

  console.log('[Chat] Stopping query for chatId:', state.currentChatId);

  window.electronAPI.abortCurrentRequest();
  await window.electronAPI.stopQuery(state.currentChatId, state.selectedProvider);

  state.isWaitingForResponse = false;
  updateSendButton(dom.messageInput, dom.chatSendBtn);
  updateSendButton(dom.homeInput, dom.homeSendBtn);

  const lastMessage = dom.chatMessages.lastElementChild;
  if (lastMessage && lastMessage.classList.contains('assistant')) {
    const loadingIndicator = lastMessage.querySelector('.loading-indicator');
    if (loadingIndicator) loadingIndicator.remove();

    const contentDiv = lastMessage.querySelector('.message-content');
    if (contentDiv) {
      const stoppedNote = document.createElement('p');
      stoppedNote.style.color = '#888';
      stoppedNote.style.fontStyle = 'italic';
      stoppedNote.textContent = '[Response stopped]';
      contentDiv.appendChild(stoppedNote);
    }
  }

  saveState();
}

export async function handleSendMessage(e) {
  e.preventDefault();

  if (state.isWaitingForResponse) {
    await stopCurrentQuery();
    return;
  }

  const input = state.isFirstMessage ? dom.homeInput : dom.messageInput;
  const message = input.value.trim();

  if (!message) return;

  if (state.isFirstMessage) {
    state.currentChatId = generateId();
    switchToChatView();
    state.isFirstMessage = false;
    dom.chatTitle.textContent = message.length > 30 ? message.substring(0, 30) + '...' : message;
  } else if (!state.currentChatId) {
    state.currentChatId = generateId();
    dom.chatTitle.textContent = message.length > 30 ? message.substring(0, 30) + '...' : message;
  }

  addUserMessage(message);

  input.value = '';
  resetTextareaHeight(input);

  state.isWaitingForResponse = true;
  updateSendButton(dom.homeInput, dom.homeSendBtn);
  updateSendButton(dom.messageInput, dom.chatSendBtn);

  const assistantMessage = createAssistantMessage();
  const contentDiv = assistantMessage.querySelector('.message-content');

  let heartbeatChecker = null;

  try {
    console.log('[Chat] Sending message to API...');
    const response = await window.electronAPI.sendMessage(message, state.currentChatId, state.selectedProvider, state.selectedModel);
    console.log('[Chat] Response received');

    const reader = await response.getReader();
    let buffer = '';
    let hasContent = false;
    let receivedStreamingText = false;
    const pendingToolCalls = new Map();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastHeartbeat = Date.now();
    const heartbeatTimeout = 300000;

    heartbeatChecker = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceLastHeartbeat > heartbeatTimeout) {
        console.warn('[Chat] No data received for 5 minutes - connection may be lost');
      }
    }, 30000);

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[Chat] Stream complete');
          clearInterval(heartbeatChecker);
          const loadingIndicator = contentDiv.querySelector('.loading-indicator');
          if (loadingIndicator && hasContent) {
            loadingIndicator.remove();
          }
          const actionsDiv = assistantMessage.querySelector('.message-actions');
          if (actionsDiv) {
            actionsDiv.classList.remove('hidden');
          }
          for (const [, localId] of pendingToolCalls) {
            updateToolCallStatus(localId, 'success');
          }
          const totalTk = totalInputTokens + totalOutputTokens;
          if (totalTk > 0) {
            const badge = document.createElement('span');
            badge.className = 'token-badge';
            const costEst = ((totalInputTokens * 3 + totalOutputTokens * 15) / 1000000).toFixed(4);
            badge.textContent = `${totalTk.toLocaleString()} tokens · $${costEst}`;
            contentDiv.appendChild(badge);
          }
          break;
        }

        lastHeartbeat = Date.now();

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];

          if (line.startsWith(':')) {
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);

              console.log('[Frontend] Received event:', data.type, data.name || '');

              if (data.type === 'done') {
                break;
              } else if (data.type === 'text' && data.content) {
                if (!hasContent) {
                  const loadingIndicator = contentDiv.querySelector('.loading-indicator');
                  if (loadingIndicator) loadingIndicator.remove();
                }
                hasContent = true;
                receivedStreamingText = true;
                if (data.isReasoning) {
                  appendToThinking(contentDiv, data.content);
                } else {
                  appendToContent(contentDiv, data.content);
                }
              } else if (data.type === 'tool_use') {
                const toolName = data.name || data.tool || 'Tool';
                const toolInput = data.input || {};
                const apiId = data.id;
                const toolCall = addToolCall(toolName, toolInput, 'running');
                addInlineToolCall(contentDiv, toolName, toolInput, toolCall.id);
                if (apiId) {
                  pendingToolCalls.set(apiId, toolCall.id);
                }

                if (toolName === 'TodoWrite' && toolInput.todos) {
                  updateTodos(toolInput.todos);
                }

                hasContent = true;
              } else if (data.type === 'tool_result' || data.type === 'result') {
                const result = data.result || data.content || data;
                const apiId = data.tool_use_id;

                const localId = apiId ? pendingToolCalls.get(apiId) : null;
                if (localId) {
                  updateToolCallResult(localId, result);
                  updateToolCallStatus(localId, 'success');
                  updateInlineToolResult(localId, result);
                  pendingToolCalls.delete(apiId);
                }

                if (!hasContent) {
                  const loadingIndicator = contentDiv.querySelector('.loading-indicator');
                  if (loadingIndicator) loadingIndicator.remove();
                }
                hasContent = true;
              } else if (data.type === 'fallback') {
                import('./toast.js').then(({ showToast }) => {
                  showToast(`Switched to ${data.to}`, 'info');
                });
              } else if (data.type === 'usage') {
                totalInputTokens = data.inputTokens || totalInputTokens;
                totalOutputTokens = data.outputTokens || totalOutputTokens;
              } else if (data.type === 'assistant' && data.message) {
                if (data.message.content && Array.isArray(data.message.content)) {
                  for (const block of data.message.content) {
                    if (block.type === 'tool_use') {
                      const toolName = block.name || 'Tool';
                      const toolInput = block.input || {};
                      const apiId = block.id;
                      const toolCall = addToolCall(toolName, toolInput, 'running');
                      addInlineToolCall(contentDiv, toolName, toolInput, toolCall.id);
                      if (apiId) {
                        pendingToolCalls.set(apiId, toolCall.id);
                      }
                      hasContent = true;
                    } else if (block.type === 'text' && block.text) {
                      if (!receivedStreamingText) {
                        if (!hasContent) {
                          const loadingIndicator = contentDiv.querySelector('.loading-indicator');
                          if (loadingIndicator) loadingIndicator.remove();
                        }
                        hasContent = true;
                        appendToContent(contentDiv, block.text);
                      }
                    }
                  }

                  for (const block of data.message.content) {
                    if (block.type === 'tool_use' && block.name === 'TodoWrite') {
                      updateTodos(block.input.todos);
                    }
                  }
                }
              }

              scrollToBottom();
            } catch (parseError) {
            }
          }
        }
      }
    } catch (readerError) {
      console.error('[Chat] Reader error:', readerError);
      clearInterval(heartbeatChecker);
      throw readerError;
    }
  } catch (error) {
    clearInterval(heartbeatChecker);

    if (error?.name === 'AbortError' || error?.message?.includes('aborted') || error?.message?.includes('abort')) {
      console.log('[Chat] Request was aborted');
      return;
    }

    if (!error?.message) {
      console.log('[Chat] Request ended without error message (likely aborted)');
      return;
    }

    console.error('[Chat] Error sending message:', error);
    const loadingIndicator = contentDiv.querySelector('.loading-indicator');
    if (loadingIndicator) loadingIndicator.remove();

    const paragraph = document.createElement('p');
    paragraph.textContent = `Error: ${error.message}`;
    paragraph.style.color = '#c0392b';
    contentDiv.appendChild(paragraph);
  } finally {
    if (heartbeatChecker) {
      clearInterval(heartbeatChecker);
    }
    state.isWaitingForResponse = false;
    saveState();
    updateSendButton(dom.messageInput, dom.chatSendBtn);
    updateSendButton(dom.homeInput, dom.homeSendBtn);
    dom.messageInput.focus();
  }
}

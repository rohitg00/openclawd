import { state, dom } from './state.js';
import { showToast } from './toast.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function scrollToBottom() {
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

export function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

export function resetTextareaHeight(textarea) {
  textarea.style.height = 'auto';
}

export function switchToChatView() {
  dom.homeView.classList.add('hidden');
  dom.chatView.classList.remove('hidden');
  dom.messageInput.focus();
}

export function updateSendButton(input, button) {
  if (state.isWaitingForResponse) {
    button.disabled = false;
    button.classList.add('streaming');
    const sendIcon = button.querySelector('.send-icon');
    const stopIcon = button.querySelector('.stop-icon');
    if (sendIcon) sendIcon.classList.add('hidden');
    if (stopIcon) stopIcon.classList.remove('hidden');
  } else {
    button.disabled = !input.value.trim();
    button.classList.remove('streaming');
    const sendIcon = button.querySelector('.send-icon');
    const stopIcon = button.querySelector('.stop-icon');
    if (sendIcon) sendIcon.classList.remove('hidden');
    if (stopIcon) stopIcon.classList.add('hidden');
  }
}

export function handleKeyPress(e, form) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
}

export function handleFileSelect(event, context) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    if (state.attachedFiles.length >= 5) {
      showToast('Maximum 5 files allowed', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      state.attachedFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result
      });
      renderAttachedFiles(context);
    };

    const isTextFile = file.type.startsWith('text/') ||
      ['application/json', 'application/javascript', 'application/xml'].includes(file.type);

    if (isTextFile) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
  event.target.value = '';
}

export function renderAttachedFiles(context) {
  const inputWrapper = context === 'home'
    ? document.querySelector('#homeForm .input-wrapper')
    : document.querySelector('#chatForm .input-wrapper');

  let filesContainer = inputWrapper.querySelector('.attached-files');
  if (!filesContainer) {
    filesContainer = document.createElement('div');
    filesContainer.className = 'attached-files';
    inputWrapper.insertBefore(filesContainer, inputWrapper.firstChild);
  }

  filesContainer.innerHTML = state.attachedFiles.map((file, index) => `
    <div class="attached-file">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <span>${escapeHtml(file.name)}</span>
      <svg class="remove-file" data-index="${index}" data-context="${context}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  `).join('');

  filesContainer.querySelectorAll('.remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const ctx = btn.dataset.context;
      state.attachedFiles.splice(idx, 1);
      renderAttachedFiles(ctx);
    });
  });

  if (state.attachedFiles.length === 0) {
    filesContainer.remove();
  }
}

export function copyMessage(button) {
  const messageDiv = button.closest('.message');
  const contentDiv = messageDiv.querySelector('.message-content');
  const text = contentDiv.dataset.rawContent || contentDiv.textContent;

  navigator.clipboard.writeText(text).then(() => {
    button.style.color = '#27ae60';
    setTimeout(() => {
      button.style.color = '';
    }, 1000);
  });
}

export function getConversationHistory() {
  const messages = Array.from(dom.chatMessages.children);
  const history = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const contentDiv = msg.querySelector('.message-content');
    if (!contentDiv) continue;

    const content = contentDiv.dataset.rawContent || contentDiv.textContent || '';
    if (!content.trim()) continue;

    if (msg.classList.contains('user')) {
      history.push({ role: 'user', content });
    } else if (msg.classList.contains('assistant')) {
      history.push({ role: 'assistant', content });
    }
  }

  return history;
}

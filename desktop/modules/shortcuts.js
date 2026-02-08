import { state, dom } from './state.js';
import { startNewChat } from './chat.js';
import { toggleSidebar } from './sidebar.js';
import { toggleVoiceInput } from './voice.js';

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'n' && !e.shiftKey) {
      e.preventDefault();
      startNewChat();
      return;
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      state.thinkingMode = state.thinkingMode === 'normal' ? 'extended' : 'normal';
      document.querySelectorAll('.thinking-btn').forEach(b => {
        b.classList.toggle('active', state.thinkingMode === 'extended');
      });
      return;
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      toggleVoiceInput();
      return;
    }
  });
}

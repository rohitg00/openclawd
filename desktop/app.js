import { state, dom, loadAllChats } from './modules/state.js';
import { updateSendButton, autoResizeTextarea, handleKeyPress, handleFileSelect } from './modules/ui.js';
import { setupDropdowns, updateProviderUI } from './modules/dropdowns.js';
import { toggleSidebar, toggleLeftSidebar } from './modules/sidebar.js';
import { handleSendMessage, loadChat, renderChatHistory, startNewChat } from './modules/chat.js';
import { showOnboarding, nextOnboardingStep, saveOnboardingKeys, saveOnboardingMcp } from './modules/onboarding.js';
import { initSettings } from './modules/settings.js';
import { initShortcuts } from './modules/shortcuts.js';
import { initVoice } from './modules/voice.js';

function init() {
  setupEventListeners();
  loadAllChats(renderChatHistory, loadChat, updateProviderUI);
  renderChatHistory();

  if (!localStorage.getItem('onboarding_complete')) {
    showOnboarding();
  } else {
    dom.homeInput.focus();
  }

  initSettings();
  initShortcuts();
  initVoice();
}

function setupEventListeners() {
  dom.homeForm.addEventListener('submit', handleSendMessage);
  dom.homeInput.addEventListener('input', () => {
    updateSendButton(dom.homeInput, dom.homeSendBtn);
    autoResizeTextarea(dom.homeInput);
  });
  dom.homeInput.addEventListener('keydown', (e) => handleKeyPress(e, dom.homeForm));

  dom.chatForm.addEventListener('submit', handleSendMessage);
  dom.messageInput.addEventListener('input', () => {
    updateSendButton(dom.messageInput, dom.chatSendBtn);
    autoResizeTextarea(dom.messageInput);
  });
  dom.messageInput.addEventListener('keydown', (e) => handleKeyPress(e, dom.chatForm));

  dom.sidebarToggle.addEventListener('click', toggleSidebar);
  dom.rightSidebarExpand.addEventListener('click', toggleSidebar);

  dom.leftSidebarToggle.addEventListener('click', toggleLeftSidebar);
  dom.leftSidebarExpand.addEventListener('click', toggleLeftSidebar);

  const homeAttachBtn = document.getElementById('homeAttachBtn');
  const chatAttachBtn = document.getElementById('chatAttachBtn');
  const homeFileInput = document.getElementById('homeFileInput');
  const chatFileInput = document.getElementById('chatFileInput');

  homeAttachBtn.addEventListener('click', () => homeFileInput.click());
  chatAttachBtn.addEventListener('click', () => chatFileInput.click());
  homeFileInput.addEventListener('change', (e) => handleFileSelect(e, 'home'));
  chatFileInput.addEventListener('change', (e) => handleFileSelect(e, 'chat'));

  setupDropdowns();

  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      dom.homeInput.value = card.dataset.prompt;
      dom.homeInput.dispatchEvent(new Event('input'));
      dom.homeInput.focus();
    });
  });

  const chatSearchInput = document.getElementById('chatSearchInput');
  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', () => {
      renderChatHistory(chatSearchInput.value);
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
      document.querySelectorAll('.dropdown-container.open').forEach(d => d.classList.remove('open'));
    }
  });
}

function skipOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) overlay.classList.add('hidden');
  localStorage.setItem('onboarding_complete', 'true');
  dom.homeInput.focus();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'newChat') startNewChat();
  else if (action === 'skipOnboarding') skipOnboarding();
  else if (action === 'nextOnboardingStep') nextOnboardingStep(parseInt(btn.dataset.step));
  else if (action === 'saveOnboardingKeys') saveOnboardingKeys();
  else if (action === 'saveOnboardingMcp') saveOnboardingMcp();
});

window.addEventListener('load', init);

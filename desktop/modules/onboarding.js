import { API_BASE, dom, safeSetItem } from './state.js';

let testKeyTimers = {};

export function showOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) overlay.classList.remove('hidden');
  initKeyValidation();
}

export function hideOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) overlay.classList.add('hidden');
  safeSetItem('onboarding_complete', 'true');
  dom.homeInput.focus();
}

export function nextOnboardingStep(step) {
  const currentActive = document.querySelector('.onboarding-step.active');

  document.querySelectorAll('.onboarding-dot').forEach(d => {
    const dotStep = parseInt(d.dataset.step);
    d.classList.remove('active');
    if (dotStep < step) d.classList.add('done');
    if (dotStep === step) d.classList.add('active');
  });

  const activateStep = () => {
    const target = document.getElementById(`onboardingStep${step}`);
    if (target) target.classList.add('active');
  };

  if (currentActive) {
    currentActive.classList.add('exit-left');
    currentActive.classList.remove('active');
    setTimeout(() => {
      currentActive.classList.remove('exit-left');
      activateStep();
    }, 300);
  } else {
    activateStep();
  }
}

function initKeyValidation() {
  document.querySelectorAll('.onboarding-key-group input[data-provider]').forEach(input => {
    input.addEventListener('blur', () => {
      const provider = input.dataset.provider;
      const key = input.value.trim();
      clearTimeout(testKeyTimers[provider]);
      if (!key) {
        updateKeyStatus(provider, '');
        return;
      }
      testKeyTimers[provider] = setTimeout(() => testApiKey(provider, key), 500);
    });
  });
}

async function testApiKey(provider, apiKey) {
  const statusEl = document.querySelector(`.onboarding-key-status[data-provider="${provider}"]`);
  if (!statusEl) return;

  statusEl.className = 'onboarding-key-status key-testing';
  statusEl.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><span class="status-text">Testing...</span>';

  try {
    const response = await fetch(`${API_BASE}/api/settings/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey })
    });
    const data = await response.json();
    if (data.valid) {
      updateKeyStatus(provider, 'valid');
    } else {
      updateKeyStatus(provider, 'invalid', data.error || 'Invalid key');
    }
  } catch {
    updateKeyStatus(provider, 'invalid', 'Could not test key');
  }
}

function updateKeyStatus(provider, status, errorMsg) {
  const statusEl = document.querySelector(`.onboarding-key-status[data-provider="${provider}"]`);
  if (!statusEl) return;

  if (!status) {
    statusEl.className = 'onboarding-key-status';
    statusEl.innerHTML = '';
    return;
  }

  if (status === 'valid') {
    statusEl.className = 'onboarding-key-status key-valid';
    statusEl.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="status-text">Valid</span>';
  } else {
    statusEl.className = 'onboarding-key-status key-invalid';
    statusEl.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="status-text"></span>';
    statusEl.querySelector('.status-text').textContent = errorMsg;
  }
}

export async function saveOnboardingKeys() {
  const keys = {};
  const anthropicKey = document.getElementById('onboarding-anthropic-key')?.value?.trim();
  const openaiKey = document.getElementById('onboarding-openai-key')?.value?.trim();
  const geminiKey = document.getElementById('onboarding-gemini-key')?.value?.trim();

  if (anthropicKey) keys.anthropic = anthropicKey;
  if (openaiKey) keys.openai = openaiKey;
  if (geminiKey) keys.gemini = geminiKey;

  if (Object.keys(keys).length === 0) {
    nextOnboardingStep(3);
    return;
  }

  const step2 = document.getElementById('onboardingStep2');
  let errorEl = step2?.querySelector('.onboarding-error');

  try {
    const response = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKeys: keys })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    if (errorEl) errorEl.remove();
    nextOnboardingStep(3);
  } catch (err) {
    console.error('Failed to save onboarding keys:', err);
    if (!errorEl && step2) {
      errorEl = document.createElement('p');
      errorEl.className = 'onboarding-error';
      errorEl.style.cssText = 'color: #ef4444; font-size: 13px; margin-top: 12px; text-align: center;';
      const actions = step2.querySelector('.onboarding-actions');
      if (actions) {
        step2.insertBefore(errorEl, actions);
      } else {
        step2.appendChild(errorEl);
      }
    }
    if (errorEl) {
      errorEl.textContent = `Failed to save keys: ${err.message}. Is the server running?`;
    }
  }
}

export async function saveOnboardingMcp() {
  const checkboxes = document.querySelectorAll('#onboardingMcpList input[type="checkbox"]:checked');
  const selected = Array.from(checkboxes).map(cb => cb.value);

  for (const serverId of selected) {
    try {
      await fetch(`${API_BASE}/api/mcp/servers/from-catalog/${serverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });
    } catch (err) {
      console.error(`Failed to install MCP server ${serverId}:`, err);
    }
  }

  hideOnboarding();
}

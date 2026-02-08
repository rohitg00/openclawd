import { API_BASE, dom, safeSetItem } from './state.js';

export function showOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

export function hideOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (overlay) overlay.classList.add('hidden');
  safeSetItem('onboarding_complete', 'true');
  dom.homeInput.focus();
}

export function nextOnboardingStep(step) {
  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.onboarding-dot').forEach(d => {
    const dotStep = parseInt(d.dataset.step);
    d.classList.remove('active');
    if (dotStep < step) d.classList.add('done');
    if (dotStep === step) d.classList.add('active');
  });
  const target = document.getElementById(`onboardingStep${step}`);
  if (target) target.classList.add('active');
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

import { state, dom, safeSetItem, providerModels } from './state.js';

const providerConfig = {
  claude: { label: 'Claude', desc: 'Anthropic API' },
  opencode: { label: 'Opencode', desc: 'Opencode SDK' }
};

const chevronSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
const checkSvg = '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';

function renderProviderDropdown(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentProvider = state.selectedProvider;
  const currentLabel = providerConfig[currentProvider]?.label || 'Claude';

  const providerItems = Object.entries(providerConfig).map(([value, config]) => {
    const isSelected = value === currentProvider;
    return `<div class="dropdown-item${isSelected ? ' selected' : ''}" data-value="${value}">
      <div class="item-row">
        <span class="item-label">${config.label}</span>
        ${isSelected ? checkSvg : ''}
      </div>
      <span class="item-desc">${config.desc}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <button type="button" class="provider-selector">
      <span class="provider-label">${currentLabel}</span>
      ${chevronSvg}
    </button>
    <div class="dropdown-menu provider-menu">${providerItems}</div>`;
}

function renderModelDropdown(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const models = providerModels[state.selectedProvider] || providerModels.claude;
  const defaultModel = models.find(m => m.value === state.selectedModel) || models.find(m => m.default) || models[0];

  const modelItems = models.map(model => {
    const isSelected = model.value === defaultModel.value;
    return `<div class="dropdown-item${isSelected ? ' selected' : ''}" data-value="${model.value}">
      <div class="item-row">
        <span class="item-label">${model.label}</span>
        ${isSelected ? checkSvg : ''}
      </div>
      <span class="item-desc">${model.desc}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <button type="button" class="model-selector">
      <span class="model-label">${defaultModel.label}</span>
      ${chevronSvg}
    </button>
    <div class="dropdown-menu model-menu" data-provider="${state.selectedProvider}">${modelItems}</div>`;
}

export function setupDropdowns() {
  renderProviderDropdown('homeProviderDropdown');
  renderProviderDropdown('chatProviderDropdown');
  renderModelDropdown('homeModelDropdown');
  renderModelDropdown('chatModelDropdown');

  ['homeThinkingBtn', 'chatThinkingBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.thinkingMode = state.thinkingMode === 'normal' ? 'extended' : 'normal';
      document.querySelectorAll('.thinking-btn').forEach(b => {
        b.classList.toggle('active', state.thinkingMode === 'extended');
      });
    });
  });

  ['homeProviderDropdown', 'chatProviderDropdown'].forEach(id => {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.addEventListener('click', (e) => {
      if (e.target.closest('.provider-selector')) {
        e.stopPropagation();
        closeOtherDropdowns(dropdown);
        dropdown.classList.toggle('open');
        return;
      }

      const item = e.target.closest('.dropdown-item');
      if (!item) return;

      const value = item.dataset.value;
      if (!value) return;

      const label = item.querySelector('.item-label').textContent;
      state.selectedProvider = value;

      document.querySelectorAll('.provider-selector .provider-label').forEach(l => {
        l.textContent = label;
      });

      document.querySelectorAll('.provider-menu .dropdown-item').forEach(i => {
        const isSelected = i.dataset.value === value;
        i.classList.toggle('selected', isSelected);

        let checkIcon = i.querySelector('.check-icon');
        if (isSelected && !checkIcon) {
          const itemRow = i.querySelector('.item-row');
          if (itemRow) {
            checkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkIcon.setAttribute('class', 'check-icon');
            checkIcon.setAttribute('viewBox', '0 0 24 24');
            checkIcon.setAttribute('fill', 'none');
            checkIcon.setAttribute('stroke', 'currentColor');
            checkIcon.setAttribute('stroke-width', '2');
            checkIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
            itemRow.appendChild(checkIcon);
          }
        }
        if (checkIcon) {
          checkIcon.style.display = isSelected ? 'block' : 'none';
        }
      });

      updateModelDropdowns(value);
      safeSetItem('selectedProvider', value);
      safeSetItem('selectedModel', state.selectedModel);
      dropdown.classList.remove('open');
    });
  });

  ['homeModelDropdown', 'chatModelDropdown'].forEach(id => {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.addEventListener('click', (e) => {
      if (e.target.closest('.model-selector')) {
        e.stopPropagation();
        closeOtherDropdowns(dropdown);
        dropdown.classList.toggle('open');
        return;
      }

      const item = e.target.closest('.dropdown-item');
      if (!item) return;

      const value = item.dataset.value;
      if (!value) return;

      const label = item.querySelector('.item-label').textContent;
      state.selectedModel = value;

      document.querySelectorAll('.model-selector .model-label').forEach(l => {
        l.textContent = label;
      });

      document.querySelectorAll('.model-menu .dropdown-item').forEach(i => {
        const isSelected = i.dataset.value === value;
        i.classList.toggle('selected', isSelected);
        const checkIcon = i.querySelector('.check-icon');
        if (checkIcon) {
          checkIcon.style.display = isSelected ? 'block' : 'none';
        }
      });

      safeSetItem('selectedModel', value);
      dropdown.classList.remove('open');
    });
  });
}

export function updateModelDropdowns(provider) {
  const models = providerModels[provider] || providerModels.claude;
  const defaultModel = models.find(m => m.default) || models[0];
  state.selectedModel = defaultModel.value;
  safeSetItem('selectedModel', state.selectedModel);

  const modelItemsHtml = models.map(model => `
    <div class="dropdown-item${model.default ? ' selected' : ''}" data-value="${model.value}">
      <div class="item-row">
        <span class="item-label">${model.label}</span>
        ${model.default ? checkSvg : ''}
      </div>
      <span class="item-desc">${model.desc}</span>
    </div>
  `).join('');

  document.querySelectorAll('.model-menu').forEach(menu => {
    menu.innerHTML = modelItemsHtml;
    menu.dataset.provider = provider;
  });

  document.querySelectorAll('.model-selector .model-label').forEach(l => {
    l.textContent = defaultModel.label;
  });
}

export function updateProviderUI(provider) {
  const config = providerConfig[provider];
  const providerLabel = config?.label || 'Claude';
  document.querySelectorAll('.provider-selector .provider-label').forEach(l => {
    l.textContent = providerLabel;
  });
  document.querySelectorAll('.provider-menu .dropdown-item').forEach(item => {
    const isSelected = item.dataset.value === provider;
    item.classList.toggle('selected', isSelected);
    const checkIcon = item.querySelector('.check-icon');
    if (checkIcon) {
      checkIcon.style.display = isSelected ? 'block' : 'none';
    }
  });
  updateModelDropdowns(provider);
}

function closeOtherDropdowns(currentDropdown) {
  document.querySelectorAll('.dropdown-container.open').forEach(d => {
    if (d !== currentDropdown) d.classList.remove('open');
  });
}

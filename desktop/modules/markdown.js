import { state, dom, saveState } from './state.js';
import { scrollToBottom } from './ui.js';
import { extractBrowserUrl, addInlineBrowserEmbed } from './browser.js';

export function getCurrentMarkdownContainer(contentDiv) {
  const chunkIndex = parseInt(contentDiv.dataset.currentChunk || '0');
  let container = contentDiv.querySelector(`.markdown-content[data-chunk="${chunkIndex}"]`);

  if (!container) {
    container = document.createElement('div');
    container.className = 'markdown-content';
    container.dataset.chunk = chunkIndex;
    container.dataset.rawContent = '';
    contentDiv.appendChild(container);
  }

  return container;
}

function enhanceCodeBlocks(container) {
  container.querySelectorAll('pre > code').forEach(codeEl => {
    const pre = codeEl.parentElement;
    if (pre.querySelector('.code-block-header')) return;

    let lang = '';
    const classList = codeEl.className || '';
    const match = classList.match(/language-(\S+)/);
    if (match) lang = match[1];

    const header = document.createElement('div');
    header.className = 'code-block-header';

    const label = document.createElement('span');
    label.textContent = lang || 'code';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeEl.textContent).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    header.appendChild(label);
    header.appendChild(copyBtn);
    pre.insertBefore(header, pre.firstChild);
  });
}

export function renderMarkdownContainer(container) {
  const rawContent = container.dataset.rawContent || '';
  marked.setOptions({ breaks: true, gfm: true });
  if (typeof DOMPurify === 'undefined') {
    container.textContent = rawContent;
    return;
  }
  container.innerHTML = DOMPurify.sanitize(marked.parse(rawContent));
  enhanceCodeBlocks(container);
}

export function renderMarkdown(contentDiv) {
  const rawContent = contentDiv.dataset.rawContent || '';
  marked.setOptions({ breaks: true, gfm: true });

  let markdownContainer = contentDiv.querySelector('.markdown-content');
  if (!markdownContainer) {
    markdownContainer = document.createElement('div');
    markdownContainer.className = 'markdown-content';
    contentDiv.appendChild(markdownContainer);
  }

  if (typeof DOMPurify === 'undefined') {
    markdownContainer.textContent = rawContent;
    return;
  }
  markdownContainer.innerHTML = DOMPurify.sanitize(marked.parse(rawContent));
  enhanceCodeBlocks(markdownContainer);
}

export function appendToContent(contentDiv, content) {
  if (!contentDiv.dataset.rawContent) {
    contentDiv.dataset.rawContent = '';
  }
  contentDiv.dataset.rawContent += content;

  const container = getCurrentMarkdownContainer(contentDiv);
  container.dataset.rawContent += content;
  renderMarkdownContainer(container);

  const browserInfo = extractBrowserUrl(contentDiv.dataset.rawContent);
  if (browserInfo && !state.activeBrowserSession) {
    addInlineBrowserEmbed(contentDiv, browserInfo.url, browserInfo.sessionId);
  }

  saveState();
}

export function appendToThinking(contentDiv, content) {
  let thinkingSection = contentDiv.querySelector('.thinking-section');

  if (!thinkingSection) {
    thinkingSection = document.createElement('details');
    thinkingSection.className = 'thinking-section';
    thinkingSection.open = false;

    const summary = document.createElement('summary');
    summary.className = 'thinking-header';
    summary.innerHTML = '<span class="thinking-icon">&#x1F4AD;</span> Thinking...';
    thinkingSection.appendChild(summary);

    const thinkingContent = document.createElement('div');
    thinkingContent.className = 'thinking-content';
    thinkingContent.dataset.rawContent = '';
    thinkingSection.appendChild(thinkingContent);

    contentDiv.insertBefore(thinkingSection, contentDiv.firstChild);
  }

  const thinkingContent = thinkingSection.querySelector('.thinking-content');
  thinkingContent.dataset.rawContent += content;
  thinkingContent.textContent = thinkingContent.dataset.rawContent;

  const summary = thinkingSection.querySelector('.thinking-header');
  const thinkingLength = thinkingContent.dataset.rawContent.length;
  summary.innerHTML = `<span class="thinking-icon">&#x1F4AD;</span> Thinking (${thinkingLength} chars)`;
}

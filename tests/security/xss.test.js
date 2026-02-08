import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readDesktopFile(relativePath) {
  return readFileSync(join(__dirname, '../../', relativePath), 'utf-8');
}

describe('XSS prevention', () => {
  it('DOMPurify is loaded in index.html', () => {
    const html = readDesktopFile('desktop/index.html');
    expect(html).toContain('dompurify');
    expect(html).toContain('purify.min.js');
  });

  it('all marked.parse calls are guarded by DOMPurify', () => {
    const markdownJs = readDesktopFile('desktop/modules/markdown.js');
    const sanitizedCalls = markdownJs.match(/DOMPurify\.sanitize\(marked\.parse\(/g) || [];
    expect(sanitizedCalls.length).toBeGreaterThan(0);

    const lines = markdownJs.split('\n');
    for (const line of lines) {
      if (line.includes('.innerHTML') && line.includes('marked.parse(')) {
        const hasSanitize = line.includes('DOMPurify.sanitize');
        const hasFallbackGuard = markdownJs.includes("typeof DOMPurify !== 'undefined'");
        expect(hasSanitize || hasFallbackGuard).toBe(true);
      }
    }
  });

  it('no direct innerHTML = marked.parse without DOMPurify guard', () => {
    const markdownJs = readDesktopFile('desktop/modules/markdown.js');
    const lines = markdownJs.split('\n');
    for (const line of lines) {
      if (line.includes('.innerHTML') && line.includes('marked.parse(')) {
        expect(line).toContain('DOMPurify');
      }
    }
  });

  it('CSP headers are set in main.js', () => {
    const mainJs = readDesktopFile('main.js');
    expect(mainJs).toContain('Content-Security-Policy');
    expect(mainJs).toContain("default-src 'self'");
    expect(mainJs).toContain('onHeadersReceived');
  });

  it('external URL validation exists in main.js', () => {
    const mainJs = readDesktopFile('main.js');
    expect(mainJs).toContain('isSafeExternalUrl');
    expect(mainJs).toContain("'https:'");
    expect(mainJs).toContain("'http:'");
    expect(mainJs).toContain("'mailto:'");
  });
});

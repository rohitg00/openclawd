import path from 'path';
import { existsSync, statSync } from 'fs';

const BLOCKED_PATTERNS = [
  /\.\.[\\/]/,
  /~[\\/]/,
  /\0/
];

const SENSITIVE_PATHS = [
  '.env',
  '.git',
  'node_modules',
  '.ssh',
  '.gnupg',
  '.aws',
  'credentials',
  'secrets'
];

export class Workspace {
  constructor(rootPath, options = {}) {
    if (!rootPath) throw new Error('Workspace root path is required');
    this.root = path.resolve(rootPath);
    this.allowDotfiles = options.allowDotfiles || false;
    this.allowedExtensions = options.allowedExtensions || null;
    this.blockedPaths = options.blockedPaths || SENSITIVE_PATHS;
  }

  resolve(filePath) {
    if (!filePath) throw new Error('File path is required');

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(filePath)) {
        throw new Error(`Path contains blocked pattern: ${filePath}`);
      }
    }

    const resolved = path.resolve(this.root, filePath);

    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error(`Path escapes workspace: ${filePath}`);
    }

    const relative = path.relative(this.root, resolved);
    const segments = relative.split(path.sep);

    for (const segment of segments) {
      if (!this.allowDotfiles && segment.startsWith('.') && segment !== '.') {
        throw new Error(`Dotfile access not allowed: ${filePath}`);
      }
    }

    for (const blocked of this.blockedPaths) {
      if (segments.some(s => s.toLowerCase() === blocked.toLowerCase())) {
        throw new Error(`Access to '${blocked}' is restricted: ${filePath}`);
      }
    }

    if (this.allowedExtensions) {
      const ext = path.extname(resolved).toLowerCase();
      if (ext && !this.allowedExtensions.includes(ext)) {
        throw new Error(`File extension '${ext}' not allowed: ${filePath}`);
      }
    }

    return resolved;
  }

  validate(filePath) {
    try {
      const resolved = this.resolve(filePath);
      return { valid: true, resolved };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  exists(filePath) {
    try {
      const resolved = this.resolve(filePath);
      return existsSync(resolved);
    } catch {
      return false;
    }
  }

  isFile(filePath) {
    try {
      const resolved = this.resolve(filePath);
      return existsSync(resolved) && statSync(resolved).isFile();
    } catch {
      return false;
    }
  }

  isDirectory(filePath) {
    try {
      const resolved = this.resolve(filePath);
      return existsSync(resolved) && statSync(resolved).isDirectory();
    } catch {
      return false;
    }
  }

  relativePath(absolutePath) {
    const resolved = path.resolve(absolutePath);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error('Path is outside workspace');
    }
    return path.relative(this.root, resolved);
  }
}

export function createWorkspace(rootPath, options) {
  return new Workspace(rootPath, options);
}

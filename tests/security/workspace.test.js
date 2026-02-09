import { describe, it, expect } from 'vitest';
import path from 'path';
import { Workspace, createWorkspace } from '../../server/workspace.js';

describe('Workspace restriction', () => {
  const root = '/tmp/test-workspace';

  it('creates workspace with root path', () => {
    const ws = new Workspace(root);
    expect(ws.root).toBe(path.resolve(root));
  });

  it('throws without root path', () => {
    expect(() => new Workspace()).toThrow('Workspace root path is required');
  });

  it('resolves valid paths within workspace', () => {
    const ws = new Workspace(root);
    const resolved = ws.resolve('file.txt');
    expect(resolved).toBe(path.join(root, 'file.txt'));
  });

  it('resolves nested paths', () => {
    const ws = new Workspace(root);
    const resolved = ws.resolve('subdir/file.txt');
    expect(resolved).toBe(path.join(root, 'subdir/file.txt'));
  });

  it('blocks path traversal with ..', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve('../etc/passwd')).toThrow('blocked pattern');
  });

  it('blocks null bytes', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve('file\0.txt')).toThrow('blocked pattern');
  });

  it('blocks paths escaping workspace via absolute path', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve('/etc/passwd')).toThrow('escapes workspace');
  });

  it('blocks dotfiles by default', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve('.env')).toThrow('Dotfile access not allowed');
  });

  it('allows dotfiles when configured', () => {
    const ws = new Workspace(root, { allowDotfiles: true });
    const resolved = ws.resolve('.config');
    expect(resolved).toBe(path.join(root, '.config'));
  });

  it('blocks sensitive paths', () => {
    const ws = new Workspace(root, { allowDotfiles: true });
    expect(() => ws.resolve('.git/config')).toThrow("Access to '.git' is restricted");
  });

  it('blocks node_modules access', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve('node_modules/pkg/index.js')).toThrow("Access to 'node_modules' is restricted");
  });

  it('enforces allowed extensions', () => {
    const ws = new Workspace(root, { allowedExtensions: ['.txt', '.md'] });
    expect(() => ws.resolve('script.sh')).toThrow("File extension '.sh' not allowed");
  });

  it('allows matching extensions', () => {
    const ws = new Workspace(root, { allowedExtensions: ['.txt', '.md'] });
    const resolved = ws.resolve('readme.md');
    expect(resolved).toBe(path.join(root, 'readme.md'));
  });

  it('validate returns valid result for good paths', () => {
    const ws = new Workspace(root);
    const result = ws.validate('file.txt');
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe(path.join(root, 'file.txt'));
  });

  it('validate returns error for bad paths', () => {
    const ws = new Workspace(root);
    const result = ws.validate('../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('blocked pattern');
  });

  it('relativePath computes relative from absolute', () => {
    const ws = new Workspace(root);
    const rel = ws.relativePath(path.join(root, 'subdir/file.txt'));
    expect(rel).toBe(path.join('subdir', 'file.txt'));
  });

  it('relativePath throws for outside paths', () => {
    const ws = new Workspace(root);
    expect(() => ws.relativePath('/etc/passwd')).toThrow('outside workspace');
  });

  it('createWorkspace helper works', () => {
    const ws = createWorkspace(root);
    expect(ws).toBeInstanceOf(Workspace);
    expect(ws.root).toBe(path.resolve(root));
  });

  it('blocks custom blocked paths', () => {
    const ws = new Workspace(root, { blockedPaths: ['secret-dir'] });
    expect(() => ws.resolve('secret-dir/data.json')).toThrow("Access to 'secret-dir' is restricted");
  });

  it('requires file path argument', () => {
    const ws = new Workspace(root);
    expect(() => ws.resolve()).toThrow('File path is required');
  });
});

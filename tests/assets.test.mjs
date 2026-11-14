import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateAssets } from '../scripts/verify-assets.mjs';

test('accepts a declared PNG file with accessible description', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hhm-assets-'));
  try {
    mkdirSync(path.join(root, 'branding'));
    writeFileSync(path.join(root, 'branding', 'app-logo.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.deepEqual(validateAssets(root, {
      schemaVersion: 1,
      assets: [{id: 'app-logo', path: 'branding/app-logo.png', mediaType: 'image/png', alt: 'App logo'}]
    }), []);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('rejects directory traversal, duplicates and missing files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hhm-assets-'));
  try {
    const errors = validateAssets(root, {
      schemaVersion: 1,
      assets: [
        {id: 'logo', path: '../private.png', mediaType: 'image/png', alt: 'Logo'},
        {id: 'logo', path: 'branding/missing.png', mediaType: 'image/png', alt: ''}
      ]
    });
    assert.ok(errors.some((error) => error.includes('unsafe relative path')));
    assert.ok(errors.some((error) => error.includes('duplicate id')));
    assert.ok(errors.some((error) => error.includes('missing file')));
    assert.ok(errors.some((error) => error.includes('alt text')));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('rejects renamed text files and files above the configured size bound', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hhm-assets-'));
  try {
    mkdirSync(path.join(root, 'branding'));
    writeFileSync(path.join(root, 'branding', 'not-a-png.png'), 'not a PNG');
    const oversized = path.join(root, 'branding', 'too-large.png');
    writeFileSync(oversized, Buffer.from('89504e470d0a1a0a', 'hex'));
    truncateSync(oversized, 10 * 1024 * 1024 + 1);
    const errors = validateAssets(root, {
      schemaVersion: 1,
      assets: [
        { id: 'text', path: 'branding/not-a-png.png', mediaType: 'image/png', alt: 'Text' },
        { id: 'huge', path: 'branding/too-large.png', mediaType: 'image/png', alt: 'Huge image' }
      ]
    });
    assert.ok(errors.some((error) => error.includes('PNG signature')), errors.join('\n'));
    assert.ok(errors.some((error) => error.includes('10 MiB')), errors.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a symlinked file and symlinked parent even when they point inside root', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hhm-assets-'));
  try {
    mkdirSync(path.join(root, 'branding'));
    writeFileSync(path.join(root, 'branding', 'app-logo.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    symlinkSync(path.join(root, 'branding', 'app-logo.png'), path.join(root, 'branding', 'alias.png'));
    symlinkSync(path.join(root, 'branding'), path.join(root, 'alias'), 'dir');
    const errors = validateAssets(root, {
      schemaVersion: 1,
      assets: [
        { id: 'direct', path: 'branding/alias.png', mediaType: 'image/png', alt: 'Direct alias' },
        { id: 'parent', path: 'alias/app-logo.png', mediaType: 'image/png', alt: 'Parent alias' }
      ]
    });
    assert.equal(errors.filter((error) => error.includes('symlinks are not permitted')).length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

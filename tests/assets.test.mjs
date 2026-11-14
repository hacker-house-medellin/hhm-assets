import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateAssets } from '../scripts/verify-assets.mjs';

test('accepts a declared PNG file with accessible description', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hhm-assets-'));
  try {
    mkdirSync(path.join(root, 'branding'));
    writeFileSync(path.join(root, 'branding', 'app-logo.png'), 'fixture');
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

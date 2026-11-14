import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validateAssets(root, manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    return ['asset manifest must have schemaVersion 1 and an assets array'];
  }
  const seen = new Set();
  for (const [index, asset] of manifest.assets.entries()) {
    const where = `assets[${index}]`;
    if (typeof asset?.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(asset.id)) {
      errors.push(`${where}: invalid id`);
    } else if (seen.has(asset.id)) {
      errors.push(`${where}: duplicate id ${asset.id}`);
    } else {
      seen.add(asset.id);
    }
    const relative = asset?.path;
    if (typeof relative !== 'string' || relative.includes('\\') ||
        relative.startsWith('/') || relative.split('/').some((part) => part === '..' || part === '.' || part === '') ||
        !/^[a-zA-Z0-9_./-]+$/.test(relative)) {
      errors.push(`${where}: unsafe relative path`);
      continue;
    }
    if (asset.mediaType !== 'image/png' || !relative.endsWith('.png')) {
      errors.push(`${where}: unsupported media type or extension`);
    }
    if (typeof asset.alt !== 'string' || !asset.alt.trim()) {
      errors.push(`${where}: accessible alt text is required`);
    }
    const candidate = path.resolve(root, relative);
    if (!existsSync(candidate)) {
      errors.push(`${where}: missing file ${relative}`);
      continue;
    }
    const real = realpathSync(candidate);
    if (!real.startsWith(realpathSync(root) + path.sep) || !lstatSync(candidate).isFile()) {
      errors.push(`${where}: asset escapes root or is not a regular file`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'asset-manifest.json'), 'utf8'));
  const errors = validateAssets(repositoryRoot, manifest);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Verified ${manifest.assets.length} asset(s)`);
  }
}

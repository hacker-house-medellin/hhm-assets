import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

function hasPngSignature(file) {
  const descriptor = openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(PNG_SIGNATURE.length);
    return readSync(descriptor, bytes, 0, bytes.length, 0) === bytes.length
      && bytes.equals(PNG_SIGNATURE);
  } finally {
    closeSync(descriptor);
  }
}


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
    let inspected = realpathSync(root);
    const symlinked = relative.split('/').some((part) => {
      inspected = path.join(inspected, part);
      return lstatSync(inspected).isSymbolicLink();
    });
    if (symlinked) {
      errors.push(`${where}: symlinks are not permitted in asset paths`);
      continue;
    }
    const real = realpathSync(candidate);
    const file = lstatSync(candidate);
    if (!real.startsWith(realpathSync(root) + path.sep) || !file.isFile()) {
      errors.push(`${where}: asset escapes root or is not a regular file`);
      continue;
    }
    if (file.size > MAX_ASSET_BYTES) {
      errors.push(`${where}: asset exceeds 10 MiB`);
    } else if (!hasPngSignature(candidate)) {
      errors.push(`${where}: file does not have a PNG signature`);
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

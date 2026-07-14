#!/usr/bin/env node
/**
 * RWYCAST — versión de producto (footer).
 * Fuente única: version.json → genera js/config/version.js
 *
 * Uso:
 *   node scripts/bump-version.mjs patch   # 0.0.1 → 0.0.2 (fixes, estética)
 *   node scripts/bump-version.mjs minor   # 0.0.2 → 0.1.0 (módulos, features)
 *   node scripts/bump-version.mjs major   # 0.1.0 → 1.0.0 (cambios grandes)
 *   node scripts/bump-version.mjs sync    # solo regenera version.js
 *
 * Hooks (opcional, una vez por clon): git config core.hooksPath .githooks
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_JSON = path.join(ROOT, 'version.json');
const VERSION_JS = path.join(ROOT, 'js/config/version.js');

function readVersion() {
  return JSON.parse(fs.readFileSync(VERSION_JSON, 'utf8'));
}

function label(v) {
  return `v${v.major}.${v.minor}.${v.patch}`;
}

function writeVersion(v) {
  fs.writeFileSync(VERSION_JSON, JSON.stringify(v, null, 2) + '\n');
  const tag = label(v);
  fs.writeFileSync(
    VERSION_JS,
    `// Auto-generado — no editar a mano. Fuente: version.json (scripts/bump-version.mjs)\nconst APP_VERSION='${tag}';\n`
  );
  return tag;
}

const cmd = process.argv[2] || 'sync';
const v = readVersion();

if (cmd === 'sync') {
  console.log(writeVersion(v));
  process.exit(0);
}

if (cmd === 'patch') v.patch += 1;
else if (cmd === 'minor') { v.minor += 1; v.patch = 0; }
else if (cmd === 'major') { v.major += 1; v.minor = 0; v.patch = 0; }
else {
  console.error('Uso: node scripts/bump-version.mjs patch|minor|major|sync');
  process.exit(1);
}

console.log(writeVersion(v));

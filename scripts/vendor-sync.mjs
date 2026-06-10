#!/usr/bin/env node
/**
 * Re-vendor the Refácil Pay skill files from the globally installed
 * `refacil-pay-cli` npm package into this repository.
 *
 * The skill files under refacil-pay/skills/refacil-pay-cli/ are byte-for-byte
 * copies of the published npm package (validated by contract test CA-04).
 * Whenever the CLI is updated (`npm install -g refacil-pay-cli`), run this
 * script to refresh the vendored copy, then `node --test`.
 *
 * Byte-for-byte copy: line endings are preserved exactly as published. The
 * `.gitattributes` rule marks the vendored dir as `-text`, so git never
 * rewrites EOL — keeping the committed blob identical to the npm source.
 *
 * Usage:
 *   node scripts/vendor-sync.mjs            # sync, report changed files
 *   node scripts/vendor-sync.mjs --check    # exit 1 if out of sync (CI guard)
 *
 * No dependencies — Node.js built-ins only.
 */
import { execSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// --- Names (kept explicit so the plugin/CLI/skill distinction stays clear) ---
const NPM_PKG = 'refacil-pay-cli';                          // npm package / CLI binary (NOT the plugin name)
const PLUGIN_DIR = 'refacil-pay';                           // this repo's plugin folder
const SKILL_SUBPATH = join('skills', 'refacil-pay-cli');    // skill dir inside both the pkg and the plugin

const checkOnly = process.argv.includes('--check');

/** Resolve the npm global node_modules root. */
function npmGlobalRoot() {
  return execSync('npm root -g', { encoding: 'utf8', timeout: 10_000 }).trim();
}

/** Recursively list files under `base`, returned as paths relative to `base`. */
function listFiles(base, rel = '') {
  const out = [];
  for (const entry of readdirSync(join(base, rel))) {
    const r = rel ? join(rel, entry) : entry;
    if (statSync(join(base, r)).isDirectory()) out.push(...listFiles(base, r));
    else out.push(r);
  }
  return out;
}

const npmRoot = npmGlobalRoot();
const srcDir = join(npmRoot, NPM_PKG, SKILL_SUBPATH);
const dstDir = join(REPO_ROOT, PLUGIN_DIR, SKILL_SUBPATH);

if (!existsSync(srcDir)) {
  console.error(
    `✗ Source skill dir not found: ${srcDir}\n` +
    `  Install the CLI first:  npm install -g ${NPM_PKG}`,
  );
  process.exit(1);
}

const srcFiles = listFiles(srcDir);
const changed = [];
for (const f of srcFiles) {
  const src = readFileSync(join(srcDir, f));
  const dstPath = join(dstDir, f);
  const dst = existsSync(dstPath) ? readFileSync(dstPath) : null;
  if (dst === null || !src.equals(dst)) {
    changed.push(f);
    if (!checkOnly) {
      mkdirSync(dirname(dstPath), { recursive: true });
      writeFileSync(dstPath, src); // byte-for-byte
    }
  }
}

// Warn about files vendored here that no longer exist upstream (manual cleanup).
const stale = existsSync(dstDir)
  ? listFiles(dstDir).filter((f) => !srcFiles.includes(f))
  : [];

if (changed.length === 0 && stale.length === 0) {
  console.log('✓ Vendored skill files are already in sync with the global npm package.');
  process.exit(0);
}

if (checkOnly) {
  console.error('✗ Out of sync with the global npm package:');
  for (const f of changed) console.error(`  ~ ${f}`);
  for (const f of stale) console.error(`  - ${f} (removed upstream — delete manually)`);
  console.error('Run:  node scripts/vendor-sync.mjs   (then: node --test)');
  process.exit(1);
}

if (changed.length) {
  console.log(`✓ Re-vendored ${changed.length} file(s) from ${NPM_PKG}:`);
  for (const f of changed) console.log(`  ~ ${f}`);
}
if (stale.length) {
  console.log(`⚠ ${stale.length} vendored file(s) no longer exist upstream (delete manually):`);
  for (const f of stale) console.log(`  - ${f}`);
}
console.log('Next: node --test');

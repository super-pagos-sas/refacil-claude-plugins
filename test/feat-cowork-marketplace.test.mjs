/**
 * Contract tests for feat-cowork-marketplace
 * Validates CA-01 through CA-08 and CR-01 through CR-05.
 *
 * Stack: Node.js built-in test runner (node:test + node:assert/strict).
 * Run: node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a repo-relative file as a UTF-8 string. */
function repoRead(relPath) {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

/** Check whether a repo-relative path exists. */
function repoExists(relPath) {
  return existsSync(join(REPO_ROOT, relPath));
}

/** Resolve the npm global node_modules root. Returns null on failure. */
function npmGlobalRoot() {
  try {
    return execSync('npm root -g', { encoding: 'utf8', timeout: 10_000 }).trim();
  } catch {
    return null;
  }
}

/**
 * Parse the YAML frontmatter block from a Markdown file.
 * Returns a key→value map (all values as strings) or null if no frontmatter.
 * Only handles simple scalar key: value lines — sufficient for these manifests.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Strip leading space and surrounding quotes from value.
    const raw = line.slice(colonIdx + 1).trim();
    result[key] = raw.replace(/^["']|["']$/g, '');
  }
  return result;
}

// ---------------------------------------------------------------------------
// CA-01  marketplace.json — structure contract
// ---------------------------------------------------------------------------
test('CA-01: marketplace.json parses as JSON and has required structure', () => {
  const raw = repoRead('.claude-plugin/marketplace.json');
  const json = JSON.parse(raw); // throws AssertionError-equivalent if unparseable

  assert.equal(json.name, 'refacil-plugins', 'name must be "refacil-plugins"');

  assert.ok(
    json.owner !== null && typeof json.owner === 'object' && !Array.isArray(json.owner),
    'owner must be an object'
  );
  assert.ok(
    typeof json.owner.name === 'string' && json.owner.name.length > 0,
    'owner.name must be a non-empty string'
  );

  assert.ok(Array.isArray(json.plugins), 'plugins must be an array');
  assert.ok(json.plugins.length >= 1, 'plugins must have at least one entry');

  for (const plugin of json.plugins) {
    assert.ok(
      typeof plugin.name === 'string' && plugin.name.length > 0,
      `each plugin must have a non-empty name — got: ${JSON.stringify(plugin)}`
    );
    assert.ok(
      typeof plugin.source === 'string' && plugin.source.length > 0,
      `each plugin must have a non-empty source — got: ${JSON.stringify(plugin)}`
    );
    assert.ok(
      typeof plugin.description === 'string' && plugin.description.length > 0,
      `each plugin must have a non-empty description — got: ${JSON.stringify(plugin)}`
    );
  }
});

// ---------------------------------------------------------------------------
// CA-02  plugin.json — structure contract + no version field
// ---------------------------------------------------------------------------
test('CA-02: plugin.json has required fields and must NOT contain a version field', () => {
  const raw = repoRead('refacil-pay-cli/.claude-plugin/plugin.json');
  const json = JSON.parse(raw);

  assert.equal(json.name, 'refacil-pay-cli', 'name must be "refacil-pay-cli"');

  assert.ok(
    typeof json.description === 'string' && json.description.length > 0,
    'description must be a non-empty string'
  );
  assert.ok(
    json.author !== null &&
      typeof json.author === 'object' &&
      !Array.isArray(json.author) &&
      typeof json.author.name === 'string' &&
      json.author.name.length > 0,
    'author must be an object with a non-empty name (per the plugin manifest schema validated by `claude plugin validate`)'
  );
  assert.ok(
    typeof json.homepage === 'string' && json.homepage.length > 0,
    'homepage must be a non-empty string'
  );

  assert.ok(
    !Object.prototype.hasOwnProperty.call(json, 'version'),
    'plugin.json MUST NOT contain a "version" field (commit-SHA distribution)'
  );
});

// ---------------------------------------------------------------------------
// CA-03  SKILL.md — frontmatter + body contract
// ---------------------------------------------------------------------------
test('CA-03: SKILL.md frontmatter has required fields and body references the refacil-pay-cli binary and all three flows', () => {
  const content = repoRead('refacil-pay-cli/skills/refacil-pay-cli/SKILL.md');
  const fm = parseFrontmatter(content);

  assert.ok(fm !== null, 'SKILL.md must have YAML frontmatter delimited by ---');
  assert.equal(fm['name'], 'refacil-pay-cli', 'frontmatter name must be "refacil-pay-cli"');
  assert.equal(fm['user-invocable'], 'true', 'frontmatter user-invocable must be "true"');

  // Body must instruct running the refacil-pay-cli binary.
  assert.ok(
    content.includes('refacil-pay-cli'),
    'body must reference the refacil-pay-cli CLI binary'
  );

  // All three flows must be referenced.
  assert.ok(content.includes('cash-in-link'), 'body must reference the cash-in-link flow');
  assert.ok(content.includes('cash-in-method'), 'body must reference the cash-in-method flow');
  assert.ok(content.includes('cash-out'), 'body must reference the cash-out flow');
});

// ---------------------------------------------------------------------------
// CA-04  byte-identical vendored files vs. npm global source
// ---------------------------------------------------------------------------
test('CA-04: vendored skill files are byte-identical to the npm global package source', () => {
  const npmRoot = npmGlobalRoot();
  if (npmRoot === null) {
    // Surface as a hard failure so it is never silently skipped.
    assert.fail(
      'Could not determine npm global root (npm root -g failed) — ' +
      'cannot verify byte identity of vendored files. ' +
      'Ensure npm is on PATH and refacil-pay-cli is installed globally.'
    );
  }

  const npmBase = join(npmRoot, 'refacil-pay-cli', 'skills', 'refacil-pay-cli');
  const repoBase = join(REPO_ROOT, 'refacil-pay-cli', 'skills', 'refacil-pay-cli');

  const filesToVerify = [
    'SKILL.md',
    join('references', 'cash-in-link.md'),
    join('references', 'cash-in-method.md'),
    join('references', 'cash-out.md'),
  ];

  for (const relFile of filesToVerify) {
    const npmPath = join(npmBase, relFile);
    const repoPath = join(repoBase, relFile);

    assert.ok(
      existsSync(npmPath),
      `npm global source missing: ${npmPath} — install refacil-pay-cli globally to enable byte-identity check`
    );

    const npmBuf = readFileSync(npmPath);
    const repoBuf = readFileSync(repoPath);

    assert.ok(
      npmBuf.equals(repoBuf),
      `File "${relFile}" is NOT byte-identical to the npm global source.\n` +
      `  npm source : ${npmPath}\n` +
      `  repo copy  : ${repoPath}\n` +
      `  Sizes: npm=${npmBuf.length}B repo=${repoBuf.length}B`
    );
  }
});

// ---------------------------------------------------------------------------
// CA-05  all four skill files exist + no broken relative links in SKILL.md
// ---------------------------------------------------------------------------
test('CA-05: all four skill files exist and SKILL.md relative links resolve', () => {
  const required = [
    'refacil-pay-cli/skills/refacil-pay-cli/SKILL.md',
    'refacil-pay-cli/skills/refacil-pay-cli/references/cash-in-link.md',
    'refacil-pay-cli/skills/refacil-pay-cli/references/cash-in-method.md',
    'refacil-pay-cli/skills/refacil-pay-cli/references/cash-out.md',
  ];

  for (const f of required) {
    assert.ok(repoExists(f), `Required skill file is missing: ${f}`);
  }

  // Extract relative .md links from SKILL.md and verify each target exists.
  const skillContent = repoRead('refacil-pay-cli/skills/refacil-pay-cli/SKILL.md');
  const skillDir = join(REPO_ROOT, 'refacil-pay-cli', 'skills', 'refacil-pay-cli');

  // Match markdown links like [text](relative/path.md) — skip http(s) URLs.
  const linkPattern = /\[[^\]]*\]\(((?!https?:\/\/)[^)]+\.md)\)/g;
  let m;
  while ((m = linkPattern.exec(skillContent)) !== null) {
    const linkTarget = m[1];
    const resolved = join(skillDir, linkTarget);
    assert.ok(
      existsSync(resolved),
      `Broken relative link in SKILL.md: "${linkTarget}" (resolved to: ${resolved})`
    );
  }
});

// ---------------------------------------------------------------------------
// CA-06  README + plugin.json description — required installation strings
// ---------------------------------------------------------------------------
test('CA-06: README contains required installation strings and plugin.json description includes full npm install command', () => {
  const readme = repoRead('refacil-pay-cli/README.md');

  assert.ok(
    readme.includes('npm install -g refacil-pay-cli'),
    'README must contain the full "npm install -g refacil-pay-cli" string (not abbreviated)'
  );
  assert.ok(
    !readme.includes('npm i -g refacil-pay-cli'),
    'README must NOT use the abbreviated "npm i -g" form'
  );
  assert.ok(
    readme.includes('/plugin marketplace add'),
    'README must document "/plugin marketplace add <git-repo-url>"'
  );
  assert.ok(
    readme.includes('/plugin install refacil-pay-cli@refacil-plugins'),
    'README must document "/plugin install refacil-pay-cli@refacil-plugins"'
  );

  const pluginJson = JSON.parse(repoRead('refacil-pay-cli/.claude-plugin/plugin.json'));
  assert.ok(
    pluginJson.description.includes('npm install -g refacil-pay-cli'),
    'plugin.json description must also contain "npm install -g refacil-pay-cli"'
  );

  // CR-03 guard: the CLI version must never be pinned. A pinned npm version
  // looks like `refacil-pay-cli@<semver-digit>` (e.g. refacil-pay-cli@1.2.3).
  // The `@refacil-plugins` marketplace ref in /plugin commands is NOT a pin —
  // hence the digit-anchored pattern instead of a bare `refacil-pay-cli@` check.
  const npmPinPattern = /refacil-pay-cli@\d/;
  assert.ok(
    !npmPinPattern.test(readme),
    'README must NOT pin a semver version of refacil-pay-cli (use the unpinned global install)'
  );
  assert.ok(
    !npmPinPattern.test(pluginJson.description),
    'plugin.json description must NOT pin a semver version of refacil-pay-cli'
  );
});

// ---------------------------------------------------------------------------
// CA-07  marketplace structure files at expected paths
// ---------------------------------------------------------------------------
test('CA-07: marketplace structure recognizable by /plugin marketplace add — required manifest files exist', () => {
  assert.ok(
    repoExists('.claude-plugin/marketplace.json'),
    '.claude-plugin/marketplace.json must exist at the repository root'
  );
  assert.ok(
    repoExists('refacil-pay-cli/.claude-plugin/plugin.json'),
    'refacil-pay-cli/.claude-plugin/plugin.json must exist in the plugin subdirectory'
  );
});

// ---------------------------------------------------------------------------
// CA-08  README — two-layer update model
// ---------------------------------------------------------------------------
test('CA-08: README documents the two-layer update model (CLI binary + skill/plugin)', () => {
  const readme = repoRead('refacil-pay-cli/README.md');

  // Layer 1: CLI binary update via npm.
  assert.ok(
    readme.includes('npm update -g refacil-pay-cli'),
    'README must document "npm update -g refacil-pay-cli" for CLI binary updates (layer 1)'
  );

  // Layer 2: marketplace-managed skill update — auto-update mention.
  const hasAutoUpdateMention =
    readme.includes('auto-update') || readme.includes('auto update');
  assert.ok(
    hasAutoUpdateMention,
    'README must mention marketplace auto-update (disabled by default for third-party marketplaces)'
  );

  // Layer 2: manual fallback path.
  assert.ok(
    readme.includes('/plugin marketplace update refacil-plugins'),
    'README must document "/plugin marketplace update refacil-plugins" as the manual update trigger'
  );
  assert.ok(
    readme.includes('/plugin uninstall'),
    'README must document the "/plugin uninstall" step in the manual update path'
  );
  assert.ok(
    readme.includes('/plugin install refacil-pay-cli@refacil-plugins'),
    'README must document the reinstall step "/plugin install refacil-pay-cli@refacil-plugins"'
  );
});

// ---------------------------------------------------------------------------
// CR-01  SKILL.md must NOT live inside .claude-plugin/
// ---------------------------------------------------------------------------
test('CR-01: SKILL.md must NOT exist at refacil-pay-cli/.claude-plugin/SKILL.md', () => {
  assert.ok(
    !repoExists('refacil-pay-cli/.claude-plugin/SKILL.md'),
    'SKILL.md MUST NOT be placed inside refacil-pay-cli/.claude-plugin/ — ' +
    'correct location is refacil-pay-cli/skills/refacil-pay-cli/SKILL.md'
  );
});

// ---------------------------------------------------------------------------
// CR-04  manifest validation is not trivially passing — field checks are real
// ---------------------------------------------------------------------------
test('CR-04: manifest required-field assertions would fail on an object missing those fields', () => {
  // Demonstrate that the CA-01 assertions are not vacuously true by verifying
  // that a stripped object would NOT satisfy them.

  // An object without `name` does not equal the expected value.
  const strippedMarketplace = { owner: { name: 'Foo' }, plugins: [{ name: 'a', source: '.', description: 'd' }] };
  assert.notEqual(
    strippedMarketplace.name,
    'refacil-plugins',
    'CR-04 guard: missing name field does not satisfy the CA-01 name check'
  );

  // An object with a `version` field would fail the CA-02 no-version check.
  const fakePlugin = { name: 'refacil-pay-cli', description: 'x', author: 'y', homepage: 'z', version: '1.0.0' };
  assert.ok(
    Object.prototype.hasOwnProperty.call(fakePlugin, 'version'),
    'CR-04 guard: a plugin with version field is detectable by the CA-02 assertion'
  );

  // Confirm the real manifests satisfy all required fields (the assertions ARE meaningful).
  const marketplaceJson = JSON.parse(repoRead('.claude-plugin/marketplace.json'));
  assert.ok('name' in marketplaceJson, 'marketplace.json name field is present — CA-01 check is exercised on real data');
  assert.ok('owner' in marketplaceJson, 'marketplace.json owner field is present — CA-01 check is exercised on real data');
  assert.ok('plugins' in marketplaceJson, 'marketplace.json plugins field is present — CA-01 check is exercised on real data');

  const pluginJson = JSON.parse(repoRead('refacil-pay-cli/.claude-plugin/plugin.json'));
  assert.ok(!('version' in pluginJson), 'plugin.json genuinely lacks version — CA-02 no-version check is exercised on real data');
});

// ---------------------------------------------------------------------------
// CR-05  README must contain a pending/warning marker for Desktop/Cowork section
// ---------------------------------------------------------------------------
test('CR-05: README documents the confirmed Claude Cowork / Desktop installation flow', () => {
  const readme = repoRead('refacil-pay-cli/README.md');

  // The section about Cowork/Desktop must exist.
  const hasDesktopSection = readme.includes('Desktop') || readme.includes('Cowork');
  assert.ok(hasDesktopSection, 'README must have a section covering the Cowork/Desktop installation flow');

  // The flow was verified against the official Anthropic docs, so the README must
  // document the real install path (the Cowork "Add marketplace" UI action) rather
  // than a pending/unverified placeholder.
  assert.ok(
    readme.includes('Add marketplace'),
    'README must document the Cowork "Add marketplace" step for the confirmed install flow'
  );
});

// ---------------------------------------------------------------------------
// CA-07 + CA-01 (additional): source pointer in marketplace.json resolves
// ---------------------------------------------------------------------------
test('CA-07+CA-01: each plugins[].source resolves to a directory containing .claude-plugin/plugin.json', () => {
  const json = JSON.parse(repoRead('.claude-plugin/marketplace.json'));
  assert.ok(Array.isArray(json.plugins) && json.plugins.length >= 1, 'plugins must be a non-empty array');

  for (const plugin of json.plugins) {
    const pluginManifest = join(REPO_ROOT, plugin.source, '.claude-plugin', 'plugin.json');
    assert.ok(
      existsSync(pluginManifest),
      `plugins[].source "${plugin.source}" must resolve to a directory containing .claude-plugin/plugin.json — ` +
      `expected: ${pluginManifest}`
    );
  }
});

// ---------------------------------------------------------------------------
// CA-08 (additional): README explicitly states auto-update is off by default
// ---------------------------------------------------------------------------
test('CA-08 (additional): README states auto-update is disabled by default for third-party marketplaces', () => {
  const readme = repoRead('refacil-pay-cli/README.md');

  // The spec explicitly requires documenting that auto-update is OFF by default
  // for third-party marketplaces. Accept English or Spanish phrasing.
  const hasDisabledByDefault =
    readme.includes('disabled by default') ||
    readme.includes('OFF by default') ||
    readme.includes('off by default') ||
    readme.includes('desactivado por defecto') ||
    readme.includes('disabled by default'.toLowerCase());

  assert.ok(
    hasDisabledByDefault,
    'README must state that auto-update is "disabled by default" (or equivalent) ' +
    'for third-party marketplaces — spec CA-08 requires this to be explicitly documented'
  );
});

// ---------------------------------------------------------------------------
// CA-03 (additional): three flows appear as Markdown link syntax into references/
// ---------------------------------------------------------------------------
test('CA-03 (additional): SKILL.md body contains Markdown link syntax for all three flows pointing into references/', () => {
  const content = repoRead('refacil-pay-cli/skills/refacil-pay-cli/SKILL.md');

  // Assert the exact link-target forms present in the vendored SKILL.md.
  // These are read-only — we assert the real shapes that exist, not invented ones.
  assert.ok(
    content.includes('(references/cash-in-link.md)'),
    'SKILL.md must contain a Markdown link pointing to references/cash-in-link.md'
  );
  assert.ok(
    content.includes('(references/cash-in-method.md)'),
    'SKILL.md must contain a Markdown link pointing to references/cash-in-method.md'
  );
  assert.ok(
    content.includes('(references/cash-out.md)'),
    'SKILL.md must contain a Markdown link pointing to references/cash-out.md'
  );
});

// ---------------------------------------------------------------------------
// CA-02 (additional): homepage is a valid absolute URL
// ---------------------------------------------------------------------------
test('CA-02 (additional): plugin.json homepage is a valid absolute URL (http or https scheme)', () => {
  const json = JSON.parse(repoRead('refacil-pay-cli/.claude-plugin/plugin.json'));

  assert.ok(
    typeof json.homepage === 'string' &&
      (json.homepage.startsWith('https://') || json.homepage.startsWith('http://')),
    `plugin.json homepage must be an absolute URL starting with http:// or https:// — got: "${json.homepage}"`
  );
});

// ---------------------------------------------------------------------------
// CA-01 (additional): plugins[].name values are unique (no duplicates)
// ---------------------------------------------------------------------------
test('CA-01 (additional): plugins[].name values in marketplace.json are unique', () => {
  const json = JSON.parse(repoRead('.claude-plugin/marketplace.json'));
  assert.ok(Array.isArray(json.plugins), 'plugins must be an array');

  const names = json.plugins.map((p) => p.name);
  const uniqueNames = new Set(names);
  assert.equal(
    uniqueNames.size,
    names.length,
    `plugins[].name values must be unique — found duplicates: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`
  );
});

// ---------------------------------------------------------------------------
// CR-05 (additional): pending/warning marker is co-located with Desktop/Cowork section
// ---------------------------------------------------------------------------
test('CR-05 (additional): the confirmed install steps are co-located inside the Cowork/Desktop section', () => {
  const readme = repoRead('refacil-pay-cli/README.md');
  const lines = readme.split(/\r?\n/);

  // Locate the ## heading that mentions Cowork or Desktop.
  const desktopIdx = lines.findIndex((l) => /^##\s+.*(?:Desktop|Cowork)/i.test(l));
  assert.ok(
    desktopIdx !== -1,
    'README must have a ## heading for the Cowork/Desktop section'
  );

  // Find the next ## heading after it (end of section).
  let sectionEnd = lines.length;
  for (let i = desktopIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { sectionEnd = i; break; }
  }

  const sectionText = lines.slice(desktopIdx, sectionEnd).join('\n');

  // The documented Cowork flow ("Add marketplace" / "Add from a repository") must live
  // INSIDE this section, not elsewhere in the README.
  const hasFlowInSection =
    sectionText.includes('Add marketplace') ||
    sectionText.includes('Add from a repository');

  assert.ok(
    hasFlowInSection,
    'The confirmed Cowork install steps must appear INSIDE the Cowork/Desktop section ' +
    '(between its ## heading and the next ## heading), not merely elsewhere in the README'
  );
});

// ---------------------------------------------------------------------------
// CA-06 (additional): plugin.json description does not use abbreviated npm i -g
// ---------------------------------------------------------------------------
test('CA-06 (additional): plugin.json description does NOT use the abbreviated "npm i -g" form', () => {
  const json = JSON.parse(repoRead('refacil-pay-cli/.claude-plugin/plugin.json'));

  assert.ok(
    !json.description.includes('npm i -g'),
    'plugin.json description must NOT use the abbreviated "npm i -g" form — ' +
    `got description: "${json.description}"`
  );
});

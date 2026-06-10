# refacil-pay-cli plugin

Claude Code plugin that wraps the `refacil-pay-cli` CLI to enable Refacil Pay operations (cash-in via link, cash-in via payment method, and cash-out to Bre-B) directly from Claude Code sessions.

This plugin **does not bundle the CLI binary**. It only provides the skill instructions. The CLI must be installed globally on the host machine.

## Prerequisite

Install the CLI globally before using this plugin:

```bash
npm install -g refacil-pay-cli
```

Requires Node.js >= 20. Run this command each time a major upgrade is needed. Do **not** pin a version — always install the latest published version.

## Installation (Claude Code CLI)

**Step 1 — Add the marketplace** (one time per machine):

```
/plugin marketplace add <git-repo-url>
```

Replace `<git-repo-url>` with the URL of this repository (e.g. `https://github.com/erikole21/refacil-claude-plugins` or the short `owner/repo` form if hosted on GitHub).

**Step 2 — Install the plugin:**

```
/plugin install refacil-pay-cli@refacil-plugins
```

After installation, reload plugins in the current session:

```
/reload-plugins
```

The skill becomes available as `/refacil-pay-cli:refacil-pay-cli`.

## Installation (Claude Desktop / Cowork Code tab)

> **WARNING — PENDING LIVE VERIFICATION**: The step-by-step flow to add a **third-party marketplace** from within the Claude Desktop GUI is not explicitly documented in the official Claude Desktop reference (`https://code.claude.com/docs/en/desktop.md` as of 2026-06-09). The docs confirm Desktop has a "Plugin manager UI" with a `+ button → Plugins → Add plugin` flow that shows plugins from already-configured marketplaces, but the specific UI path to **register a new third-party marketplace** (equivalent to `/plugin marketplace add`) is not clearly described.
>
> The safest documented approach is to type the slash command directly in the Code tab's chat input:
> ```
> /plugin marketplace add <git-repo-url>
> ```
> Then follow with `/plugin install refacil-pay-cli@refacil-plugins` and `/reload-plugins`. This approach should work in Desktop local/SSH sessions, but has **not been validated against the live Desktop UI**. Do not treat this as a confirmed step-by-step guide until validated.
>
> Once verified in the live UI, this section must be updated to replace or supplement the CLI command with the confirmed GUI steps.

## Updates (two-layer model)

This plugin wraps an external CLI binary. Updates flow through two independent channels:

### Layer 1 — CLI binary (`refacil-pay-cli` npm package)

The CLI binary contains the actual business logic (commands, payment API calls, bug fixes). The plugin does **not** bundle or manage the binary.

The `refacil-pay-cli` package manages its own updates: its `postinstall` hook installs a `SessionStart` hook in Claude's shared config (`~/.claude/settings.json`) that runs `npm update -g refacil-pay-cli` automatically when a newer version is published (checked approximately once per day, owned by `refacil-mcps`).

**Manual fallback** — if the automatic hook is not triggering:

```bash
npm update -g refacil-pay-cli
```

A CLI fix that does not change the skill instructions reaches users without any action on this repository.

### Layer 2 — Skill/plugin (via marketplace git)

When `SKILL.md` or the `references/` files change (new flows, updated instructions), the maintainer of this repository re-vendors from the npm package, commits, and pushes. Because `plugin.json` omits the `version` field, Claude Code uses the **commit SHA** as the version identifier — every new commit is treated as a new version.

**Enable auto-update (recommended):**

Third-party marketplaces have auto-update **disabled by default**. Enable it so Claude Code picks up skill updates automatically at startup:

1. Run `/plugin` to open the plugin manager
2. Select **Marketplaces**
3. Choose `refacil-plugins` from the list
4. Select **Enable auto-update**

Once enabled, skill updates are applied automatically when Claude Code starts. You will see a notification to run `/reload-plugins` if any plugins were updated.

**Manual update path** (if auto-update is disabled):

There is no `/plugin update` command. To update manually:

```
/plugin marketplace update refacil-plugins
/plugin uninstall refacil-pay-cli@refacil-plugins
/plugin install refacil-pay-cli@refacil-plugins
/reload-plugins
```

## Vendored skill files

The skill files under `skills/refacil-pay-cli/` are exact copies (vendored) from the npm package `refacil-pay-cli`. Do **not** edit them directly in this repository. To update the skill:

1. Modify the source in `refacil-mcps` (generators/cli)
2. Publish a new npm version of `refacil-pay-cli`
3. Re-vendor here by copying `skills/refacil-pay-cli/` from the new global install
4. Commit and push

## Available flows

- **cash-in-link** — Charge a customer via payment link
- **cash-in-method** — Charge a customer via direct payment method (PSE, card, Nequi, etc.)
- **cash-out** — Send funds to a Bre-B key

## Development

The contract test suite (`test/feat-cowork-marketplace.test.mjs`, run with `node --test`) verifies that the
vendored skill files are byte-identical to the published package. It therefore requires `refacil-pay-cli` to be
installed globally first — run `npm install -g refacil-pay-cli` before `node --test`, or the byte-identity check
(CA-04) will fail with an explicit message instead of being silently skipped.

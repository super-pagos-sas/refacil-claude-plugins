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

## Installation (Claude Cowork / Claude Desktop)

Cowork supports adding third-party marketplaces from a GitHub repository through a
native UI — no slash command required. Source:
[Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude).

1. Open the **Cowork** tab, then open **Customize**.
2. Go to the **Plugins** tab.
3. Under **Personal plugins**, click **"+"** → **Add marketplace**.
4. Choose **Add from a repository** ("Sync a marketplace from a GitHub repository or git URL").
5. Enter this repository's URL (e.g. `https://github.com/super-pagos-sas/refacil-claude-plugins`
   or the `owner/repo` short form), then add the `refacil-pay-cli` plugin from it.

> **Note (repository requirements):** Cowork syncs the marketplace from the repository's
> **default branch**, so `.claude-plugin/marketplace.json` must be on `main` (or whatever the
> default branch is) — not on a feature branch. If the repository is **private**, each user
> must be authenticated to GitHub (`gh auth login` or a token); background auto-update of a
> private marketplace additionally requires `GITHUB_TOKEN` in the environment. A **public**
> repository needs no credentials.

**Organization-wide (enterprise):** admins can distribute this marketplace to a whole team
via Cowork's organization-managed plugins (private marketplaces backed by a GitHub repo).
Organization-managed plugins cannot be edited by individual users, keeping shared tooling
consistent. See the enterprise plugin administration docs for the admin console steps.

In **Claude Desktop's Code tab** and the **Claude Code CLI**, the same marketplace is added
with the slash command shown above (`/plugin marketplace add <git-repo-url>` →
`/plugin install refacil-pay-cli@refacil-plugins`).

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

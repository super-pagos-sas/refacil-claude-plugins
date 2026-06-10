# Testing

Tests de **contrato** sobre la estructura del marketplace y la integridad de los archivos vendorizados.

- **Runner**: test runner nativo de Node.js (`node:test` + `node:assert/strict`). No hay Jest/Vitest ni `package.json`.
- **Ubicación**: `test/*.test.mjs` (actualmente `test/feat-cowork-marketplace.test.mjs`).
- **Qué validan**: manifiestos JSON (`marketplace.json`, `plugin.json`), frontmatter y links de `SKILL.md`, igualdad byte-a-byte de los archivos vendorizados frente al global npm, y marcadores requeridos en el README (CA-01..CA-08, CR-01..CR-05).

<!-- refacil-sdd-ai:testing-policy:start -->
## SDD-AI — test execution defaults

These rules align with **`METHODOLOGY-CONTRACT.md` §3–§3.1** shipped with SDD-AI (`refacil-prereqs` in your skills install). **Concrete baseline and narrowed commands for this repo** belong in markdown **below** this marked block (not between the `refacil-sdd-ai:testing-policy` markers) so `check-update` can refresh policy text without erasing your commands.

- **Only `/refacil:test` runs the full suite** — and only the **affected component's** suite, once per cycle. Every other phase that runs tests (`/refacil:apply`, `/refacil:bug` fix, `/refacil:verify` smoke) does **scoped runs** only — it narrows the runner to **packages/paths/modules touched by the change** (paths after `--`, `-p`/`-pl`, `-Dtest=…`, `pytest` paths, `go test ./…`, workspace filters, etc.). These phases derive the command via `refacil-sdd-ai sdd test-scope … --no-baseline-fallback`, which returns an **empty command on fallback** — so they **physically cannot** run the whole suite. On fallback they run only touched test files, else SKIP and defer to `/refacil:test`.
- **`/refacil:verify` never runs the full suite** — `/refacil:test` is its mandatory prior step. If there is no test evidence, verify defers to `/refacil:test` instead of running it.
- **Full suite** — Only `/refacil:test` (component-bounded, once) or **CI / pre-merge**. Non-test phases never run it, even on unreliable scope (they SKIP). Full runs cost more CPU/RAM.
- **Tests to add or change** — Keep them **next to** the behavior under change (follow this repo’s layout). Do not run unrelated suites “to be safe”.
<!-- refacil-sdd-ai:testing-policy:end -->

## Repo-specific commands (safe to edit; not overwritten on sync)

**Baseline (toda la suite):**
```bash
node --test
```

**Narrowing (scoped — preferido por defecto):**
```bash
# Un solo archivo de test
node --test test/feat-cowork-marketplace.test.mjs

# Filtrar por nombre de test (subcadena, p.ej. un criterio CA/CR concreto)
node --test --test-name-pattern "CA-04"
```

> CI: no hay workflow de CI configurado todavía (`.github/workflows/` ausente). Si se agrega, documenta aquí dónde corre la regresión completa.

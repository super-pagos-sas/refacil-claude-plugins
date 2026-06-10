# Stack

## Lenguaje y runtime
- **Markdown** — formato principal (skills, comandos, references, docs).
- **Node.js ≥ 20** — requerido por dos motivos:
  1. Test runner nativo (`node --test`) para los tests de contrato.
  2. Prerequisito en tiempo de ejecución del plugin: el usuario instala `refacil-pay-cli` globalmente.

## Dependencias
- **Sin `package.json`** en la raíz. No hay dependencias npm propias ni `node_modules` versionado.
- **`refacil-pay-cli`** (npm global) — fuente de verdad de los archivos de skill vendorizados. Instalación: `npm install -g refacil-pay-cli` (siempre la última, sin pin).
- **`refacil-sdd-ai`** (npm global) — toolchain de la metodología SDD-AI (`refacil-sdd-ai sdd ...`, hooks de SessionStart).

## Integraciones
- **Claude Code plugin system** — `/plugin marketplace add <repo>` y `/plugin install refacil-pay-cli@refacil-plugins`.
- **refacil-bus** — bus de mensajería cross-repo (bloque `refacil-bus:presentation` en `AGENTS.md`).
- **CodeGraph** — índice local del grafo de símbolos en `.codegraph/` (gitignored; habilitado a nivel global).

## Variables de entorno / config
- No hay `.env` propio del repo. El CLI `refacil-pay-cli` gestiona sus credenciales vía `refacil-pay-cli login`.
- Config de ramas SDD: heredada de global/defaults (`baseBranch=develop`, protegidas: master, main, develop, dev, testing, qa).

## Archivos ignorados (`.gitignore`)
`.codegraph/`, `node_modules/`, `refacil-sdd/.autopilot-active`, artefactos de OS/editor.

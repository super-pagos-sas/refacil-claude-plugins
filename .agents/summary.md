# Summary

Marketplace de plugins de Claude Code de Refácil. Empaqueta el CLI `refacil-pay-cli` como skill instalable y sigue la metodología SDD-AI.

| Aspecto | Valor |
|---|---|
| Lenguaje primario | Markdown (skills / comandos / docs) |
| Runtime | Node.js ≥ 20 (solo para el test runner y como prerequisito del CLI) |
| Framework | Sistema de plugins de Claude Code (marketplace + plugins) |
| Test runner oficial | `node --test` (test runner nativo `node:test` + `node:assert/strict`) |
| Build / deps | Ninguno — no hay `package.json`. El CLI se instala con `npm install -g refacil-pay-cli` |
| Empaquetado | Manifiestos JSON: `.claude-plugin/marketplace.json` + `refacil-pay/.claude-plugin/plugin.json` |

## Scripts que importan
- `node --test` — corre los tests de contrato en `test/`. No hay `npm test` (no hay manifest npm).

## Always / Never / Ask
**Always**
- Mantén los archivos de skill *vendorizados* byte-idénticos a la fuente del paquete npm global (lo valida CA-04).
- Versiona el CLI vía `npm install -g refacil-pay-cli` (siempre la última; nunca pinnear versión).

**Never**
- No agregues un campo `version` a `plugin.json` (lo prohíbe CA-02).
- No crees `SKILL.md` dentro de `.claude-plugin/` (lo prohíbe CR-01).
- No empaquetes el binario del CLI dentro del plugin (solo instrucciones).

**Ask**
- Antes de cambiar la estructura de manifiestos (`marketplace.json` / `plugin.json`) que rompa `/plugin marketplace add`.

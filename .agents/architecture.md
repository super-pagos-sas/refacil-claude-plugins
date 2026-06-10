# Architecture

Repositorio de **empaquetado**: no expone código de aplicación, sino manifiestos y skills en Markdown que Claude Code consume.

## Componentes

- **`.claude-plugin/marketplace.json`** — Manifiesto del marketplace `refacil-plugins`. Lista los plugins disponibles y su `source` relativo. Es lo que reconoce `/plugin marketplace add`.

- **`refacil-pay/`** — El plugin distribuido.
  - **`.claude-plugin/plugin.json`** — Metadatos del plugin (name, description, author, homepage). **Sin** campo `version`.
  - **`skills/refacil-pay-cli/SKILL.md`** — Índice de skill (frontmatter `user-invocable: true`) que apunta a los flujos.
  - **`skills/refacil-pay-cli/references/`** — Un `.md` por flujo: `cash-in-link.md`, `cash-in-method.md`, `cash-out.md`.
  - **`README.md`** — Instalación (marketplace add + plugin install), modelo de actualización de dos capas (binario CLI + skill/plugin).

- **`test/feat-cowork-marketplace.test.mjs`** — Tests de contrato (CA-01..CA-08, CR-01..CR-05) que validan la estructura de manifiestos, la integridad byte-a-byte de los archivos vendorizados frente al paquete npm global, y los marcadores de README.

- **`refacil-sdd/`** — Artefactos de la metodología SDD-AI (`changes/`, `specs/`, config).

## Patrón clave: vendorización
Los archivos de skill bajo `refacil-pay/skills/` son una **copia vendorizada** del paquete `refacil-pay-cli` publicado en npm. El test CA-04 exige que sean byte-idénticos a la fuente del global. Al actualizar el CLI, re-vendoriza los archivos desde el global y vuelve a correr `node --test`.

## Modelo de actualización de dos capas
1. **Binario CLI** — `npm install -g refacil-pay-cli` (lo ejecuta el usuario en su máquina).
2. **Skill / plugin** — se actualiza vía el marketplace; auto-update deshabilitado por defecto para marketplaces de terceros.

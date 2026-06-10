# refacil-claude-plugins

Marketplace de plugins de **Claude Code** de Refácil. Este repositorio es un catálogo
declarativo (`.claude-plugin/marketplace.json`) que empaqueta CLIs ya publicados de Refácil
como **skills instalables** en Claude Code, Claude Desktop y Claude Cowork. Se mantiene con la
metodología **SDD-AI** (`refacil-sdd-ai`).

> El repositorio **no reimplementa lógica de negocio**: cada plugin envuelve un binario que se
> instala por separado (npm) e instruye al agente a ejecutarlo. Las skills se **vendorizan**
> (se copian tal cual, byte a byte) desde el paquete npm publicado, que es la fuente de verdad.

- **Identificador del marketplace:** `refacil-plugins` (clave estable — no cambiar; rompe los
  comandos de instalación de los usuarios existentes).
- **Rama por defecto:** `main` (el marketplace se sincroniza desde la rama por defecto del repo).
- **Owner:** Refácil (Super Pagos S.A.S.) — `super-pagos-sas/refacil-claude-plugins`.

## Plugins disponibles

| Plugin | Descripción | Prerequisito | Flujos | Docs |
|--------|-------------|--------------|--------|------|
| [`refacil-pay-cli`](./refacil-pay-cli/README.md) | Operador CLI de Refácil Pay desde Claude. | `npm install -g refacil-pay-cli` + `refacil-pay-cli login` | `cash-in-link`, `cash-in-method`, `cash-out` | [README](./refacil-pay-cli/README.md) |

Tras instalar el plugin, la skill queda disponible como `/refacil-pay-cli:refacil-pay-cli`.

## Instalación

### Claude Code CLI / Claude Desktop (pestaña Code)

```
/plugin marketplace add super-pagos-sas/refacil-claude-plugins
/plugin install refacil-pay-cli@refacil-plugins
/reload-plugins
```

### Claude Cowork (UI)

**Cowork** → **Customize** → pestaña **Plugins** → **Personal plugins** → **"+"** →
**Add marketplace** → **Add from a repository** → pega la URL del repo
(`https://github.com/super-pagos-sas/refacil-claude-plugins`).

> **Requisito de rama:** el marketplace se sincroniza desde la **rama por defecto** (`main`), así
> que todo cambio en `.claude-plugin/marketplace.json` debe llegar a `main` para ser visible.
> Repo **privado** → cada usuario necesita autenticación de GitHub (`gh auth login` o token), y el
> auto-update en background requiere además `GITHUB_TOKEN` en el entorno. Repo **público** → sin
> credenciales.

Cada plugin trae sus prerequisitos e instrucciones detalladas en su propio README. Para
`refacil-pay-cli`: instala antes el binario (`npm install -g refacil-pay-cli`) y autentícate
(`refacil-pay-cli login`) antes de ejecutar cualquier flujo.

## Estructura del repositorio

```
.
├── .claude-plugin/
│   └── marketplace.json          # Manifiesto raíz del marketplace (name: refacil-plugins)
├── refacil-pay-cli/              # Directorio del plugin
│   ├── .claude-plugin/
│   │   └── plugin.json           # Manifiesto del plugin (omite "version" a propósito)
│   ├── skills/refacil-pay-cli/   # Skill VENDORIZADA (copia exacta desde npm; no editar a mano)
│   │   ├── SKILL.md              #   Índice de skill (frontmatter user-invocable: true)
│   │   └── references/           #   Un .md por flujo: cash-in-link, cash-in-method, cash-out
│   └── README.md                 # Instalación (CLI/Desktop/Cowork), actualizaciones, flujos
├── test/
│   └── feat-cowork-marketplace.test.mjs   # Tests de contrato (node --test, sin dependencias)
├── .agents/                      # Documentación para agentes/contribuidores (ver abajo)
├── refacil-sdd/                  # Artefactos de la metodología SDD-AI (changes/, specs/)
├── AGENTS.md                     # Presentación del repo + índice .agents/ + comandos SDD-AI
├── CLAUDE.md                     # Apunta a AGENTS.md (configuración de Claude Code)
└── .claudeignore / .cursorignore / .opencodeignore / .cursorrules
```

> **No versionado** (`.gitignore`): `.codegraph/` (índice local de CodeGraph), `node_modules/` y
> `refacil-sdd/.autopilot-active` (marcador efímero del autopilot).

### Documentación para contribuidores (`.agents/`)

Si vas a trabajar en el repo (o eres un agente), empieza por aquí:

| Archivo | Para qué |
|---------|----------|
| [`.agents/summary.md`](./.agents/summary.md) | **Léelo primero**: scope, stack, comando de test y reglas Always/Never/Ask. |
| [`.agents/testing.md`](./.agents/testing.md) | Política de tests (runs *scoped* por defecto) y comandos del repo. |
| [`.agents/architecture.md`](./.agents/architecture.md) | Componentes (manifiestos, skills vendorizadas) y patrón de vendorización. |
| [`.agents/stack.md`](./.agents/stack.md) | Dependencias, integraciones (plugins, refacil-bus, CodeGraph) y config. |
| [`.agents/commands.md`](./.agents/commands.md) | Comandos de test, marketplace, CLI y vendorización. |

## Modelo de actualizaciones (dos capas)

El plugin envuelve un binario que no contiene; por eso las actualizaciones fluyen por dos caminos
independientes:

1. **Binario del CLI** (`refacil-pay-cli`, vía npm) — contiene la lógica real (comandos, pagos,
   fixes). Se actualiza solo: `npm update -g refacil-pay-cli`. Dueño del contrato: `refacil-mcps`.
2. **Skill/plugin** (vendorizado, vía git de este marketplace) — al cambiar `SKILL.md`/`references/`,
   el mantenedor revendoriza, commitea y pushea a `main`. Como `plugin.json` **omite `version`**,
   Claude Code usa el **commit SHA** como versión: cada commit a `main` es una versión nueva, de modo
   que con el auto-update del marketplace habilitado los usuarios la reciben automáticamente.

Detalle completo (incluido cómo activar el auto-update, que viene **desactivado por defecto** en
marketplaces de terceros) en el [README del plugin](./refacil-pay-cli/README.md#updates-two-layer-model).

## Mantenimiento: contrato de vendorización

La fuente de verdad de la skill y del CLI es **`refacil-mcps`** (`generators/cli`). Este repositorio
solo **consume y vendoriza** el árbol publicado en npm. Por lo tanto:

- **Never:** editar a mano los archivos bajo `refacil-pay-cli/skills/refacil-pay-cli/`, agregar `version`
  a `plugin.json` (lo prohíbe el test CA-02), o crear `SKILL.md` dentro de `.claude-plugin/` (CR-01).
- **Always:** mantener las skills vendorizadas **byte-idénticas** al global npm (lo valida CA-04), e
  instalar el CLI siempre en su última versión (sin pinnear).

Flujo al cambiar una skill: actualizar fuente en `refacil-mcps` → publicar paquete npm →
revendorizar aquí (copiar `skills/<skill>/` tal cual desde el global) → `node --test` → commit + push.

## Desarrollo

No hay `package.json` ni build: los tests de contrato usan el runner integrado de Node (`node:test`).
Validan los manifiestos, el frontmatter/links de `SKILL.md`, la identidad byte a byte de las skills
vendorizadas frente al global npm, y los marcadores del README (CA-01..CA-08, CR-01..CR-05).

```bash
npm install -g refacil-pay-cli                       # requerido por el chequeo byte a byte (CA-04)
node --test                                          # toda la suite de contrato
node --test test/feat-cowork-marketplace.test.mjs    # un solo archivo
node --test --test-name-pattern "CA-04"              # filtrar por criterio
```

> Aún no hay workflow de CI (`.github/workflows/` ausente). Si se agrega, documenta en
> [`.agents/testing.md`](./.agents/testing.md) dónde corre la regresión completa.

## Distribución

- **Equipo / organización:** registra el marketplace vía `extraKnownMarketplaces` en
  `.claude/settings.json` (a nivel de proyecto, versionado en git) o como **plugin org-managed** en
  Cowork enterprise, para que aparezca en el "Explorar" de todo el equipo sin que cada quien lo añada
  a mano.
- **Repo privado:** los usuarios necesitan autenticación de GitHub; el auto-update en background de un
  marketplace privado requiere `GITHUB_TOKEN` en el entorno.
- **Directorio público de Anthropic** (`claude-community`): requiere envío y revisión de calidad/seguridad
  de Anthropic. No es necesario para distribución interna.

## Metodología (SDD-AI)

El repo se desarrolla con **SDD-AI** (`refacil-sdd-ai`): cada cambio pasa por propose → apply → test →
verify → review → archive → up-code. Los artefactos viven en `refacil-sdd/` (`changes/` activos y
archivados, `specs/` como registro histórico). Ver la tabla de comandos `/refacil:*` en
[`AGENTS.md`](./AGENTS.md). El historial del primer cambio (`feat-cowork-marketplace`) está archivado en
`refacil-sdd/changes/archive/` y su spec en `refacil-sdd/specs/feat-cowork-marketplace/`.

## Licencia

[MIT](./LICENSE) © 2026 Super Pagos S.A.S.

El código de empaquetado de este repositorio (manifiestos, README, tests) se publica bajo MIT.
El binario `refacil-pay-cli` (instalado por separado vía npm) y el acceso a la API de Refácil Pay
se rigen por sus propios términos de servicio.

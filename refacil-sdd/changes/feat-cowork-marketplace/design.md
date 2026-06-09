# design: feat-cowork-marketplace

## Archivos a crear

| Ruta | Propósito |
|------|-----------|
| `.claude-plugin/marketplace.json` | Manifiesto raíz del marketplace; registra el nombre `refacil-plugins` y lista los plugins disponibles |
| `refacil-pay-cli/.claude-plugin/plugin.json` | Manifiesto del plugin `refacil-pay-cli`; declara nombre, descripción, versión y homepage |
| `refacil-pay-cli/skills/refacil-pay-cli/SKILL.md` | **Vendorizado** — copia exacta desde el paquete npm global; NO editar a mano |
| `refacil-pay-cli/skills/refacil-pay-cli/references/cash-in-link.md` | **Vendorizado** — referencia del flujo cash-in-link; copia exacta desde npm global |
| `refacil-pay-cli/skills/refacil-pay-cli/references/cash-in-method.md` | **Vendorizado** — referencia del flujo cash-in-method; copia exacta desde npm global |
| `refacil-pay-cli/skills/refacil-pay-cli/references/cash-out.md` | **Vendorizado** — referencia del flujo cash-out; copia exacta desde npm global |
| `refacil-pay-cli/README.md` | Documentación del plugin: prerequisito, instrucciones de instalación CLI y nota de riesgo para Desktop/Cowork |

## Archivos a modificar

| Ruta | Cambios |
|------|---------|
| `AGENTS.md` | Agregar al bloque de presentación existente la mención del marketplace y la estructura de plugins (si aplica, según criterio del implementador) |

## Archivos fuera de alcance (doNotTouch)

- `refacil-sdd/`
- `.claude/`
- `.cursor/`
- `AGENTS.md` (solo puede modificarse si el implementador decide actualizar la presentación del bus)
- `package-lock.json`
- Cualquier archivo dentro de `.codegraph/`

## Origen de los archivos vendorizados

La fuente de los archivos vendorizados (SKILL.md y references/) es el paquete npm global instalado en:

```
C:\Program Files\nodejs\node_modules\refacil-pay-cli\skills\refacil-pay-cli\
```

El proceso de vendorización es una copia directa (sin transformaciones). Cuando `refacil-pay-cli` publique una nueva versión con cambios en la skill, se debe repetir la copia para reflejar la versión actualizada.

## Contrato cross-repo con refacil-mcps

Este cambio implementa el plan C6 del repositorio `refacil-mcps`. La fuente de verdad del CLI y la skill es `refacil-mcps/generators/cli`. El repositorio `refacil-claude-plugins` **no** es dueño del contrato de la skill: solo lo consume y vendoriza.

Protocolo aplicable: `refacil-prereqs/BUS-CROSS-REPO.md` (sala `plugin`, sesión `@refacil-mcps`, acuerdo de bus refacil-bus).

Implicaciones:
- Cualquier cambio de contrato en la skill (nuevos flujos, cambios de frontmatter, modificación de referencias) debe originarse en `refacil-mcps` y fluir hacia este repositorio mediante una nueva versión del paquete npm y un nuevo proceso de vendorización.
- No se aceptan PRs que modifiquen directamente los archivos vendorizados en este repositorio sin una versión npm asociada.

### Seguimiento cross-repo pendiente: instrucción de instalación en la skill

El `SKILL.md` publicado (paquete `refacil-pay-cli`, última versión publicada) **no incluye** el prerequisito de instalación `npm install -g refacil-pay-cli`; arranca directamente en "Use the `refacil-pay-cli` CLI…" asumiendo el binario ya instalado. Como la skill se vendoriza tal cual (CR-02: prohibido editarla a mano en este repo), la instrucción de instalación debe agregarse en el **generador de `refacil-mcps`** (`generators/cli`), republicar el paquete npm y revendorizar aquí.

- En **este** repo, el prerequisito `npm install -g refacil-pay-cli` se cubre vía el `README.md` del plugin (T-03) y la descripción de `plugin.json` (no en el SKILL.md).
- Solicitud escalada por el bus refacil-bus a `@refacil-mcps` para que añada la instrucción de instalación en el generador de la skill. Una vez republicado, refrescar la copia vendorizada.

## Patrones y convenciones detectados

- Repositorio nuevo sin convenciones de código establecidas aún; el único patrón conocido es el declarado en `AGENTS.md`: "Stack: Claude Code plugins (Markdown skills/commands + hooks, Node CLI refacil-sdd-ai)".
- La estructura de plugins de Claude Code sigue el patrón: `<plugin-dir>/.claude-plugin/plugin.json` + `<plugin-dir>/skills/<skill-name>/SKILL.md`.
- El marketplace raíz usa `.claude-plugin/marketplace.json` con el campo `name` estable como identificador en el comando de instalación.
- Los manifiestos son JSON puro (sin comentarios); mantener formato legible con indentación de 2 espacios.
- El `name` del marketplace (`refacil-plugins`) es un identificador público estable: cambiar este valor rompe los comandos de instalación de usuarios existentes.
- **No fijar la versión del CLI `refacil-pay-cli` en ningún artefacto ni manifiesto.** El CLI se actualiza con frecuencia; tanto la instalación (`npm install -g refacil-pay-cli`, sin `@version`) como la documentación deben referirse siempre a la "última versión publicada". La vendorización refleja la versión instalada en el momento de copiar, pero no se documenta como versión fija.
- **`plugin.json` OMITE el campo `version` a propósito.** En distribución por git, omitir `version` hace que Claude Code use el **commit SHA** como identificador de versión: cada commit al repo cuenta como versión nueva, de modo que los usuarios reciben las actualizaciones de la skill **automáticamente** (con auto-update habilitado). No agregar un `version` manual: hacerlo obligaría a bumpearlo a mano en cada cambio y rompería la actualización automática. (Consecuencia: incluso commits de documentación cuentan como update; es el costo aceptado de "siempre la última skill".)

## Modelo de actualizaciones (dos capas)

El plugin envuelve un binario que no contiene; por eso las actualizaciones fluyen por dos caminos independientes:

**Capa 1 — Binario del CLI (`refacil-pay-cli`, vía npm).** Contiene la lógica real (comandos, pagos, fixes). El plugin solo lo invoca, no lo empaqueta. La **actualización la gestiona el propio paquete del CLI**, no este repo: el `postinstall` del paquete npm instala un hook `SessionStart` en la config compartida de Claude (`~/.claude/settings.json`, aplica a Claude Code y Desktop) que ejecuta `npm update -g refacil-pay-cli` **solo cuando** la versión instalada es menor que la publicada (cacheado ~1/día). Dueño: `refacil-mcps` (fuera de alcance de este repo). Fallback manual del usuario: `npm update -g refacil-pay-cli`. Ventaja: un fix del CLI que no cambia las instrucciones de la skill llega al usuario sin tocar el plugin.

**Capa 2 — Skill/plugin (vendorizado, vía marketplace git).** Cuando cambian `SKILL.md`/`references/`, el mantenedor de este repo revendoriza desde el paquete npm, hace commit y push al repo del marketplace. Como `plugin.json` omite `version`, cada commit es una versión nueva (commit SHA). El usuario la recibe:
- **Automático** (objetivo): con auto-update del marketplace habilitado (`/plugin` → pestaña Marketplaces; en marketplaces de terceros viene **desactivado por defecto**), Claude Code actualiza al iniciar.
- **Manual**: `/plugin marketplace update refacil-plugins` → `/plugin uninstall refacil-pay-cli@refacil-plugins` → `/plugin install refacil-pay-cli@refacil-plugins`. No existe `/plugin update`.

Flujo de mantenimiento al cambiar la skill: actualizar fuente en `refacil-mcps` → publicar paquete npm → revendorizar aquí (copiar `skills/refacil-pay-cli/` tal cual) → commit + push. No bumpear `version` (no existe el campo).

## Dependencias entre tareas

1. La vendorización (T-02) debe completarse antes de que el README pueda documentar la lista exacta de flujos disponibles (T-03).
2. La verificación del flujo de instalación en Claude Desktop/Cowork (T-04) es independiente de las demás tareas y puede ejecutarse en paralelo, pero su resultado debe incorporarse al README antes del merge.
3. La validación funcional con `/plugin marketplace add` (T-05) depende de que T-01 y T-02 estén completas.

# proposal: feat-cowork-marketplace

## Objetivo

Crear la estructura de un marketplace de plugins de Claude Code que empaqueta la skill del CLI `refacil-pay-cli` (ya publicado en npm). El repositorio `refacil-claude-plugins` no reimplementa lógica de negocio: actúa como envoltorio declarativo que instruye al agente de Claude a ejecutar el binario global ya instalado. Las skills se vendorizan (copian tal cual) desde el paquete npm publicado para mantenerse sincronizadas con la fuente de verdad ubicada en `refacil-mcps`.

## Alcance

**Incluye:**
- Manifiesto de marketplace raíz: `.claude-plugin/marketplace.json`
- Directorio del plugin `refacil-pay-cli/` con su manifiesto `.claude-plugin/plugin.json`
- Vendorización de la skill: `refacil-pay-cli/skills/refacil-pay-cli/SKILL.md` y su carpeta `references/` (copiados tal cual desde el paquete npm global)
- `refacil-pay-cli/README.md` con instrucciones de prerequisito e instalación para el usuario final
- Documentación de la estructura de marketplace para que el comando `/plugin marketplace add` reconozca el repositorio

**Excluye:**
- Reimplementación de lógica de negocio de Refácil Pay (pagos, autenticación, webhooks)
- Generación manual de `SKILL.md` o cualquier archivo de `references/` (provienen del paquete npm)
- Integración con otros CLIs o plugins distintos a `refacil-pay-cli`
- Despliegue o publicación del repositorio en un registro de plugins externo

## Justificación

`refacil-pay-cli` está publicado y operativo en npm, pero sin un marketplace de Claude Code no existe forma declarativa de integrarlo en flujos de agentes. Este cambio habilita que cualquier sesión de Claude Code (CLI o Desktop) pueda instalar y usar la skill con un único comando, siguiendo el patrón de marketplace definido por Anthropic para plugins de Claude Code. Es el cambio C6 del plan de distribución de `refacil-mcps`.

## Restricciones

- La skill debe residir en `<plugin>/skills/<skill-name>/SKILL.md` (no dentro de `.claude-plugin/`), según la especificación de estructura de plugins de Claude Code.
- El contenido de `skills/refacil-pay-cli/` nunca se edita a mano: se copia desde el paquete npm global instalado.
- El campo `name` del marketplace (`refacil-plugins`) debe permanecer estable: es la clave de referencia en el comando `/plugin install refacil-pay-cli@refacil-plugins`.
- La documentación del flujo de instalación en Claude Desktop/Cowork requiere verificación en vivo contra la documentación oficial antes de publicarse como definitiva (riesgo documental pendiente).
- Contrato cross-repo: la fuente de verdad de la skill y el CLI reside en `refacil-mcps` (generators/cli); este repositorio solo vendoriza/copia el árbol publicado.

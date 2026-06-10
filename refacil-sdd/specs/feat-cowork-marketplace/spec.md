# feat-cowork-marketplace Especificación

<!-- refacil-sdd: artifactLanguage=spanish -->

## Propósito

Crear la estructura de un marketplace de plugins de Claude Code que empaqueta la skill del CLI `refacil-pay-cli` (ya publicado en npm). El repositorio `refacil-claude-plugins` no reimplementa lógica de negocio: actúa como envoltorio declarativo que instruye al agente de Claude a ejecutar el binario global ya instalado. Las skills se vendorizan (copian tal cual) desde el paquete npm publicado para mantenerse sincronizadas con la fuente de verdad ubicada en `refacil-mcps`.

## Requisitos

### Requisito: CA-01: marketplace.json con campos requeridos

#### Escenario: marketplace.json con campos requeridos
**Dado** que el archivo `.claude-plugin/marketplace.json` existe en la raíz del repositorio
**Cuando** se parsea como JSON
**Entonces** debe contener los campos `name` (valor `"refacil-plugins"`), `owner` (objeto con campo `name`) y `plugins` (arreglo con al menos una entrada que tenga `name`, `source` y `description`)

---

### Requisito: CA-02: plugin.json con campos requeridos

#### Escenario: plugin.json con campos requeridos
**Dado** que el archivo `refacil-pay-cli/.claude-plugin/plugin.json` existe
**Cuando** se parsea como JSON
**Entonces** debe contener los campos `name` (valor `"refacil-pay-cli"`) y `description` (cadena no vacía), más `author` y `homepage` como campos complementarios; **NO debe incluir el campo `version`** (se omite a propósito para que la distribución por git use el commit SHA y cada commit cuente como versión nueva, habilitando actualizaciones automáticas)

---

### Requisito: CA-03: La skill vendorizada apunta al CLI global sin reimplementar lógica

#### Escenario: La skill vendorizada apunta al CLI global sin reimplementar lógica
**Dado** que el archivo `refacil-pay-cli/skills/refacil-pay-cli/SKILL.md` existe
**Cuando** se revisa su contenido
**Entonces** el frontmatter debe contener `name: refacil-pay-cli` y `user-invocable: true`; el cuerpo del SKILL.md debe instruir al agente a ejecutar el binario `refacil-pay-cli` (no duplicar lógica de negocio) y referenciar los tres flujos: `cash-in-link`, `cash-in-method`, `cash-out`

---

### Requisito: CA-04: SKILL.md y references/ son copia exacta del paquete npm publicado

#### Escenario: SKILL.md y references/ son copia exacta del paquete npm publicado
**Dado** que el paquete `refacil-pay-cli` está instalado globalmente en su última versión publicada
**Cuando** se compara byte a byte `refacil-pay-cli/skills/refacil-pay-cli/` con `<npm-global>/node_modules/refacil-pay-cli/skills/refacil-pay-cli/`
**Entonces** los archivos `SKILL.md`, `references/cash-in-link.md`, `references/cash-in-method.md` y `references/cash-out.md` deben ser idénticos (sin ediciones manuales)

---

### Requisito: CA-05: references/ completo y con rutas relativas resueltas

#### Escenario: references/ completo y con rutas relativas resueltas
**Dado** que `SKILL.md` enlaza a `references/cash-in-link.md`, `references/cash-in-method.md` y `references/cash-out.md` con rutas relativas
**Cuando** se verifica la estructura de directorios de `refacil-pay-cli/skills/refacil-pay-cli/`
**Entonces** los cuatro archivos deben existir: `SKILL.md` y los tres archivos bajo `references/`; ningún enlace relativo debe quedar roto

---

### Requisito: CA-06: README documenta prerequisito e instrucciones de instalación CLI

#### Escenario: README documenta prerequisito e instrucciones de instalación CLI
**Dado** que un desarrollador lee `refacil-pay-cli/README.md`
**Cuando** busca cómo instalar el plugin
**Entonces** el README debe mencionar explícitamente `npm install -g refacil-pay-cli` como prerequisito (forma completa del comando, no la abreviatura `npm i -g`), el comando `/plugin marketplace add <git-repo-url>` para agregar el marketplace en Claude Code CLI, y el comando `/plugin install refacil-pay-cli@refacil-plugins` para instalar el plugin. El mismo comando completo `npm install -g refacil-pay-cli` debe usarse en la descripción de `plugin.json`.

---

### Requisito: CA-08: README documenta el modelo de actualizaciones (dos capas)

#### Escenario: README documenta el modelo de actualizaciones (dos capas)
**Dado** que un usuario tiene el plugin instalado y quiere recibir actualizaciones
**Cuando** lee la sección de actualizaciones del `README.md`
**Entonces** el README debe explicar las dos capas: (1) **binario del CLI** — lo actualiza el propio paquete del CLI (un hook que instala su `postinstall`, dueño `refacil-mcps`), con `npm update -g refacil-pay-cli` como fallback manual, y (2) **skill/plugin** vía el marketplace — indicando que se debe **activar el auto-update** del marketplace (`/plugin` → pestaña Marketplaces) porque en marketplaces de terceros viene desactivado por defecto; con el auto-update activado, como `plugin.json` omite `version`, cada commit al repo se distribuye automáticamente. Debe documentar también la alternativa manual: `/plugin marketplace update refacil-plugins` seguido de `/plugin uninstall` + `/plugin install` (no existe `/plugin update`).

---

### Requisito: CA-07: Estructura reconocible por /plugin marketplace add

#### Escenario: Estructura reconocible por /plugin marketplace add
**Dado** que el repositorio tiene la estructura `.claude-plugin/marketplace.json` en la raíz y `refacil-pay-cli/.claude-plugin/plugin.json` en el subdirectorio del plugin
**Cuando** se ejecuta `/plugin marketplace add <url-del-repo>` en Claude Code CLI
**Entonces** el comando debe completar sin errores y el plugin `refacil-pay-cli` debe quedar disponible para instalación con `/plugin install refacil-pay-cli@refacil-plugins`

---

---

### Requisito: CR-01 (rechazo): Skills colocadas dentro de .claude-plugin/

#### Escenario: Skills colocadas dentro de .claude-plugin/
**Dado** que se intenta colocar `SKILL.md` dentro de `refacil-pay-cli/.claude-plugin/` en vez de en `refacil-pay-cli/skills/refacil-pay-cli/`
**Cuando** Claude Code intenta descubrir la skill
**Entonces** el plugin debe rechazarse o la skill debe quedar invisible; esta estructura es inválida y no debe existir en el repositorio

---

### Requisito: CR-02 (rechazo): SKILL.md o references/ editados a mano

#### Escenario: SKILL.md o references/ editados a mano
**Dado** que alguien modifica `SKILL.md` o cualquier archivo de `references/` directamente en este repositorio (en vez de actualizar la fuente en `refacil-mcps` y revendorizar)
**Cuando** se compara el archivo con la versión publicada en npm
**Entonces** la divergencia debe detectarse como error de vendorización; el proceso correcto es modificar la fuente en `refacil-mcps`, publicar una nueva versión del paquete y ejecutar el proceso de vendorización

---

### Requisito: CR-03 (rechazo): references/ omitido o incompleto

#### Escenario: references/ omitido o incompleto
**Dado** que se copia únicamente `SKILL.md` sin su carpeta `references/`
**Cuando** el agente intenta seguir un enlace relativo del SKILL.md (p. ej. `references/cash-in-link.md`)
**Entonces** el agente debe reportar que el archivo no existe; esta estructura es inválida y debe ser rechazada en la revisión del PR

---

### Requisito: CR-04 (rechazo): marketplace.json o plugin.json con campos faltantes

#### Escenario: marketplace.json o plugin.json con campos faltantes
**Dado** que alguno de los manifiestos no tiene los campos requeridos (p. ej. `name`, `owner` o `plugins` en marketplace.json; `name` o `description` en plugin.json)
**Cuando** Claude Code intenta parsear el manifiesto
**Entonces** el marketplace o el plugin debe fallar en la carga con error de esquema; los manifiestos incompletos no son aceptables

---

### Requisito: CR-05 (rechazo): Flujo de instalación Claude Desktop/Cowork documentado sin verificación en vivo [RIESGO DOCUMENTAL]

#### Escenario: Flujo de instalación Claude Desktop/Cowork documentado sin verificación en vivo [RIESGO DOCUMENTAL]
**Dado** que la documentación oficial de Claude Desktop (`https://code.claude.com/docs/en/desktop.md`) no detalla con precision el flujo exacto de instalación de plugins via UI
**Cuando** se documenta el flujo de instalación en el README como un paso definitivo
**Entonces** la documentación debe marcarse explícitamente como "pendiente de verificación en vivo"; NO se debe presentar como un hecho confirmado hasta validarlo contra la UI real de Claude Desktop/Cowork; este criterio es un punto de riesgo documental que debe resolverse antes de marcar la tarea de documentación como completada

> **Nota cross-repo**: este cambio consume el contrato publicado por `refacil-mcps` (generators/cli). Ver `refacil-prereqs/BUS-CROSS-REPO.md` para el protocolo de validación de contratos entre repositorios.

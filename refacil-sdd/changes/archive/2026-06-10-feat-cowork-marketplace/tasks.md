# tasks: feat-cowork-marketplace

- [x] T-01: Crear manifiestos `.claude-plugin/marketplace.json` y `refacil-pay-cli/.claude-plugin/plugin.json` con el contenido exacto especificado; `plugin.json` **sin campo `version`** (distribución por commit SHA para auto-update) [S]
- [x] T-02: Vendorizar `SKILL.md` y `references/` (cash-in-link.md, cash-in-method.md, cash-out.md) copiando desde el paquete npm global `refacil-pay-cli` (última versión publicada) sin edición manual [S]
- [x] T-03: Crear `refacil-pay-cli/README.md` documentando el prerequisito `npm install -g refacil-pay-cli` (forma completa), el comando de instalación CLI, la **sección de actualizaciones (dos capas: `npm update -g` para el CLI; activar auto-update del marketplace para la skill)** y la nota de riesgo documental para el flujo de Claude Desktop/Cowork [S]
- [x] T-04: Verificar en vivo el flujo de instalación de plugins en Claude Desktop/Cowork contra `https://code.claude.com/docs/en/desktop.md` y actualizar el README con el resultado (confirmar o dejar como pendiente con advertencia explícita) [M]
- [x] T-05: Validar la estructura completa ejecutando `/plugin marketplace add <url-del-repo>` en Claude Code CLI y confirmar que `/plugin install refacil-pay-cli@refacil-plugins` completa sin errores [S]

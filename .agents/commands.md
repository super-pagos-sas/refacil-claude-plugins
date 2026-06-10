# Commands

No hay `package.json` ni Makefile — los comandos son directos sobre Node.js y el toolchain SDD-AI.

## Tests
```bash
node --test                                    # toda la suite de contrato
node --test test/feat-cowork-marketplace.test.mjs   # un archivo
node --test --test-name-pattern "CA-04"        # filtrar por criterio
```

## Plugin / marketplace (lado usuario, en Claude Code)
```
/plugin marketplace add <git-repo-url>         # registrar el marketplace (una vez por máquina)
/plugin install refacil-pay-cli@refacil-plugins # instalar el plugin
```

## CLI subyacente (prerequisito del plugin)
```bash
npm install -g refacil-pay-cli                 # instalar/actualizar el binario (siempre la última)
refacil-pay-cli login                          # autenticar sesión antes de los flujos
```

## Vendorización (al actualizar el CLI)
1. `npm install -g refacil-pay-cli` (última versión).
2. Re-copiar los archivos de skill desde el global hacia `refacil-pay-cli/skills/` (deben quedar byte-idénticos).
3. `node --test` para validar CA-04 y el resto de contratos.

## SDD-AI (toolchain de la metodología)
```bash
refacil-sdd-ai sdd list                        # cambios activos
refacil-sdd-ai sdd status <nombre>             # estado de un cambio
refacil-sdd-ai sdd config                      # config efectiva de ramas
```

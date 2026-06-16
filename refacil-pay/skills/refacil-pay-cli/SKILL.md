---
name: refacil-pay-cli
description: "Operador CLI de Refácil Pay (refacil-pay-cli). Usar para: cash-in, cash-out, payment-link, refacil-pay, generar link de pago, enviar dinero, generar cobro, Refacil, auth, login, trx-token, payment-method, withdraw-method, customer, getbalance, payment, customer-reference, features, webhook, notify, merchant, enrollment-data, user-webhooks. Flows: cash-in-link (Cobrar al cliente mediante link de pago.), cash-in-method (Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.).)…"
user-invocable: true
---

# Refácil Pay CLI — Skills Index

Use the `refacil-pay-cli` CLI to interact with the Refácil Pay API directly from the terminal.

## Installation

This skill drives the `refacil-pay-cli` CLI, which must be installed globally before any flow:

```
npm install -g refacil-pay-cli
```

> Requires Node.js >= 20. If the `refacil-pay-cli` command is not found, run the install above first.

## Flows
- **[cash-in-link](references/cash-in-link.md)** — Cobrar al cliente mediante link de pago. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo link) → crear link de cobro → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.

- **[cash-in-method](references/cash-in-method.md)** — Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.

- **[cash-out](references/cash-out.md)** — Enviar fondos hacia llave Bre-B. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: verificar saldo → generar token transaccional (tipo retiro) → ejecutar retiro. Entrega siempre el recurso al usuario antes de revisar el webhook o el estado.


## Authentication

> **Security**: The user authenticates in the **browser** (OAuth) or on the sign-up page — the password is never typed into the chat or terminal, and the AI assistant never sees it.

### Paso previo: ambiente

Before starting any authentication or operational command, the agent must confirm the target environment with the user:

> *"¿Estás trabajando en **sandbox** (pruebas/integración) o **prod** (clientes reales)?*"

- **prod**: use only when the user explicitly mentions real clients, real transactions, or production.
- **sandbox**: for all tests, demos, and development work (default when unsure).

Once confirmed, optionally persist it so the user doesn't need to repeat `--env` on every command:

```
refacil-pay-cli config set-environment <sandbox|prod>
```

The agent can verify the active default at any time with:

```
refacil-pay-cli config get-environment --json
```

### How the agent resolves authentication — do this BEFORE any operational command

First, check for an active session:

```
refacil-pay-cli whoami
```

If there is **no active session**, the agent resolves it like this (the agent runs the commands itself):

1. **Ask the user: "Do you already have a Refácil Pay account?"**
2. **If they do NOT have an account** — the agent runs:
   ```
   refacil-pay-cli register
   ```
   This opens the sign-up page (sandbox: https://autoregistro.qa.refacilpay.co/ / prod: https://autoregistro.refacilpay.co/) in the browser for the active environment. Then tell the user:
   > *"I just opened the Refácil Pay sign-up page in your browser — create your account there and tell me when you're done."*
3. **If they DO have an account** — the agent runs:
   ```
   refacil-pay-cli login
   ```
   This opens the login page in the browser. Then tell the user:
   > *"I just opened the Refácil Pay login page in your browser — sign in there and tell me when you're done."*
4. When the user says they finished, re-run `refacil-pay-cli whoami`. If authenticated, continue with the task; otherwise repeat the step.

> **Agent note — security**: The agent runs only the **browser-based** `login` (or `login --device` when isolated) and `register` — the user enters credentials in the browser or on the device verification page, never in the chat or terminal. **Never** run `refacil-pay-cli login --console` on the user's behalf, and never ask for the user's password. The agent triggers these commands but never sees the credentials.

### Elegir el flujo de autenticación (tú decides, el CLI no auto-detecta)

The CLI does **not** guess the environment — **you** choose, because you know whether you can open a browser and receive a `127.0.0.1` callback.

**Prefer `refacil-pay-cli login` (loopback OAuth 2.1 + PKCE) — it is the secure default.** PKCE binds the authorization to this machine, the code is not transcribable/phishable, and the token travels only in the back-channel. Use it whenever you can open a browser and catch the localhost callback. Local desktop agents (Claude Code, Cursor, OpenCode, Antigravity) fall here.

```
refacil-pay-cli login
```

**Use `refacil-pay-cli login --device` only when you are isolated** and cannot open a browser or receive a localhost callback — e.g. a remote/cloud sandbox (Codex), CI, or an SSH-only host. (`REFACIL_PAY_CLI_HEADLESS=1` is the non-interactive equivalent of `--device`.)

After login, you can inspect `refacil-pay-cli whoami --json`:
- `keychainAvailable: false` → token is stored in `~/.config/refacil-pay-cli/credentials.json` (0600) instead of the OS keychain.
- `tokenSource` → where the active token came from (`"keychain"`, `"file"`, or `"flag"`).

**Device flow sequence (when you chose `--device`):**

1. **Run the device flow login:**
   ```
   refacil-pay-cli login --device
   ```
   The CLI prints a `verification_uri` and a `user_code` to stdout.

2. **Relay to the user** (do not open the browser yourself):
   > *"Please visit **[verification_uri]** and enter code **[user_code]** to authorize the CLI. Tell me when you are done."*

3. **Wait for user confirmation** — the CLI polls the server automatically. Do not run any additional commands until the user confirms.

4. **Revalidate the session:**
   ```
   refacil-pay-cli whoami --json
   ```
   If `authenticated: true`, continue with the task. Otherwise, repeat step 1.

> **Prohibition**: Never run `refacil-pay-cli login --console` on the user's behalf. Never ask the user for their password in the chat.

### Device flow en background

> **NEVER** run `refacil-pay-cli login --device` in a blocking foreground call inside a Desktop or Cowork AI session — it blocks the agent thread while polling and the verification URL/code cannot be relayed to the user.

**Pattern for non-blocking device flow** (use when you must trigger login from a session that cannot block):

```bash
# 1. Start the device flow in the background, redirect output to a temp file
refacil-pay-cli login --device > /tmp/device-login.txt 2>&1 &

# 2. Wait for the device-code response (10 s covers slow server round-trips)
sleep 10 && cat /tmp/device-login.txt
```

3. **Extract and relay to the user** the lines that start with `Visit:` and `Enter code:`:
   > *"Please visit **[Visit: URL]** and enter code **[Enter code: CODE]** to authorize the CLI. Tell me when you are done."*

4. After the user confirms:
   ```
   refacil-pay-cli whoami --json
   ```
   If `authenticated: true`, continue. Otherwise ask the user to retry and repeat from step 1.

> **Console login fields** (for reference only — the agent never runs `--console`): `refacil-pay-cli login --console` prompts for: `username`, `password`. The user must run this command themselves in the terminal if they prefer it.

### Verification

After login, confirm the session:

```
refacil-pay-cli whoami
```

> **Note**: The operational skill flows (cash-in-link, cash-in-method, cash-out) do **not** include authentication steps.
> The agent must resolve authentication **before** executing any flow.

## Auto-fill IP

The CLI automatically fills the following fields with the machine's real public IP: `userMetadata.ip`. Do NOT invent an IP, do NOT ask the user for it, and do NOT create temporary metadata files; just provide the remaining fields.

## WhatsApp Messaging (Kapso)

The `refacil-pay-cli whatsapp send` command sends a structured **3-part WhatsApp message** (title + optional label + body) through the configured Kapso account. Use `--command-key` with `--url` and `--amount` to build a message from the YAML-configured templates and payment method labels.

### How the agent uses it

1. **Verify Kapso is configured** before offering to send:
   ```
   refacil-pay-cli config get-kapso --json
   ```
   If `kapsoEnabled` is `false`, offer to configure with `refacil-pay-cli config set-kapso --api-key <key> --phone-number-id <id>`. If the user declines, do not attempt to send.
2. **Verify `merchantName`** in the config output. If `merchantName` is `null`, ask the user for their commerce name and persist it before sending:
   ```
   refacil-pay-cli config set-kapso --merchant-name "<name>"
   ```
3. **Always ask the user for the recipient phone number** in E.164 format (e.g. `+573001234567`) — the number is required and must never be assumed.
4. **Send the message** using the structured flags:
   ```
   refacil-pay-cli whatsapp send --to <e164> --command-key <key> --url <resource-url> --amount <amount>
   ```
   To override the message body with custom text:
   ```
   refacil-pay-cli whatsapp send --to <e164> --command-key <key> --url <resource-url> --message "<custom text>"
   ```
5. **Report the result**:
   - `✓ WhatsApp message sent to <number>` (stdout, exit 0) — delivered.
   - `WhatsApp not sent: <reason> ⚠` (stderr, exit 1) — not delivered.

> **Note:** WhatsApp only delivers free-text messages within the **24-hour window** since the recipient's last inbound message. Mention this limitation to the user.

## Output Formats

- Default: human-readable colored output (a table for the **user** to read)
- `--json`: raw JSON response
- `--no-color`: plain text output

> **Agent rule:** whenever you need to **read a field** from a command's response (URL, reference, id, status, balance…), run the command with `--json` and parse the JSON. The default table is for displaying to the user only — it can collapse nested objects to `[object Object]` and hide the field you need. Never extract a value from the table.

## Profiles

Use `--profile <name>` to switch between credential sets.

```bash
refacil-pay-cli config set-profile production
refacil-pay-cli whoami --profile production --env prod
```

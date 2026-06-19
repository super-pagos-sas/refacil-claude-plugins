---
name: refacil-pay-cli
description: "Operador CLI de Refácil Pay (refacil-pay-cli). Usar para: cash-in, cash-out, payment-link, refacil-pay, generar link de pago, enviar dinero, generar cobro, Refacil, auth, login, trx-token, payment-method, withdraw-method, customer, getbalance, payment, customer-reference, features, webhook, notify, merchant, enrollment-data, user-webhooks. Flows: cash-in-link (Cobrar al cliente mediante link de pago.), cash-in-method (Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.).)…"
user-invocable: true
---

# Refácil Pay CLI — Skills Index

Use the `refacil-pay-cli` CLI to interact with the Refácil Pay API directly from the terminal.

## Installation

```
npm install -g refacil-pay-cli
```

> Requires Node.js >= 20. If `refacil-pay-cli` is not found, run the command above first.

> **Agent note:** `init` is an interactive wizard (it requires a TTY and fails in an agent shell) — do not run it. Use `skills install` with flags instead, which is non-interactive and supports any destination:
> - `refacil-pay-cli skills install --yes` — install to all detected IDEs
> - `refacil-pay-cli skills install --ide <id>` — install to a specific IDE
> - `refacil-pay-cli skills install --path <dir>` — install to a **custom directory** (use this when you need the skill in a specific location; no `--yes`/`--ide` needed)

## Security Rules (non-negotiable)

> **The agent MUST follow these rules without exception:**
>
> 1. **Never create an account on behalf of the user** — only the user creates their own account.
> 2. **Never choose or type the user's password** — credentials are entered by the user in the browser or device page.
> 3. **Never run `refacil-pay-cli login --console`** — use only browser-based or device-grant flows.
> 4. **Never ask for or store the user's password in the chat or terminal**.
> 5. **The account belongs to the user** — do not use credentials from previous sessions without re-confirming.

## Operating contract — apply on every task, never skip a step

1. **Auth:** if you **can** open a browser and catch a `127.0.0.1` callback, run `refacil-pay-cli login` **yourself, in the foreground with a ~5 min command timeout** — it opens the browser and returns on success. **Do not background it, do not open a separate console, do not run it in a sub-agent.** **If you CANNOT open a browser (Claude Desktop, Cowork, cloud sandbox, CI, SSH-only) → use device mode (env-headless.md): start, relay the code, redeem — it does not block and needs no background process.** Never ask the user to run a login command. (see *Environment Detection*)
2. **JSON flags** (`object`/`array`): write the payload with your own file-writing tool and pass it as `@file.json`; never inline JSON, never `Out-File`/`Set-Content`. (see *Passing JSON arguments*)
3. **Long-running background commands** (`--webhook-local` and tunnels): run them **detached → output to a log file → read it in a later step**; never run them in the foreground and never use PowerShell `Start-Job`/`Get-Job`. **Loopback `login`/`register` are NOT in this category** — run them in the **foreground with a ~5 min timeout** (they open the browser and return on success). **Headless device login is NOT in this category either** — it is two quick non-blocking commands (start, then redeem), no background process (see env-headless.md). (see *Running long commands in the background*)
4. **After a create with `--webhook-local`:** reply to the user with the generated resource FIRST, then wait for the background process to exit, read its log, validate with `refacil-pay-cli payment-status`, and notify — **do every step, in order**. If background execution is unavailable, use `--webhook-url` or no webhook + `payment-status` on demand instead. (see *Webhook callback*)
5. **Dangerous (money/destructive) commands:** confirm the exact operation with the user in the chat, then run with `--yes`.

## Talking to the user (communication style)

These rules govern **how** you communicate while running any flow. The *what* (security, confirmation, deliver-first, validate-with-API) is the **Security Rules** and **Operating contract** above — this section is the user-facing layer on top of them, not a replacement.

- **Speak the user's language, in business terms.** Use words like "link de cobro", "saldo disponible", "retiro aprobado". **Never expose** commands, flags, JSON, file paths, raw API responses, or numeric status codes to the user — translate them into plain language.
- **Ask only for what is missing.** If the user already gave a value (amount, recipient, identifier…), never ask for it again. Collect the remaining inputs conversationally, grouping closely related fields and keeping each question short (each flow's *Recolección de datos* section says what to ask).
- **`Ask only what's missing` does NOT apply to these — ALWAYS confirm them, they are safety/intent decisions, not optional data fields:**
  1. **Environment** — `sandbox` (tests) vs `prod` (real money) — confirm before the **first** operation of the conversation. **Never silently default to sandbox** for what might be a real request. (Agents run non-TTY, so the CLI's own environment prompt does **not** fire — you are the one who must ask.)
  2. **Account** — on first login, ask whether the user **already has an account** (if not, register first). (The CLI's account wizard is TTY-only and is skipped when you run login, so this must happen in the chat.)
  3. **Webhook** — for any flow that sends callbacks, confirm the **webhook choice** (local tunnel for testing / your own URL / none) before running it. A webhook is **not** a skippable optional input.

  Confirm each of these **once**, then reuse the answer for the rest of the conversation (don't re-ask).
- **Route by intent.** Map the user's natural-language request to the matching flow in **Flows** by its description (e.g. "cóbrale 50.000 a un cliente" → the cash-in link flow). If the intent is ambiguous, ask once which one they want — never guess a money-moving action.
- **Confirm money/irreversible operations with a plain-language summary** (amount, recipient, method) and wait for an explicit yes before running the dangerous command with `--yes` (Operating contract §5).
- **Deliver first, never block.** When a flow generates a resource (link/QR/reference), give it to the user immediately; checking the webhook or payment status is never a prerequisite for replying (Operating contract §4).
- **Translate errors.** Never show raw error output. Explain what happened in plain language and offer a next step. Map known failures to a friendly message: no active session → "Necesito iniciar sesión primero, dame un momento" (and you run the login); missing CLI/dependency → tell the user the one thing to install; insufficient balance → state the available balance.

## Environment Detection

Before any auth or operational command, detect the runtime environment:

```
refacil-pay-cli whoami --json
```

Read the fields `headless`, `keychainAvailable`, and `tokenSource` to select the right reference:

| Condition | Environment file |
|---|---|
| **You cannot open a browser or receive a `127.0.0.1` loopback callback** (Claude Desktop, Cowork, cloud sandbox, CI, SSH-only) | [references/env-headless.md](references/env-headless.md) **(device grant)** |
| `headless: true` | [references/env-headless.md](references/env-headless.md) |
| `headless: false` and `keychainAvailable: true` | [references/env-local.md](references/env-local.md) |
| `headless: false` and `keychainAvailable: false` | [references/env-headless.md](references/env-headless.md) |
| Deployed server / no interactive session | [references/env-server.md](references/env-server.md) |

**The first row decides for agents.** The `headless` field only reports the explicit `REFACIL_PAY_CLI_HEADLESS` override — the CLI does **not** auto-detect — so it can read `false` even when you (an agent) have no browser. The capability is yours to know: **if you cannot open a browser and catch a loopback callback, follow env-headless.md (device grant)** regardless of the `headless` value. Device mode does not block and needs no background process — it persists a code, you relay it, then you redeem (see env-headless.md).

When in doubt, ask the user: "Are you running this in a local desktop, a headless/cloud sandbox, or a deployed server?"

> **You (the agent) run the authentication yourself — never ask the user to run a login command in their terminal.** Open and follow the selected `references/env-*.md` and run its login steps exactly as written — they differ by environment: **local/loopback** runs `refacil-pay-cli login` in the **foreground** (it opens the browser and self-completes); **headless/no-browser** uses the **device grant** — a quick start that persists a code and exits, you relay the code, then you redeem it (no background process, no blocking poll). Confirm with `refacil-pay-cli whoami --json` until `authenticated: true`. The user only completes the browser sign-in (local) or enters the device code (headless). When a session expires, re-run the login yourself — do **not** tell the user to run it.

## Flows
- **[cash-in-link](references/cash-in-link.md)** — Cobrar al cliente mediante link de pago. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo link) → crear link de cobro → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.

- **[cash-in-method](references/cash-in-method.md)** — Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.

- **[cash-out](references/cash-out.md)** — Enviar fondos hacia llave Bre-B. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: verificar saldo → generar token transaccional (tipo retiro) → ejecutar retiro → verificar estado. Entrega siempre el recurso al usuario antes de revisar el webhook o el estado.


## Environment References

- **[env-local.md](references/env-local.md)** — Browser-based auth (PKCE/loopback), local webhook tunnel
- **[env-headless.md](references/env-headless.md)** — Device Grant auth, headless register, polling webhook
- **[env-server.md](references/env-server.md)** — Device Grant auth, fixed or tunneled webhook for servers
- **[operations.md](references/operations.md)** — WhatsApp messaging and auto-fill IP (when enabled)

## Passing JSON arguments (avoid escaping errors)

Some flags are typed `object` / `array` (JSON) — check `refacil-pay-cli <command> --help`. Inline JSON over the shell is the #1 source of wasted time (quoting, BOM, encoding). Do this instead:

- **Write the JSON to a file with your own file-writing tool** (not shell redirection / not `Out-File`/`Set-Content` — those add a UTF-8 BOM on Windows PowerShell that breaks parsing), then pass it by path — the `@` prefix makes the CLI read and parse it:
  ```bash
  refacil-pay-cli <command> --<field> @payload.json
  ```
  Delete the temp file afterwards (payloads may hold sensitive data).
- **PowerShell:** quote any argument that starts with `@` — write `'@payload.json'` (single quotes), because a bare `@…` is read as PowerShell's splatting operator. (bash/sh: `@payload.json` unquoted is fine.)
- bash/sh only: `echo '{"k":"v"}' | refacil-pay-cli <command> --<field> @-`
- **Avoid inline** `--<field> '{"k":"v"}'` (shell-specific quoting; fails most on PowerShell).

Scalars are passed as-is: strings quoted, numbers as digits only (no thousands separators or currency symbols), booleans `true`/`false`. Each flow's `references/<flow>.md` has the full per-flag detail.

## Output Formats

- Default: human-readable colored output (table for the user to read)
- `--json`: raw JSON response
- `--no-color`: plain text output

> **Agent rule:** whenever you need to **read a field** from a command's response (URL, reference, id, status, balance…), run the command with `--json` and parse the JSON. The default table is for displaying to the user only — it can collapse nested objects to `[object Object]` and hide the field you need. Never extract a value from the table.

## Running long commands in the background (the right way)

`--webhook-local` and tunnels are long-running background processes (no GUI). **Loopback `login`/`register` are different** — they open the browser and self-complete, so run them in the **foreground with a ~5 min timeout**, NOT backgrounded. **Headless device login is different too** — it is two quick non-blocking commands (start, then redeem; see env-headless.md), so it is never backgrounded here. (env-server.md still backgrounds its device poll — a persistent server host can keep that process alive.)

> **On Windows, prefer your harness's Bash-tool background (`run_in_background: true`, or `... &`) over a PowerShell background (`Start-Process` / `Start-Job`) for any process that must survive minutes** (device-login polling, tunnels). A PowerShell-launched background process has been seen to **die before a long poll/exchange completes** (e.g. the device flow never receives its token), whereas the Bash-tool background keeps it alive. Use the PowerShell `Start-Process … -WindowStyle Hidden` form below only if no Bash-tool background is available.

> **Loopback `login`/`register`: run them foreground with a generous (~5 min) timeout — do NOT background them, do NOT open a separate console / `Start-Process` window, do NOT run them in a sub-agent.** Those decouple the command from your session (a console you can't read, or a sub-agent that gets cancelled), so you never learn login finished — this is the "login opened a new window but the session stayed waiting" failure. The `Start-Process … -WindowStyle Hidden` form below is **ONLY for no-GUI background processes** (the tunnel and `--webhook-local`).

**For tunnel / `--webhook-local` (no-GUI processes — `Start-Process Hidden` is safe here):**

- bash/sh: `refacil-pay-cli <cmd> > out.log 2>&1 &` → in a later step, `cat out.log`.
- PowerShell: on Windows the global CLI is a PowerShell `.ps1` shim, which `cmd` cannot run — launch it through `powershell` (not `cmd /c`); `*>&1 | Out-File` captures all streams and writes the log cleanly even with no interactive console:
  ```
  $p = Start-Process powershell -ArgumentList "-NoProfile","-NonInteractive","-Command","& { refacil-pay-cli <cmd> *>&1 | Out-File -FilePath out.log -Encoding utf8 }" -WorkingDirectory '<your-workspace-dir>' -PassThru -WindowStyle Hidden; $p.Id | Set-Content out.pid
  ```
  Later, read `out.log`; poll completion (e.g. for `--webhook-local`, wait for the process to exit): `Get-Process -Id (Get-Content out.pid) -ErrorAction SilentlyContinue`.

  **PowerShell: `$pid` is a read-only automatic variable (the shell's own PID) — never assign to it. Use `$procId`.**
- **Do NOT use PowerShell `Start-Job`/`Get-Job` (or the bash job table)** — those live only inside one session, and each of your tool calls is a new session, so a later `Get-Job` finds nothing. Prefer your harness's own background/non-blocking run option if it has one.

## Webhook callback (`--webhook-local`) — never block the conversation

A create command (cash-in/cash-out) prints the generated resource (link/QR/reference) **immediately**, then `--webhook-local` keeps it running up to ~8 min waiting for the payment callback. In the foreground your turn never returns — *"the link was created but the assistant never answered"*. So:

- **Deliver the generated resource to the user right away** — checking the webhook is never a prerequisite for replying.
- Run the create command in the **background / non-blocking**, never foreground.
- **To notify the instant the payment arrives:** after replying, in a separate step **wait for the background process to exit** (it closes itself on the first valid payment) and read its log — the flow's `references/<flow>.md` has the exact wait command.
- **Default when background is unavailable:** if your harness has no background execution, or the powershell background command is unavailable or failed — **do NOT use `--webhook-local`**. Instead create with `--webhook-url <url>` (or no webhook flag), reply with the resource immediately, and confirm payment on demand with `refacil-pay-cli payment-status --reference <ref> --json`. This is the safe default — never get stuck because background failed.

## Profiles

Use `--profile <name>` to select a credential set (created on first use).

```bash
refacil-pay-cli whoami --profile production --env prod
```

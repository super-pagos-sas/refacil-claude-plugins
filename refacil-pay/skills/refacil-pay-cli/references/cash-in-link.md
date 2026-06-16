---
flow: cash-in-link
description: "Cobrar al cliente mediante link de pago. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo link) → crear link de cobro → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado."
---

# Flow: cash-in-link

Cobrar al cliente mediante link de pago. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo link) → crear link de cobro → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.


## Envio por WhatsApp

This flow supports sending the generated resource link via WhatsApp. Before executing:

1. Run `refacil-pay-cli config get-kapso --json` to check the Kapso configuration.
2. If `kapsoEnabled` is `false`:
   - Offer to configure Kapso: `refacil-pay-cli config set-kapso --api-key <key> --phone-number-id <id>`
   - If the user declines, continue without WhatsApp delivery (the flow is fully functional without it).
3. If `kapsoEnabled` is `true`:
   - **Merchant name:** Check if `merchantName` is `null` in the output. If so, ask the user for their commerce/business name and persist it before sending:
     ```bash
     refacil-pay-cli config set-kapso --merchant-name "<name>"
     ```
   - **Note:** WhatsApp window is valid for 24 hours after the last incoming message from the recipient. Inform the user of this limitation.
   - After executing the step that creates the resource (with `--json`), parse the JSON response and obtain the URL and amount from the nested data object.
   - Ask the user if they want to send it via WhatsApp.
   - If yes, ask for the recipient's phone number in E.164 format (e.g. `+573001234567`), unless `defaultPhone` is already set.
   - Send the message using the standalone command with structured flags. **Always pass `--command-key`** — it is what selects the YAML-configured `messageTemplates` body and `paymentMethodLabels` label for this step. Omitting it falls back to generic text and loses both:
     ```bash
     refacil-pay-cli whatsapp send --to <e164> --command-key <commandKey> --url <resourceUrl> --amount <amount>
     ```
   - **Do NOT add `--message` by default.** Use the configured template (do not compose your own body). Only pass `--message "<custom text>"` when the **user explicitly asks** for custom wording — and be aware it **overrides the configured template AND drops the label line**:
     ```bash
     refacil-pay-cli whatsapp send --to <e164> --command-key <commandKey> --url <resourceUrl> --message "<custom text>"
     ```
   - Message body priority order (highest to lowest):
     1. `--message <text>` provided by the user (non-empty after trim) — bypasses the template
     2. YAML `messageTemplates[commandKey]` with `{{url}}`, `{{amount}}`, `{{merchant}}` substituted — **the default; prefer this**
     3. Fallback: descriptive text that includes the resource URL (never just the URL alone)

> **Important:** Do NOT recreate the resource if only the WhatsApp delivery fails. The resource (link or payment method) was already created and billed — only the notification failed.


## Auto-fill IP

The CLI automatically fills the following fields with the machine's real public IP: `userMetadata.ip`. Do NOT invent an IP, do NOT ask the user for it, and do NOT create temporary metadata files; just provide the remaining fields.


## Webhook Configuration

This flow includes steps that send callbacks to a webhook URL. Before executing, confirm the effective URL with the user following this priority order:

1. `--webhook-local` — spins up a temporary public tunnel (for testing only)
2. `--webhook-url <url>` — explicit URL provided at call time
3. Stored default (`refacil-pay-cli config get-webhook-url`) — persisted per profile/env
4. Omit — the API may reject or silently drop the callback

**Ask the user to confirm which URL to use before proceeding.**

To persist a default webhook URL for future calls:

```bash
refacil-pay-cli config set-webhook-url --url <your-webhook-url>
refacil-pay-cli config get-webhook-url
```

> **Warning:** `--webhook-local` opens a temporary public tunnel to your local machine. Use it only for development/testing in a trusted environment; it is NOT suitable for production.

### Tunnel prerequisite (`--webhook-local`)

`--webhook-local` spins up the tunnel using the configured provider: **`cloudflared`**.
> **Preferred provider:** `cloudflared` is the default because it is **more reliable** than localtunnel.
> Keep it as the provider. Switching to localtunnel is a **temporary, zero-install fallback** only —
> it **persists** in the config (it is not a one-off), so prefer installing/fixing `cloudflared`, and if
> you do switch, revert afterwards with `refacil-pay-cli config delete webhook-provider`.
`cloudflared` is an **external binary this CLI does NOT bundle or auto-install**. Before running any step with `--webhook-local`:

1. **Verify it is installed** — run `cloudflared --version`.
2. **If it is missing, STOP — do NOT run the command** (it would fail, and a misconfigured run could send an invalid webhook URL). Tell the user and offer one of:
   - Install `cloudflared` with a manager that sets PATH for you (avoids the issue below): Windows → `scoop install cloudflared` (no admin) or `choco install cloudflared` · macOS → `brew install cloudflared` · Linux → distro package or download into a dir on PATH (e.g. `/usr/local/bin`). Cloudflare downloads: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - **`winget install cloudflare.cloudflared` works but often does NOT add it to PATH** (portable shims need Developer Mode/restart). If you used winget and `cloudflared --version` fails, either add its folder to PATH and **restart the terminal/IDE** (so the new PATH is inherited), or point the CLI straight at the binary via the `CLOUDFLARED_BIN` env var set to the full path of `cloudflared.exe`.
   - **Or**, as a **temporary fallback**, switch to the zero-install provider:
     `refacil-pay-cli config set-webhook-provider localtunnel`. ⚠ This **persists** in the config and
     localtunnel is **less reliable** than `cloudflared` — prefer installing/fixing
     `cloudflared`. To revert to the default later:
     `refacil-pay-cli config delete webhook-provider`.
3. **Only continue once the user confirms** the binary is reachable (installed and on PATH, or `CLOUDFLARED_BIN` set, or switched providers). Do not auto-install anything; do not proceed with `--webhook-local` while the provider is unavailable.

> **⚠ HARD RULE — never block the conversation waiting on the webhook.** With `--webhook-local` the create command prints the generated resource immediately and **then keeps running until the first callback arrives** (or until it times out, ~8 min). If you run it in the **foreground**, your tool call will not return until then, so you stay stuck in the same turn and never reply with what you generated — this is exactly the "the link was created but the assistant never answered" failure. Always follow this order:
>
> 1. **Run the create command in the background / non-blocking mode** so the tunnel never blocks the conversation. **Never run it in the foreground.**
> 2. **Read the generated resource from the command's immediate output** (run it with `--json` and parse the URL / QR and reference from the response).
> 3. **Reply to the user right away with the resource**, and offer to send it via WhatsApp (see the *Envio por WhatsApp* section above). Do **NOT** wait for the callback before replying.
> 4. **Only afterwards**, as a **separate** action, read the callback from the background process output (it closes by itself when the first notification arrives) — or use the status step below to confirm the payment. Checking the webhook is **never** a prerequisite for responding, and you must never withhold the generated resource while waiting on it.
>
> **If your harness cannot run a process in the background (no non-blocking execution), do NOT use `--webhook-local` at all** — it blocks by design and will hang your turn. Instead create the resource with a stored/explicit `--webhook-url` (or with no webhook), reply with the resource immediately, and confirm the payment later with the **status step** below (poll on demand). Only use `--webhook-local` when you can truly run it detached.

### Desktop notification & authenticity check (`--webhook-local`)

When `--webhook-local` receives a callback, the CLI raises a **native desktop notification** ("Refácil Pay — webhook recibido") in addition to printing the callback. Guide the user through it:

1. **Tell the user up front**, before the resource is paid: *"Cuando llegue el pago, recibirás una notificación de escritorio. Avísame en cuanto la veas para validarla contra el sistema."*
2. **When the user confirms** they received the notification, do **NOT** treat the payment as final based on the notification (or the raw callback body) alone. The `--webhook-local` tunnel is **public**, so anyone who learns the URL could POST a forged callback.
3. **Validate against the system** before confirming: run this flow's status/confirmation step (see **Steps** below) using the transaction **reference** from the create response, and compare the real state returned by the API with what the notification claimed.
4. **Only if the API confirms the same state** report the payment as genuine. If they differ — or the status query shows the transaction is not actually paid — warn the user that the notification could **not** be validated and may be spoofed, and do not proceed.

> **The toast depends on OS notification settings.** The CLI always sends the notification, but the operating system silently drops it when notifications are disabled — the CLI cannot detect this. Before relying on it (step 1), tell the user to enable OS notifications. Either way, the callback is **always also printed to the command output**, so the flow never depends on the toast appearing.
> - **Windows:** Settings → System → Notifications **on**, and turn off **Focus assist / Do not disturb**.
> - **macOS:** System Settings → Notifications → allow notifications for the terminal app you run the CLI from, and turn off **Focus / Do Not Disturb**.
> - **Linux:** requires a desktop session with a notification daemon (GNOME/KDE/dunst) and `notify-send` installed (e.g. `libnotify-bin`). It will **not** appear on a headless or SSH-only session.

> The desktop notification is just an **alert that something arrived** — never proof. Authenticity is established only by querying the system for the real transaction state.

## Argument format

Most flags are plain scalars, passed as-is:

- **string** — `--<field> "plain text"`
- **number** — `--<field> 50000` (digits only; no quotes, thousands separators, or currency symbols)
- **boolean** — `--<field> true`

Some flags are **JSON** — type `object` or `array`, marked per flag in the **Steps** below. The robust way to pass them is a **file** referenced with `@` (sidesteps all shell-quoting issues):

1. Write the JSON to a file using your file-writing tool, or the redirection of the shell you are **actually** in — **pick one shell and stay in it**. Mixing shells is the #1 cause of failures here (e.g. running a PowerShell cmdlet under bash):
   - bash / sh: `printf '%s' '{"key":"value"}' > payload.json`
   - PowerShell: `Set-Content -Path payload.json -Value '{"key":"value"}' -Encoding utf8`
2. Verify the file exists, then pass it by path:
   ```bash
   refacil-pay-cli <command> --<field> @payload.json
   ```
3. **Delete the temp file once the command finishes** (whether it succeeded or failed) — these payloads hold sensitive data (identifiers, IPs, customer/commerce info) and must not be left on disk:
   - bash / sh: `rm -f payload.json`
   - PowerShell: `Remove-Item payload.json -Force`

Alternatives:

- **stdin (no temp file — preferred)** — pipe the JSON and use `@-`, so there is **nothing to clean up**: `echo '{"key":"value"}' | refacil-pay-cli <command> --<field> @-`
- **Inline JSON** — `refacil-pay-cli <command> --<field> '{"key":"value"}'` (one command, no file, but quoting is shell-specific and error-prone on PowerShell).

The `@` prefix (and `@-`) is interpreted only for object/array fields.

> **Get the format right the first time — don't trial-and-error.** Choose ONE shell and do not mix syntaxes: never call a PowerShell cmdlet (`Out-File`, `Set-Content`) inside a bash command, or `>`/`printf` redirection inside PowerShell. For every flag marked `(object)`/`(array)`, build the JSON from that step's field table, write it to a file (or pipe via `@-`), verify it, pass it, **then delete the file**. Prefer `@-` (stdin) to avoid leaving any file behind. Never split a JSON field into loose key/value flags.

## Reading command output

**Always run commands with `--json` when you need to read fields from the response** (URL, reference, transaction id, status, etc.). The default output is a human-readable table meant for showing to the user; it can collapse nested objects to `[object Object]` and hide the very field you need. The step commands below already include `--json` for this reason.

- Parse the JSON the command prints on stdout and extract the fields you need (e.g. `data.url`, `data.reference`).
- The API wraps results in a status envelope — a `statusCode` of `00` (or an explicit success message) indicates success; read the resource fields from the nested data object, not from the top level.
- Only present the human-readable form to the user; never rely on the table to extract a value programmatically.

## Steps

### Step 1: Generar token transaccional (link de pago)

```bash
refacil-pay-cli trx-token-link --json
```

### Step 2: Crear link de cobro
## 📥 Request Body Parameters

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| `amount` | number | ✅ | Value of the payment. |
| `brandId` | number | ❌ | ID of the customer's white label; if one is not available, the default ID 79 is sent. |
| `expiresIn` | number | ❌ | Time in minutes for the expiration of the resource or payment link. |
| `reference1` | string | ✅ | Customer identifier, must be between 1 and 36 characters. |
| `reference2` | object | ❌ | Object for additional information. |
| `reference2.Commerce` | object | ❌ | Object for information related to the store or commerce. |
| `reference2.Data` | object | ❌ | Object for information related to the conciliation of the transaction. |
| `reference2.Label` | object | ❌ | Object to send information to be displayed in the payment summary. |
| `returnUrl` | string | ❌ | Link that the customer will see when clicking on the back to commerce button. |
| `showSummary` | boolean | ❌ | Indicates whether the RefácilPay payment summary will be shown or not (false: do not show, true: show). Default: true. |
| `userMetadata` | object | ✅ | Object containing key details about the user or merchant generating the payment resource. |
| `userMetadata.identifier` | string | ✅ | Unique identifier of the user or merchant generating the payment resource (max 36 characters). |
| `userMetadata.ip` | string | ✅ | IP address associated with the user's identifier. Must be a valid IP address. |
| `userMetadata.urlCommerce` | string | ✅ | URL that identifies the commerce. Must follow valid URL structure with http:// or https:// protocol. Maximum length: 500 characters. |
| `webhookUrl` | string | ✅ | URL of the client's webhook to receive real-time payment status updates. |

```bash
refacil-pay-cli cash-in-link-create --amount <amount> --webhook-url <webhook-url> --user-metadata @user-metadata.json --json
```
**Required flags:**
- `--amount` (number) — Field: amount
- `--webhook-url` (string) — Field: webhookUrl
- `--user-metadata` (object) — Field: userMetadata — JSON; prefer `--user-metadata @user-metadata.json` (see **Argument format**). Example: `{"ip":"1.2.3.2","identifier":"123467hyujikolpñmnaafsddssd","urlCommerce":"https://url-tucomercio.com"}`

> **WhatsApp send:** After parsing the `--json` response above to obtain the resource URL and amount, offer to send it via WhatsApp. Use `--command-key cash-in.link.create` exactly (this selects the configured template and label for this step) and **do not add `--message`** unless the user explicitly asks for custom wording:
> ```bash
> refacil-pay-cli whatsapp send --to <e164> --command-key cash-in.link.create --url <resourceUrl> --amount <amount>
> ```
> See the **Envio por WhatsApp** section above for full instructions.

### Step 3: Verificar estado del pago

```bash
refacil-pay-cli payment-status --reference <reference> --json
```
**Required flags:**
- `--reference` (string) — Field: reference

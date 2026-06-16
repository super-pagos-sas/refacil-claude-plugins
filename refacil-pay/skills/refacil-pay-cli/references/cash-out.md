---
flow: cash-out
description: "Enviar fondos hacia llave Bre-B. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: verificar saldo → generar token transaccional (tipo retiro) → ejecutar retiro. Entrega siempre el recurso al usuario antes de revisar el webhook o el estado."
---

# Flow: cash-out

Enviar fondos hacia llave Bre-B. Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: verificar saldo → generar token transaccional (tipo retiro) → ejecutar retiro. Entrega siempre el recurso al usuario antes de revisar el webhook o el estado.


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
> 3. **Reply to the user right away with the resource**. Do **NOT** wait for the callback before replying.
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

### Step 1: Consultar saldo disponible

```bash
refacil-pay-cli balance --json
```

### Step 2: Generar token transaccional (retiro)

```bash
refacil-pay-cli trx-token-withdraw --json
```

### Step 3: Ejecutar retiro
This endpoint allows you to **generate withdrawal (cash-out) requests** through the available payout methods.

---

### 💡 Overview

The table below lists the available payout methods along with their corresponding IDs and brief descriptions.

| **Method ID** | **Description** |
| --- | --- |
| `264` | Cash-out via **Bre-B** |

> ⚠ **Note:**  
Each withdrawal method requires a specific object structure within the `"withdrawMethod"` field, as shown below. 
  

---

## 🧩 Payout Method Details

### **Bre-B**

``` json
"withdrawMethod": {
  "id": 264,
  "key": "@REPRUEBAL7717"
}

 ```

**Description:**  
Transfers funds directly to a Bre-B account using the beneficiary’s unique Bre-B key.

> 💡 **Tip:**  
The `key` field must contain a valid Bre-B account alias in the format `@USERNAME`. 
  

---

## 📥 Request Body Parameters

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| `amount` | number | ✅ | Amount to be withdrawn. |
| `reference1` | string | ✅ | Unique transaction reference generated by the client (max 20 characters). |
| `webhookRequest` | string | ✅ | Customer’s webhook URL to receive real-time withdrawal status updates. |
| `userMetadata` | object | ✅ | Object containing metadata related to the origin of the transaction. |
| `userMetadata.identifier` | string | ✅ | Identifier for the user or merchant initiating the transaction. |
| `userMetadata.ip` | string | ✅ | IP address from which the transaction was initiated. |
| `userMetadata.urlCommerce` | string | ✅ | Commerce or customer’s URL associated with the transaction. |
| `withdrawMethod` | object | ✅ | Object specifying the withdrawal method and destination details. |
| `withdrawMethod.id` | number | ✅ | ID of the selected payout method (see table above). |
| `withdrawMethod.key` | string | Conditional | Required for **Bre-B** withdrawals. |
| `withdrawMethod.bankName` | string | ❌ | Optional bank name, if applicable for future payout methods. |

---

> **Before building the payment method payload**, query the available features/characteristics to obtain the required sub-selection values:
>
> ```bash
> refacil-pay-cli payment-features --id <productId>
> ```
>
> Use the returned values to populate the payment method fields in the step below.

```bash
refacil-pay-cli cash-out-withdraw --amount <amount> --webhook-request <webhook-request> --withdraw-method @withdraw-method.json --user-metadata @user-metadata.json --json
```
**Required flags:**
- `--amount` (number) — Field: amount
- `--webhook-request` (string) — Field: webhookRequest
- `--withdraw-method` (object) — Field: withdrawMethod — JSON; prefer `--withdraw-method @withdraw-method.json` (see **Argument format**). Example: `{"id":264,"key":"@REPRUEBAL7717"}`
- `--user-metadata` (object) — Field: userMetadata — JSON; prefer `--user-metadata @user-metadata.json` (see **Argument format**). Example: `{"identifier":"1234567890","ip":"127.0.0.1","urlCommerce":"https://url-tucomercio.com"}`

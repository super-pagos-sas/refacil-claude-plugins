---
flow: cash-in-method
description: "Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado."
---

# Flow: cash-in-method

Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.


## Recolección de datos — qué preguntar

Gather this flow's inputs **conversationally**, applying the communication style from SKILL.md (*Talking to the user*):

- Translate every required input in the **Steps** below into a plain, business-language question — never show the flag name, its type, or the JSON shape to the user.
- Ask **only for what is still missing** from the conversation; never re-ask a value the user already provided. Group closely related fields into one question and keep it short.
- Mention optional inputs briefly and let the user skip them (the CLI falls back to its default or leaves them out).
- For a read-only lookup (balance, status) just ask for the single identifier it needs, if any.
- Once you have everything: for a dangerous (money/irreversible) step, restate a plain-language summary (amount, recipient, method) and get an explicit confirmation **before** running it; then deliver the generated resource to the user right away (see the deliver-first / webhook guidance below).

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
> 1. **Run the create command detached, redirecting its output to a log file and capturing its PID** so the tunnel never blocks the conversation. **Never run it in the foreground.** bash: `refacil-pay-cli <cmd> --webhook-local --json > webhook.log 2>&1 & echo $! > webhook.pid`; Windows PowerShell: `$p = Start-Process powershell -ArgumentList "-NoProfile","-NonInteractive","-Command","& { refacil-pay-cli <cmd> --webhook-local --json *>&1 | Out-File -FilePath webhook.log -Encoding utf8 }" -WorkingDirectory '<your-workspace-dir>' -PassThru -WindowStyle Hidden; $p.Id | Set-Content webhook.pid` (or prefer your harness's background-run option — see *Running long commands in the background* in SKILL.md).
> 2. **Read the generated resource from the command's immediate output** (run it with `--json` and parse the URL / QR and reference from the response).
> 3. **Reply to the user right away with the resource**, and offer to send it via WhatsApp (see the *Envio por WhatsApp* section above). Do **NOT** wait for the callback before replying.
> 4. **Only afterwards** — to notify the user the moment the payment lands — as a **separate** step, **wait for the background process to exit**: it closes itself as soon as a valid payment callback arrives, so waiting on the process (not a fixed `sleep`) unblocks within seconds of the payment. The instant it exits, read `webhook.log` and tell the user. e.g. bash: `while kill -0 $(cat webhook.pid) 2>/dev/null; do sleep 3; done; cat webhook.log` (cap it at ~8 min); PowerShell: poll `Get-Process -Id (Get-Content webhook.pid) -ErrorAction SilentlyContinue` until it returns nothing, then read the log. **If your harness can notify you when a background process finishes, use that instead of polling.** Checking the webhook is **never** a prerequisite for replying with the resource (step 3); never withhold the resource while waiting. (Alternatively, confirm on demand with the status step below.)
>
> **`--webhook-local` requires a real detached background process. If you do NOT have one** (your harness has no background execution, or the powershell background command is unavailable or failed) — **do NOT use `--webhook-local`**. Instead: create the resource with `--webhook-url <url>` (or with no webhook flag), reply with the resource immediately, and confirm the payment on demand with `refacil-pay-cli payment-status --reference <ref> --json`. This is the safe default — **never use `--webhook-local` when background execution is uncertain or failed**.

### Post-create checklist (`--webhook-local`) — DO NOT SKIP ANY STEP

After a create command with `--webhook-local`, tick **every** box, **in order** — do not stop early just because the resource was created:

- [ ] **1. Reply to the user with the generated resource** (URL/QR + reference) — parse it from the `--json` output.
- [ ] **2. Start the wait/poll loop** for the background process to exit (it closes on the first valid payment callback).
- [ ] **3. Read `webhook.log`** once the process exits.
- [ ] **4. Validate against the API** — `refacil-pay-cli payment-status --reference <ref> --json`; confirm the real state, never trust the callback alone.
- [ ] **5. Notify the user** of the confirmed payment result.

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

Some flags are **JSON** — type `object` or `array`, marked per flag in the **Steps** below. JSON over the shell is where agents waste the most time (quoting, escaping, encoding). Follow this exactly and you will get it right on the **first** try — do not trial-and-error.

### Method 1 — write the file with YOUR file-writing tool (DEFAULT — use this)

Do **not** build the JSON through the shell. Use your own file-creation/editing tool (the same one you use to write source files) to create `payload.json`. It writes clean UTF-8 with **no BOM** and **no shell quoting**, which removes both classes of failure at once.

1. Write the JSON object/array to `payload.json` with your file tool.
2. Pass it by path (the `@` prefix tells the CLI to read+parse the file):
   ```bash
   refacil-pay-cli <command> --<field> @payload.json
   ```
   > **PowerShell:** quote any argument that starts with `@` — write `'@payload.json'` (single quotes), because a bare `@…` is read as PowerShell's splatting operator. (bash/sh: `@payload.json` unquoted is fine.)
3. **Delete the temp file once the command finishes** (success or failure) — these payloads hold sensitive data (identifiers, IPs, customer/commerce info) and must not be left on disk. Use your file tool, or `rm -f payload.json` (bash) / `Remove-Item payload.json -Force` (PowerShell).

### Method 2 — stdin via `@-` (bash/sh only; no file to clean up)

```bash
echo '{"key":"value"}' | refacil-pay-cli <command> --<field> @-
```

Use this only in **bash/sh**. Do not use it from PowerShell — its `echo` and pipeline encoding behave differently and corrupt the payload.

### What NOT to do

- **Do NOT** generate the JSON file with shell redirection. In particular `Set-Content`/`Out-File -Encoding utf8` on **Windows PowerShell 5.1 writes a UTF-8 BOM** that has historically broken JSON parsing — Method 1 avoids it entirely. (This CLI now strips a leading BOM defensively, but don't rely on it: prefer Method 1.)
- **Do NOT** mix shells — never call a PowerShell cmdlet (`Out-File`, `Set-Content`) inside a bash command, or use `>`/`printf` redirection inside PowerShell.
- **Do NOT** split a JSON field into loose key/value flags.
- **Avoid inline JSON** (`--<field> '{"key":"value"}'`): one command, no file, but the quoting is shell-specific and the #1 source of failures on PowerShell. Use Method 1 instead.

The `@` prefix (and `@-`) is interpreted only for object/array fields.

## Reading command output

**Always run commands with `--json` when you need to read fields from the response** (URL, reference, transaction id, status, etc.). The default output is a human-readable table meant for showing to the user; it can collapse nested objects to `[object Object]` and hide the very field you need. The step commands below already include `--json` for this reason.

- Parse the JSON the command prints on stdout and extract the fields you need (e.g. `data.url`, `data.reference`).
- The API wraps results in a status envelope — a `statusCode` of `00` (or an explicit success message) indicates success; read the resource fields from the nested data object, not from the top level.
- Only present the human-readable form to the user; never rely on the table to extract a value programmatically.

## Steps

### Step 1: Generar token transaccional (método de pago)

```bash
refacil-pay-cli trx-token-method --json
```

### Step 2: Activar método de pago directo
This endpoint allows you to **generate payment requests** through the available _cash-in_ methods.

---

### 💡 Overview

The table below lists the available payment methods along with their corresponding IDs and **minimum expiration times** (`expiresIn`) required when creating a payment request.

| **Method ID** | **Description** | **Minimum Expiration (seconds)** |
| --- | --- | --- |
| `130` | Cash-in via **Nequi** | 43,200 |
| `131` | Cash-in via **Daviplata** | 43,200 |
| `117` | Cash-in via **PSE** | 1,800 |
| `262` | Cash-in via **PSE Gateway** | 1,800 |
| `153` | Cash-in via **Recaudo Efectivo** | 86,400 |
| `163` | Cash-in via **TPaga** | 43,200 |
| `248` | Cash-in via **QR Interoperable** | N/A |
| `250` | Cash-in via **Llaves Bre-B** | N/A |
| `273` | Cash-in via **Tarjetas** (Débito y Crédito) | 3,600 |
| `277` | Cash-in via **Whatsapp** | 2,592,000 |

> ⚠ **Important:**  
The value provided in the expiresIn field **must be greater than or equal** to the minimum expiration defined for the selected payment method.  
> For **QR Interoperable (ID 248)**, the `expiresIn` parameter **must be omitted**. If provided, the system will **ignore it automatically**. The resource expiration is managed internally by the provider and is set to the **end of the same day the resource is generated**.  
> For **Llaves Dinámicas Bre-B (ID 250)**, the `expiresIn` parameter **must be omitted**. If provided, the system will **ignore it automatically**. The key has a **fixed validity period of 10 minutes** from the moment of creation, determined by the server configuration. 
  

---

## 🧩 Payment Method Details

Each payment method requires a specific object structure within the `"paymentMethod"` field.

---

### **Nequi**

``` json
"paymentMethod": {
  "id": 130,
  "cellphone": "3105293225"
}

 ```

---

### **Daviplata**

``` json
"paymentMethod": {
  "id": 131,
  "cellphone": "3208385715"
}

 ```

---

### **PSE**

For this payment method, depending on the `typePerson` selected, only specific document types are accepted:

- **`typePerson`****:** **`"0"`** → corresponds to a **Natural Person** and only accepts the following values for `documentType`:
    
    - `RCN`
        
    - `TI`
        
    - `CC`
        
    - `TE`
        
    - `CE`
        
    - `PA`
        
    - `DIE`
        
- **`typePerson`****:** **`"1"`** → corresponds to a **Legal Person** and only accepts the following value for `documentType`:
    
    - `NIT`
        

``` json
"paymentMethod": {
  "id": 117,
  "documentType": "CC",
  "typePerson": "0",
  "bankId": "string",
  "documentNumber": "string",
  "name": "string",
  "cellphone": "string",
  "address": "string",
  "email": "string"
}

 ```

---

### **PSE Gateway**

This payment method enables direct integration with the PSE network for processing online bank payments.  
To consume this product, it is required to have the following parameters previously configured and associated with your product:

- `entity_code`
    
- `service_code`
    
- `company_ciiu`
    
- `company_name`
    

These parameters identify your company within the PSE network and are necessary for successful transaction routing and validation.

> 💬 **For more information or to request these credentials, please contact the support team.** 
  

This method follows **the same structure and validation rules** as **PSE**, but must use the following identifier:

``` json
"paymentMethod": {
  "id": 262,
  "documentType": "CC",
  "typePerson": "0",
  "bankId": "string",
  "documentNumber": "string",
  "name": "string",
  "cellphone": "string",
  "address": "string",
  "email": "string"
}

 ```

The **PSE integration** relies heavily on the correct configuration of the `showSummary` and `returnUrl` parameters.  
These parameters control the **user experience** and the **finalization flow** of the payment process.

| Scenario | `showSummary` | `returnUrl` | Flow Description |
| --- | --- | --- | --- |
| **1\. Standard Redirect (Default)** | `true` or not sent | ✅ Present | Displays a transaction summary screen with key payment details and retrieves the final transaction status. After the payment is completed, the user is redirected to the specified `returnUrl`. |
| **2\. Without Transaction Summary Screen** | `false` | ✅ Present | Skips the transaction summary screen and redirects the user directly to the `returnUrl`. In this case, the merchant’s system must display the transaction summary on the destination page. |

> ⚠️ **Note:**  
For **PSE** and **PSE Gateway**, it is **strongly recommended** to use `showSummary: true` along with a valid `returnUrl` to ensure a seamless customer experience and accurate transaction tracking. 
  
> 🔗 **See also:** 
  

- [Transaction Summary](https://documenter.getpostman.com/view/35146358/2sA3QpDEFA#45e0d76a-fabd-442e-9b17-e2f6b8354ec5)
    
- [Transaction Status](https://documenter.getpostman.com/view/35146358/2sA3QpDEFA#dd3ba9f5-1f10-4109-b59d-6e5aad5e3799)
    

---

### **Recaudo Efectivo**

``` json
"paymentMethod": {
  "id": 153
}

 ```

---

### **TPaga**

This payment method supports an optional parameter called `isQr`, which determines the type of resource returned in the `url` field:

| **Value** | **Description** |
| --- | --- |
| `true` | The `url` field returns a link to a **QR code** displaying transaction details. |
| `false` | The `url` field returns a **deeplink** to open directly in the TPAGA wallet app. |

> 🧠 **Behavior:**  
If `isQr` is not provided, the default behavior is equivalent to `isQr: false`.  
Transactions can only be completed **from a mobile device**.  
If the request is made from a desktop or tablet, it is recommended to send `isQr: true` so the user can scan the QR from a mobile device. 
  

``` json
"paymentMethod": {
  "id": 163,
  "isQr": false
}

 ```

---

### **QR Interoperable**

For this method, the following fields are **optional**:

- `cellphone`
    
- `documentNumber`
    
- `documentType`
    
- `merchantId`
    

The service can function using only the payment method ID; however, providing these optional fields can **improve response time**.  
You may retrieve this data through the `enrollment-data` service in the [Merchant Enrollment](https://documenter.getpostman.com/view/35146358/2sA3QpDEFA#8c9f5a18-a19a-4b8f-baba-cd7501aa29a0) section.

> ⚠ **Prerequisite:**  
The merchant must complete the **Merchant Enrollment** process before using this method.  
See the _Merchant Enrollment_ section for setup details. 
  
> 🔁 **Open Resource:**  
The **QR Interoperable** operates as an _open resource_, meaning the generated QR can be used multiple times by the same user. 
  
> ⚙️ **Technical Note — Dynamic QR Behavior:**  
Dynamic QR codes may be scanned multiple times due to current limitations in the Redeban system.  
This is **not** an error in our platform. 
  
> 🕐 **Expiration Behavior:**  
The `expiresIn` parameter **does not apply** to this payment method and should be **omitted** from the request.  
If a value is sent, the system will **ignore it automatically**.  
The QR resource expiration is controlled exclusively by the provider (Redeban) and is always set to the **end of the day on which the resource is generated** (23:59:59 America/Bogota). 
  

#### Behavior Details

- Redeban does not automatically invalidate a dynamic QR after its first scan.
    
- As a result, the same QR may generate multiple transaction records.
    

#### Recommendations

- Implement **application-level validation** to detect multiple payments from the same QR code.
    
- Monitor dynamic QR transactions and confirm status before marking payments as completed.
    
- Inform end-users to verify the success of a transaction before rescanning.
    

#### Future Considerations

- Redeban is evaluating support for **single-use dynamic QR control**.
    
- Stay updated with interoperability provider announcements to adjust integrations accordingly.
    

``` json
"paymentMethod": {
  "id": 248,
  "cellphone": "string",
  "documentType": "string",
  "documentNumber": "string",
  "merchantId": "string"
}

 ```

---

### **Llaves** Dinámicas **Bre-B**

For this method, the following fields are **required**:

- `cellphone`
    
- `docNumber`
    
- `docType`
    
- `merchantId`
    

You may retrieve this data through the `enrollment-data` service in the [Merchant Enrollment](https://documenter.getpostman.com/view/35146358/2sA3QpDEFA#8c9f5a18-a19a-4b8f-baba-cd7501aa29a0) section.

> ⚠ **Prerequisite:**  
The merchant must complete the **Merchant Enrollment** process before using this method.  
See the _Merchant Enrollment_ section for setup details. 
  
> 🔁 **Open Resource:**  
The **Llaves Dinamicas Bre-B** operates as an _open resource_, meaning the generated KEY can be used multiple times by the same user. 
  
> ⚙️ **Technical Note — Dynamic Key Behavior:**  
Dynamic keys may receive multiple money transfers due to current limitations in the Redeban system.  
This behavior does not represent an error or malfunction in our platform.  
**Additionally, dynamic keys have a fixed validity period of 10 minutes, and this duration cannot be modified.** 
  

#### Behavior Details

- Redeban does not automatically invalidate a dynamic KEY after its first send.
    
- As a result, the same KEY may generate multiple transaction records.
    

#### Recommendations

- Implement **application-level validation** to detect multiple payments from the same KEY.
    
- Monitor dynamic KEY transactions and confirm status before marking payments as completed.
    
- Inform end-users to verify the success of a transaction before rescanning.
    

#### Future Considerations

- Stay updated with interoperability provider announcements to adjust integrations accordingly.
    

``` json
"paymentMethod": {
  "id": 250,
  "cellphone": "string",
  "docType": "string",
  "docNumber": "string",
  "merchantId": "string"
}

 ```

---

### **Card Payments**

This payment method allows processing payments with debit and credit cards (Mastercard and Visa).

For this method, the following fields are **required**:

- `id`: 273
    
- `description`: Description of the payment detail that will be displayed in the payment link
    

#### PaymentMethod Parameters

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| `id` | number | ✅ | Payment method ID: 273 |
| `description` | string | ✅ | Description of the payment detail that will be displayed in the payment link. Maximum 255 characters. |

``` json
"paymentMethod": {
  "id": 273,
  "description": "string"
}

 ```

---

### **Whatsapp**

For this method, the following fields are **required**:

- `cellphone`
    
- `whatsappAccountId`
    

For this method, the following fields are **optional**:

- `pdfUrl` (must use HTTPS; resource must be publicly accessible without authentication; referenced file must be a valid PDF and not exceed 100 MB)
    
- `templateName`
    

> **Note:** By default, collection messages are sent from Refacil's WhatsApp line.  
> To send them from your own line, you must first link your WhatsApp account in the administrative portal and obtain the corresponding `whatsappAccountId`.  
> Once linked, collection messages will be sent from the client's WhatsApp line.

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| `id` | number | ✅ | Payment method ID: 277 |
| `cellphone` | string | ✅ | Customer phone number in local or international format. |
| `pdfUrl` | string | ❌ | Public HTTPS URL to the PDF document to be delivered via WhatsApp. |
| `whatsappAccountId` | string | ✅ | Identifier of the linked WhatsApp account configured in the administrative portal. |
| `templateName` | string | ❌ | Optional template name configured for WhatsApp message delivery. |

``` json
"paymentMethod": {
  "id": 277,
  "cellphone": "string",
  "pdfUrl": "string",
  "whatsappAccountId": "string",
  "templateName": "string"
}

 ```

📥 Request Body Parameters

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| `amount` | number | ✅ | Value of the payment. |
| `brandId` | number | ❌ | ID of the customer's white label; if one is not available, the default ID 79 is sent. |
| `expiresIn` | number | ❌ | Time in seconds for the expiration of the resource or payment link. Not applicable for **QR Interoperable (ID 248)** and **Llaves Dinámicas Bre-B (ID 250)** — if provided, the system ignores it. For QR Interoperable, expiration is set to end of day; for Llaves Dinámicas Bre-B, expiration is always 10 minutes from creation. |
| `paymentMethod` | object | ✅ | Object specifying the payment method and its details. |
| `paymentMethod.id` | number | ✅ | ID of the selected payment method (see available payment methods). |
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

> **Before building the payment method payload**, query the available features/characteristics to obtain the required sub-selection values:
>
> ```bash
> refacil-pay-cli payment-features --id <productId>
> ```
>
> Use the returned values to populate the payment method fields in the step below.

> **Collect the payer's data before building `paymentMethod` — do NOT invent it, but ask only for what is the payer's own.**
> - **Ask the user** (in plain language) for the payer's personal fields — e.g. PSE: `name`, `documentNumber`, `email`, `cellphone`, `address`, and whether they are a natural or legal person. In **production** these are a real customer's data.
> - **Do NOT ask the user for catalog ids.** Resolve `bankId` from `refacil-pay-cli payment-features --id <productId>` — ask the human question ("which bank?") and map the answer to its id yourself; never ask the user for a numeric `bankId`. Likewise, map the document type from the user's answer to the code the method expects (see the per-method structures above); do not ask for a "documentType id".
> - Only `userMetadata.ip` is auto-filled.

```bash
refacil-pay-cli cash-in-payment-method --payment-method @payment-method.json --user-metadata @user-metadata.json --amount <amount> --json
```
**Required flags:**
- `--payment-method` (object) — Field: paymentMethod — JSON; prefer `--payment-method @payment-method.json` (see **Argument format**). Example: `{"id":155,"cellphone":"3051000002"}`
- `--user-metadata` (object) — Field: userMetadata — JSON; prefer `--user-metadata @user-metadata.json` (see **Argument format**). Example: `{"ip":"1.2.3.2","identifier":"123467hyujikolpñmnaafsddssd","urlCommerce":"https://url-tucomercio.com"}`
- `--amount` (number) — Field: amount

> **WhatsApp send:** After parsing the `--json` response above to obtain the resource URL and amount, offer to send it via WhatsApp. Use `--command-key cash-in.payment-method` exactly (this selects the configured template and label for this step) and **do not add `--message`** unless the user explicitly asks for custom wording:
> ```bash
> refacil-pay-cli whatsapp send --to <e164> --command-key cash-in.payment-method --url <resourceUrl> --amount <amount>
> ```
> See the **Envio por WhatsApp** section above for full instructions.

### Step 3: Verificar estado del pago
This service allows you to check the status of a transaction made, for this you must have the _reference_ data that returned the response when generating any payment resource.

In the response you will get the _status_ _id_ which will mean the following

0 - Transaction Rejected

1 - Pending Transaction

2 - Transaction Approved

3 - Failed Transaction

5 - Transaction Cancelled

9 - Processing Transaction

Headers

| **Name** | **Value** |
| --- | --- |
| Content-Type | application/json |
| Authorization | Bearer |

Body

| Name | Type | Description |
| --- | --- | --- |
| `reference`\* | string | Product reference |

```bash
refacil-pay-cli payment-status --reference <reference> --json
```
**Required flags:**
- `--reference` (string) — Field: reference

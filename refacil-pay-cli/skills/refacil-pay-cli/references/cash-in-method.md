---
flow: cash-in-method
description: "Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado."
---

# Flow: cash-in-method

Cobrar al cliente mediante método de pago directo (PSE, tarjeta, etc.). Prerequisito: sesión activa — ejecutar `refacil-pay-cli login` si no hay credenciales guardadas. Flujo: generar token transaccional (tipo método) → activar método de pago → verificar estado. Entrega siempre el recurso al usuario y ofrece enviarlo por WhatsApp antes de revisar el webhook o el estado.


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
`cloudflared` is an **external binary this CLI does NOT bundle or auto-install**. Before running any step with `--webhook-local`:

1. **Verify it is installed** — run `cloudflared --version`.
2. **If it is missing, STOP — do NOT run the command** (it would fail, and a misconfigured run could send an invalid webhook URL). Tell the user and offer one of:
   - Install `cloudflared` with a manager that sets PATH for you (avoids the issue below): Windows → `scoop install cloudflared` (no admin) or `choco install cloudflared` · macOS → `brew install cloudflared` · Linux → distro package or download into a dir on PATH (e.g. `/usr/local/bin`). Cloudflare downloads: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - **`winget install cloudflare.cloudflared` works but often does NOT add it to PATH** (portable shims need Developer Mode/restart). If you used winget and `cloudflared --version` fails, either add its folder to PATH and **restart the terminal/IDE** (so the new PATH is inherited), or point the CLI straight at the binary via the `CLOUDFLARED_BIN` env var set to the full path of `cloudflared.exe`.
   - **Or** switch to the zero-install provider: `refacil-pay-cli config set-webhook-provider localtunnel`
3. **Only continue once the user confirms** the binary is reachable (installed and on PATH, or `CLOUDFLARED_BIN` set, or switched providers). Do not auto-install anything; do not proceed with `--webhook-local` while the provider is unavailable.

> **⚠ Delivery order — `--webhook-local` blocks; always hand over the resource FIRST.** When `--webhook-local` is used, the create command prints the generated resource (its URL / QR and reference) and **then keeps running until the first callback arrives** — at which point it prints the callback and **closes by itself** — or until it times out (~8 min) with no callback. Do **NOT** wait on that callback before responding to the user. Always follow this order:
>
> 1. Read the generated resource from the command's **immediate** output (run it with `--json` and parse the URL / QR and reference from the response).
> 2. **Present the resource to the user** and **offer to send it via WhatsApp** (see the *Envio por WhatsApp* section above).
> 3. **Only after** the resource has been delivered, look at the webhook output for the incoming callback (or use the status step below to confirm the payment).
>
> Practically: run the create command in the background so the tunnel does not block the conversation, surface the printed resource right away, and let the process finish on its own — it terminates as soon as the first notification arrives, so you can then read the callback from its output. Never withhold the generated resource from the user while waiting on the webhook.

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
refacil-pay-cli cash-in-payment-method --payment-method @payment-method.json --user-metadata @user-metadata.json --amount <amount> --webhook-url <webhook-url> --json
```
**Required flags:**
- `--payment-method` (object) — Field: paymentMethod — JSON; prefer `--payment-method @payment-method.json` (see **Argument format**). Example: `{"id":155,"cellphone":"3051000002"}`
- `--user-metadata` (object) — Field: userMetadata — JSON; prefer `--user-metadata @user-metadata.json` (see **Argument format**). Example: `{"ip":"1.2.3.2","identifier":"123467hyujikolpñmnaafsddssd","urlCommerce":"https://url-tucomercio.com"}`
- `--amount` (number) — Field: amount
- `--webhook-url` (string) — Field: webhookUrl

> **WhatsApp send:** After parsing the `--json` response above to obtain the resource URL and amount, offer to send it via WhatsApp. Use `--command-key cash-in.payment-method` exactly (this selects the configured template and label for this step) and **do not add `--message`** unless the user explicitly asks for custom wording:
> ```bash
> refacil-pay-cli whatsapp send --to <e164> --command-key cash-in.payment-method --url <resourceUrl> --amount <amount>
> ```
> See the **Envio por WhatsApp** section above for full instructions.

### Step 3: Verificar estado del pago

```bash
refacil-pay-cli payment-status --reference <reference> --json
```
**Required flags:**
- `--reference` (string) — Field: reference

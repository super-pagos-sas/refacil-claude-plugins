---
env: headless
---

# Refácil Pay CLI — Headless Environment (Device Grant)

Use this file when you are in an **isolated/headless environment** where no browser can open and no localhost callback is reachable (Codex cloud sandbox, CI, SSH-only host, etc.).

> **Security rule**: The agent **never** creates an account on behalf of the user and **never** chooses the user's password. The user enters credentials on the device verification page. The account belongs to the user.

## Authentication (Device Authorization Grant — RFC 8628)

### Step 1 — Check for an active session

```
refacil-pay-cli whoami --json
```

If `authenticated: true`, skip to the task. Otherwise proceed to Step 2.

### Step 2 — Register (if needed) then log in with Device Grant (run it in the background)

> **You (the agent) run this command yourself** — do **NOT** ask the user to run it in their terminal, and do **NOT** open the browser yourself. **When a session expires, re-run it yourself.**
>
> ⚠️ **`login --device` is long-running and blocks.** It prints a `verification_uri` + `user_code`, then polls the server for up to ~5 minutes waiting for the user to authorize. **NEVER run `refacil-pay-cli login --device` in a blocking foreground call** — your tool's command timeout would kill it mid-poll and the login would never complete. Run it in the background and keep it alive.

**Ask the user: "Do you already have a Refácil Pay account?"**

**If they do NOT have an account — register first (one-time precondition):**

```
refacil-pay-cli register --no-color
```

**Important notes:**
- The command prints the sign-up URL to stdout — **capture and relay it to the user**:
  > *"Please open this URL to create your Refácil Pay account: [URL from output]. Tell me when you are done."*
- The command exits with **exit 0** even though it does not open any browser on this device. **Do not interpret exit 0 as confirmation that the user already has an account.** Always relay the URL and wait for the user to confirm they completed registration.
- Expected sign-up URL (sandbox): https://autoregistro.qa.refacilpay.co/
- Expected sign-up URL (prod): https://autoregistro.refacilpay.co/

> **Important**: `register --no-color` does **not** authenticate you — it only prints the sign-up URL. Once the user confirms their account is created, continue to the **Login step** below. Do **not** run `whoami` or poll for session here — you must run the device grant login first.

**Login step — both branches converge here** (after registering, or if the user already had an account):

> **Auth flow rule**: Use `refacil-pay-cli login --device` (device grant) **only** in this environment. Do **not** switch to plain `login` (loopback) — there is no local browser or `127.0.0.1` callback here.

**1. Start the device flow in the background** — use **your harness's background / non-blocking run option** so the command's output (the `verification_uri` / `user_code`) can be captured and relayed. It must be a **real, persistent background process** that stays alive until the user authorizes: **this process is the only thing that completes the login** (it polls the backend, stores the token, then exits). bash/Linux/macOS: append `&` as shown. **On Windows: launch it with your harness's Bash-tool background option (`run_in_background: true`, or `... &`) — NOT a PowerShell background (`Start-Process`, `Start-Job`).** A PowerShell-launched background process can **die before the device polling receives the token from the server** (confirmed empirically — the Bash-tool background keeps it alive, the PowerShell one does not), so the login silently never completes even though everything looked right. Likewise **do NOT launch it inside a sub-agent / Task tool** — a sub-agent that gets cancelled kills the device process, so after the user authorizes nothing stores the token and you would poll `whoami` forever ("stuck thinking"). Use a real, surviving background process so the output is accessible (see *Running long commands in the background* in SKILL.md). Then read the codes it prints:

```bash
refacil-pay-cli login --device --env <sandbox|prod> > device-login.log 2>&1 &

# wait a few seconds for the device-code response, then read it
sleep 5 && cat device-login.log   # bash — Windows PowerShell: Start-Sleep 5; Get-Content device-login.log
```

> ⚠️ **Read that output file IMMEDIATELY (after ~5s) — do NOT wait for the background process to finish, and do NOT wait for a "task completed / process exited" notification before reading.** The process keeps polling until the user authorizes, so it will **not** exit until *after* they enter the code — and the `user_code` **expires in ~5 minutes**. If you wait for completion first, that notification only arrives once the code has **already expired** and the login fails ("session still not active"). The order is strict: **launch → wait ~5s → read the log → relay (step 2) → and only THEN poll/wait for completion (step 3).**

**2. Relay the authorization to the user** (do not open the browser yourself). **Always prefer the direct link**: the `(Or open directly: …)` line the command prints is a URL with the `user_code` already embedded, so the user just opens it and confirms — no manual code typing (easiest path). Include the manual fallback (the `Visit:` URL + `Enter code:`) only as a backup in case that direct line is absent:

> *"Open this link to authorize — it already includes your code: **[verification_uri_complete]**. If it doesn't open, go to **[verification_uri]** and enter the code **[user_code]**. Tell me when you are done."*

**3. Wait for the login to complete, then confirm** (allow up to ~5 minutes — the `login --device` process **exits the moment the user authorizes**, storing the token and printing "Device authorization complete"):

- **Preferred — wait for the background process to finish.** If your harness notifies you when a background process exits (or you can wait on the process you started in step 1), just wait for it; the instant it finishes, run `refacil-pay-cli whoami --json` **once** to confirm `authenticated: true`. This is the cleanest path and avoids the agent looking "stuck thinking" on a busy loop.
- **Fallback — poll `whoami` in a loop** (only if your harness gives no completion signal). Check **continuously until `authenticated: true`, not just once**, using a correct loop — do **not** hand-roll `DateTime` math (`Get-Date - $start` is a parser error in PowerShell, and the broken expression silently turns the poll into an infinite wait even after login already succeeded):

```bash
for i in $(seq 1 60); do sleep 5; refacil-pay-cli whoami --json 2>/dev/null | grep -q '"authenticated": *true' && { echo authenticated; break; }; done
```
```powershell
$deadline = (Get-Date).AddMinutes(5)
do { Start-Sleep -Seconds 5; $o = refacil-pay-cli whoami --json 2>$null | ConvertFrom-Json; if ($o.authenticated) { 'authenticated'; break } } while ((Get-Date) -lt $deadline)
```

> If `whoami` never turns `authenticated: true` after the user confirms they approved, the **background device process from step 1 is no longer running** (it was killed / cancelled / never truly backgrounded) — re-run step 1 as a real persistent process, relay the new code, and wait again. Polling `whoami` cannot complete the login on its own; only the live `login --device` process stores the token.

When `authenticated: true`, login is done — continue with the task.

If it is still not authenticated after the ~5-minute polling window, ask the user to complete the authorization, then **re-run the device grant login step only** (start `refacil-pay-cli login --device` in the background again). Do **not** re-run `register` — that is a one-time precondition and does not need to be repeated. After 2 failed login attempts, tell the user what happened and stop — never loop.

> **Session inspection**: `refacil-pay-cli whoami --json` exposes `tokenSource` — where the active token came from: `"keychain"`, `"file"`, or `"flag"` — and `keychainAvailable` (`false` when the token is stored in a file instead of the OS keychain).

> **Security**: The agent **never** runs `login --console`.

## Environment

```
refacil-pay-cli config set-environment <sandbox|prod>
```

Use **sandbox** for all tests and development. Use **prod** only for real client transactions.

## Webhook Configuration (headless environment)

### Sandbox — tunnel or polling

**Option A: Tunnel (sandbox only)**

> ⚠️ **The tunnel is a long-running process — run it in the background and keep it alive**, never synchronously (your tool's command timeout would kill it and webhooks would stop arriving). Start it in the background from a reachable host (prefer your harness's background-run option; bash/Linux/macOS: append `&` as shown; Windows PowerShell: see *Running long commands in the background* in SKILL.md), read its public URL from the output, then register that URL:

```bash
# start your tunnel provider in the background, then read its public URL
your-tunnel-provider > tunnel.log 2>&1 &
sleep 5 && cat tunnel.log   # bash — Windows PowerShell: Start-Sleep 5; Get-Content tunnel.log

refacil-pay-cli user-webhooks-post --webhook-url <tunnel-url>/webhook --env sandbox
refacil-pay-cli user-webhooks-get --env sandbox --json
```

> Tunnels are for sandbox only. Never use a tunnel as a production webhook.

**Option B: Polling (no tunnel required)**

If a tunnel is not available, poll for payment confirmation:

```
refacil-pay-cli payment-status --reference <ref> --env sandbox --json
```

Or trigger a test notification:

```
refacil-pay-cli webhook-notify --reference <ref> --env sandbox
```

### Prod — public URL required

In prod, a stable public URL is required. Provide it to the user and ask them to configure it:

```
refacil-pay-cli user-webhooks-post --webhook-url https://<your-public-domain>/webhook --env prod
refacil-pay-cli user-webhooks-get --env prod --json
```

### Manage webhook status

To activate or deactivate a backup webhook:

```
refacil-pay-cli user-webhooks-id-status --id <webhook-id> --active <true|false>
```

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

### Step 2 — Register (if needed) then log in with Device Grant (two steps: start, then redeem)

> **You (the agent) run these commands yourself** — do **NOT** ask the user to run them in their terminal, and do **NOT** open the browser yourself. **When a session expires, re-run them yourself.**
>
> ✅ **The device login is split into two short, non-blocking commands** so it works even in agent hosts that lose context between turns (Claude Desktop, Cowork): `login --device` requests + **persists** the code to disk and **exits immediately** (it does NOT poll, does NOT block, needs NO background process); later, after the user authorizes, `login --device --redeem` canjea the token from that saved code. The redeem step does not depend on the start process still being alive.

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

**1. Start the device flow (foreground, returns instantly).** Run it normally — **no background process, no `&`, no keep-alive needed.** In a headless/agent environment the command requests a code, **saves it to disk**, prints the `verification_uri` / `user_code`, and **exits 0 right away**. Read the codes from its output:

```bash
refacil-pay-cli login --device --env <sandbox|prod>
```

> The saved code lives until it expires (~5 minutes). Because it is on disk, the **redeem step in Step 3 does not need this command to still be running** — that is exactly what makes this work when your context/process does not survive between turns.

**2. Relay the authorization to the user** (do not open the browser yourself). **Always prefer the direct link**: the `(Or open directly: …)` line the command prints is a URL with the `user_code` already embedded, so the user just opens it and confirms — no manual code typing (easiest path). Include the manual fallback (the `Visit:` URL + `Enter code:`) only as a backup in case that direct line is absent:

> *"Open this link to authorize — it already includes your code: **[verification_uri_complete]**. If it doesn't open, go to **[verification_uri]** and enter the code **[user_code]**. Tell me when you are done."*

**3. After the user says they authorized, redeem the token** (single, non-blocking command — it polls once and reports state):

```bash
refacil-pay-cli login --device --redeem --env <sandbox|prod>
```

Interpret the result by exit code / message:
- **Success** ("Device authorization complete", exit 0) → run `refacil-pay-cli whoami --json` once to confirm `authenticated: true`, then continue with the task.
- **Still pending** ("Authorization still pending", **exit 2**) → the user has not finished approving yet. Wait a few seconds (or ask them to confirm), then run the **same `--redeem` command again**. Repeat until success or expiry — there is no long-lived process to babysit.
- **Expired / denied** (exit 1) → the code is dead. Go back to **Step 1**, start a fresh `login --device`, relay the new code, and redeem again.

> Unlike a blocking poll, `--redeem` never hangs and never needs a background process: each call is a quick check. If you lose context between the start and the redeem, just run `--redeem` again — the saved code is still on disk.

If it is still not authenticated after a few redeem attempts, ask the user to complete the authorization, then **re-run the start + redeem steps only** (`login --device`, relay, `login --device --redeem`). Do **not** re-run `register` — that is a one-time precondition and does not need to be repeated. After 2 failed login attempts, tell the user what happened and stop — never loop.

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

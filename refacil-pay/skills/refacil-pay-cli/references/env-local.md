---
env: local
---

# Refácil Pay CLI — Local Environment (Browser Auth)

Use this file when you are running on a **local desktop** where a browser can open and `127.0.0.1` callbacks are reachable (Claude Code, Cursor, OpenCode, Antigravity, etc.).

> **Security rule**: The agent **never** creates an account on behalf of the user and **never** chooses the user's password. The user creates their own account in the browser. The account belongs to the user.

## Authentication

### Step 1 — Check for an active session

```
refacil-pay-cli whoami --env <sandbox|prod> --json
```

If `authenticated: true`, skip to the task. Otherwise proceed to Step 2.

### Step 2 — Register (if needed) then log in

**First, fix the target environment** with the user — `sandbox` (tests/dev, default when unsure) or `prod` (real money) — then pass `--env <sandbox|prod>` on every `register` / `login` / `whoami` call below. Do **not** ask about the environment again later in this flow.

> **You (the agent) run these commands yourself.** `refacil-pay-cli register` and `refacil-pay-cli login` open the browser automatically when **you** execute them — do **NOT** ask the user to run them in their terminal, and do not wait for the user to do it. The user only interacts with the browser page that opens (creating the account or signing in). **When a session expires, just re-run `refacil-pay-cli login --env <sandbox|prod>` yourself** (in the foreground with a ~5 min timeout — see the ✅ note below) — do not ask the user to run it. (The only auth command the *user* runs is `refacil-pay-cli login --console` — see "Console Login" below.)

**Ask the user: "Do you already have a Refácil Pay account?"**

**If they do NOT have an account — register first (one-time precondition):**

```
refacil-pay-cli register --env <sandbox|prod>
```

This opens the sign-up page in the browser for the active environment:
- Sandbox: https://autoregistro.qa.refacilpay.co/
- Prod: https://autoregistro.refacilpay.co/

Tell the user:
> *"I just opened the Refácil Pay sign-up page in your browser — create your account there and tell me when you are done."*

> **Important**: `register` does **not** log you in — it only opens the sign-up page. Once the user confirms their account is created, continue to the **Login step** below. Do **not** proceed to `whoami` or Step 3 from here — you must log in first.

**Login step — both branches converge here** (after registering, or if the user already had an account):

Log in with OAuth 2.1 PKCE (loopback callback — most secure, the code is not transcribable):

> **Auth flow rule**: Use `refacil-pay-cli login` (loopback PKCE) **only** in this environment. **Never switch to the device grant** (`--device`) — that flow is exclusively for headless environments (see env-headless.md). If `login` doesn't complete, retry the login step (max 2, per Step 3) — do **not** switch to the device flow.

> ✅ **Run `login` directly (foreground) with a generous command timeout (~5 min). Do NOT background it, do NOT open a separate console, do NOT run it in a sub-agent.** `login` starts a `127.0.0.1` callback server, opens the browser itself, waits for the user to sign in, then returns on success and exits — your tool call simply blocks until then. Backgrounding it is what breaks: a `Start-Process` window you can't read, or a sub-agent that gets cancelled, and you never learn it finished.
>
> 1. **Run it with an explicit ~5-minute timeout** — the default 1–2 min timeout is too short and would kill the call before the user finishes signing in. (Claude Code Bash tool: `timeout: 300000`. opencode / other harnesses: set the command/exec timeout to 300s.) It opens the browser by itself; tell the user:
>    > *"I just opened the Refácil Pay login page in your browser — sign in there."*
>    ```bash
>    refacil-pay-cli login --env <sandbox|prod>
>    ```
> 2. When the command returns, login is done — confirm with `whoami` (Step 3).
>
> **Fallback — ONLY if your exec tool cannot raise its timeout to ~5 min:** start `login` with your harness's background / non-blocking run option (write its output to a **log file** — never a hidden `Start-Process` window, never a sub-agent), then poll `whoami` until `authenticated: true`. Use a correct loop — do **not** hand-roll `DateTime` math (`Get-Date - $start` is a parser error in PowerShell):
> ```bash
> for i in $(seq 1 60); do sleep 5; refacil-pay-cli whoami --env <sandbox|prod> --json 2>/dev/null | grep -q '"authenticated": *true' && { echo authenticated; break; }; done
> ```
> ```powershell
> $deadline = (Get-Date).AddMinutes(5)
> do { Start-Sleep -Seconds 5; $o = refacil-pay-cli whoami --env <sandbox|prod> --json 2>$null | ConvertFrom-Json; if ($o.authenticated) { 'authenticated'; break } } while ((Get-Date) -lt $deadline)
> ```

### Step 3 — Confirm the session

```
refacil-pay-cli whoami --env <sandbox|prod> --json
```

If `authenticated: true`, continue with the task.

If it is still not authenticated after the ~5-minute polling window, the user likely has not finished signing in in the browser — ask them to complete it, then **re-run the login step only** (do NOT re-run `register`, do NOT restart from Step 2). After 2 failed login attempts, tell the user what happened and stop — never loop.

## Environment

The target environment was set in Step 2 (`--env`). To persist a default so `--env` isn't needed on later commands:

```
refacil-pay-cli config set-environment <sandbox|prod>
```

## Webhook Configuration (local environment)

### Sandbox — use a tunnel

A tunnel exposes your local server to the internet for sandbox testing.

> ⚠️ **The tunnel is a long-running process — run it in the background and keep it alive.** It does not return; it stays up forwarding traffic to your local server. If you run it synchronously, your tool's command timeout kills it and webhooks stop arriving. Start it in the background (prefer your harness's background-run option; bash/Linux/macOS: append `&` as shown; Windows PowerShell: see *Running long commands in the background* in SKILL.md), then read the public URL it prints:

```bash
cloudflared > tunnel.log 2>&1 &
sleep 5 && cat tunnel.log           # bash — Windows PowerShell: Start-Sleep 5; Get-Content tunnel.log
```

Register the webhook with that public URL and **leave the tunnel process running** while you test:

```
refacil-pay-cli user-webhooks-post --webhook-url <tunnel-url>/webhook --env sandbox
```

Validate the webhook is registered:

```
refacil-pay-cli user-webhooks-get --env sandbox --json
```

Send a test notification:

```
refacil-pay-cli webhook-notify --reference <ref> --env sandbox
```

> **Note**: Tunnels are for sandbox only. Never use a tunnel URL as a production webhook.

### Prod — configure a public URL

In prod, configure a stable public URL for your local service (reverse proxy, port forwarding, or cloud deployment):

```
refacil-pay-cli user-webhooks-post --webhook-url https://<your-public-domain>/webhook --env prod
```

> Tell the user: "For production webhooks, your server must be reachable at a public URL. Please provide the public URL for your webhook endpoint."

### Manage webhook status

To activate or deactivate a backup webhook:

```
refacil-pay-cli user-webhooks-id-status --id <webhook-id> --active <true|false>
```

## Console Login (Reference Only)

`refacil-pay-cli login --console` is run by the **user** in the terminal — the agent **never** runs it. It prompts for the following fields: `username`, `password`.

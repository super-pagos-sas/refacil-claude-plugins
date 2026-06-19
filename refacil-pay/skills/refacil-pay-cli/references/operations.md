---
reference: operations
---

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


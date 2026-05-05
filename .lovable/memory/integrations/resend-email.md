---
name: Resend Email
description: Resend transactional email setup, verified domain, and connector details for TruckShield
type: feature
---
Email transport: **Resend** (via Lovable connector gateway), connection `Bret's Resend` (`std_01kqwz01a2e27sr17d2r96j3db`).

Verified sender domain: **`truckshield.360riskpartners.com`** (NOT `send.truckshield...`). The `send.` and `resend._domainkey.` DNS records that Resend's UI shows are just DNS record hostnames — the domain identity registered with Resend is the root subdomain.

Both `SENDER_DOMAIN` and `FROM_DOMAIN` constants in these edge functions must use `truckshield.360riskpartners.com`:
- send-transactional-email
- auth-email-hook
- notify-status-change
- send-reminder-emails

Sending pipeline: `send-transactional-email` enqueues to pgmq → `process-email-queue` cron drains via Resend gateway (`https://connector-gateway.lovable.dev/resend/emails`) using `LOVABLE_API_KEY` + `RESEND_API_KEY` headers.

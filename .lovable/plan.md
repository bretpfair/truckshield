## Diagnosis

Email deliverability is broken because of a **sender domain mismatch**, not because Lovable Emails is inadequate:

- **Verified Lovable domain:** `notify.shearshield.io` (left over from a different brand)
- **Domain hardcoded in `send-transactional-email`:** `notify.360riskpartners.com` (never verified)
- **Result:** Every send is rejected or junked because the `From:` domain has no verified DNS records.

This means there are **two viable paths**, and Resend is the heavier one. I recommend deciding between them before doing the work.

---

## Option A — Fix Lovable Emails (Recommended, ~15 min)

Lowest risk, no new vendor, no DNS changes at the registrar.

**Steps:**
1. Update `SENDER_DOMAIN` and `FROM_DOMAIN` constants in `supabase/functions/send-transactional-email/index.ts` from `notify.360riskpartners.com` → `notify.shearshield.io`.
2. Audit the same constants in `auth-email-hook`, `send-reminder-emails`, `notify-status-change`, and any other function that hardcodes a sender.
3. Redeploy affected functions.
4. Send a test email via the preview function and confirm delivery to inbox (not spam).
5. Update branding memory to reflect the actual sending domain.

**Trade-off:** The visible `From:` address would be `noreply@notify.shearshield.io` — wrong brand. To fix that properly we'd need to set up a new Lovable email domain on `360riskpartners.com` (e.g. `notify.360riskpartners.com`), which requires the user to add NS records at the registrar.

---

## Option B — Migrate to Resend (4–6 hrs of work)

Worth it only if:
- The user wants to send from `360riskpartners.com` AND
- The user prefers Resend's dashboard / analytics / deliverability tooling, OR
- They've already had bad experience getting Lovable's domain verified.

### Migration steps

**1. Domain & DNS**
- Pick a sending subdomain that does NOT collide with the existing Lovable NS delegation on `notify.shearshield.io`. Recommended: `mail.360riskpartners.com` or `send.360riskpartners.com` on the 360riskpartners.com root domain.
- Connect the Resend connector via `standard_connectors--connect("resend")`.
- User adds Resend's SPF/DKIM/DMARC records at their `360riskpartners.com` registrar.
- User verifies the domain in Resend dashboard.

**2. Code changes (preserve all existing infrastructure)**

Keep everything that currently works:
- The 15 React Email templates in `_shared/transactional-email-templates/` — unchanged.
- `registry.ts` — unchanged.
- The `transactional_emails` and `auth_emails` pgmq queues — unchanged.
- `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens` tables — unchanged.
- `send-transactional-email` rendering / enqueue logic — unchanged.
- `send-reminder-emails`, `notify-status-change`, Producer CC logic, idempotency keys — unchanged.

Replace **only the dispatcher**:
- `supabase/functions/process-email-queue/index.ts`: swap the `sendLovableEmail()` call for a `fetch` to the Resend gateway (`https://connector-gateway.lovable.dev/resend/emails`) using `LOVABLE_API_KEY` + `RESEND_API_KEY`.
- Map fields: `from`, `to`, `subject`, `html`, `text`, `headers` (List-Unsubscribe headers preserved from current payload).
- Preserve 429 rate-limit handling using Resend's response headers.
- Preserve DLQ logic, retry counters, suppression checks, and activity logging.

**3. Auth emails decision point**
Auth emails (`auth-email-hook`) currently route through Lovable Emails via the same queue. Two sub-options:
- **B1:** Keep auth emails on Lovable Emails (`notify.shearshield.io`) — simpler, works today, but auth emails come from a different brand than app emails.
- **B2:** Route auth emails through Resend too — requires the dispatcher to handle both queues identically (it already does), which is fine. Recommended if migrating.

**4. Disable / remove Lovable Emails (only after Resend works)**
- Confirm Resend is sending successfully for at least 24 hrs.
- Capture NS records via `check_email_domain_status` for `notify.shearshield.io`.
- Call `email_domain--toggle_project_emails(enabled: false)`.
- User manually removes the NS records (`notify.shearshield.io NS ns3.lovable.cloud` / `ns4.lovable.cloud`) at the shearshield.io registrar.

**5. QA checklist**
- Send each of the 15 templates as a test through the queue.
- Verify retry/DLQ behavior with a forced failure.
- Verify suppression list still blocks sends.
- Verify Producer CC still fires.
- Verify auth flows (signup, magic link, password reset) if Option B2.

---

## Recommendation

**Start with Option A.** It's a 15-minute fix that almost certainly resolves the deliverability problem. If after Option A the user still wants `From: 360riskpartners.com` branding, we then choose between:
- Setting up a new Lovable email domain on `360riskpartners.com` (free, requires registrar NS record), or
- Full Resend migration (Option B).

## Files that would change

**Option A:**
- `supabase/functions/send-transactional-email/index.ts` (sender domain constants)
- Any other function with hardcoded `notify.360riskpartners.com`
- `mem://style/branding` (correct the recorded sending domain)

**Option B (additional):**
- `supabase/functions/process-email-queue/index.ts` (dispatcher swap)
- `.env` / Resend API key via connector
- `supabase/config.toml` if needed
- New Resend connection linked via `standard_connectors--connect`

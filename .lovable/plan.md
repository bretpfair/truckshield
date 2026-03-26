

## Automated Client Portal Invite Email

### Current State
- Account creation exists in `StaffDashboard.tsx` — inserts a row into `accounts` with just `company_name` and `created_by`
- `InviteClientDialog` creates a `client_invitations` row with a token and generates a portal link, but no email is sent — the link is just copied to clipboard
- The existing `send-notification-email` edge function creates in-app notifications but does not actually send emails
- **No email domain is configured** — email infrastructure needs to be set up first

### What Needs to Happen

#### Step 1: Set up email domain
You'll need to configure a sender domain so emails can actually be sent from your app. This is the domain your clients will see in their inbox (e.g., `notify@360riskpartners.com`).

#### Step 2: Set up email infrastructure
Backend queue and processing pipeline for reliable email delivery with retries.

#### Step 3: Create the invite email template
A branded React Email template matching your provided copy:
- Greeting with first name
- Portal benefits list (underwriting details, documents, submission progress, quote tracking)
- Portal link button
- Contact info (916-672-2440)
- 360 Risk Partners branding and website link

#### Step 4: Register template and deploy

#### Step 5: Wire up automatic sending
When `InviteClientDialog.sendInvite` successfully creates an invitation, automatically call the email function with:
- `templateName: 'client-portal-invite'`
- `recipientEmail`: the invited client's email
- `templateData`: `{ firstName, portalLink }` (derived from the invitation token)
- `idempotencyKey`: `portal-invite-${invitation.id}`

### Technical Details

**Template location**: `supabase/functions/_shared/transactional-email-templates/client-portal-invite.tsx`

**Trigger point**: Inside `InviteClientDialog.tsx` `sendInvite.onSuccess`, after the invitation row is created, call `supabase.functions.invoke('send-transactional-email', ...)` with the invite URL and recipient email.

**Template data flow**: The invitation record already contains the `token` and `email`. The portal link is constructed as `${window.location.origin}/auth?invite=${token}`. The first name can be extracted from the email or passed as a field (may need to add a name input to the invite form).

**Unsubscribe page**: A branded `/unsubscribe` page will be created as required by the email infrastructure.

### First Step Required
Before any of this can be built, we need to set up your sender email domain. Let's start there.

<lov-actions>
<lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>


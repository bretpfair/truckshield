

## Plan: CRM Pipeline, Messaging, and Client Quote Mirroring

### Overview
Transform the staff dashboard into a CRM with pipeline view, add an "Additional Info Requested" carrier status, mirror quote statuses on the client portal, and add a messaging/communication feature with document upload.

---

### 1. Database Changes (Migration)

**New `messages` table** for client-agency communication:
- `id`, `account_id`, `sender_id`, `content` (text), `is_staff` (boolean), `attachment_path` (text, nullable), `attachment_name` (text, nullable), `created_at`
- RLS: admins can manage all; clients can read/insert on their own account's messages
- Enable realtime for live updates

**New `client-documents` storage bucket** (private) for client-uploaded documents in messages.

**Update `quotes_status_check`** constraint to add `info_requested` status.

---

### 2. Staff Dashboard - CRM Pipeline View

**Redesign `StaffDashboard.tsx` accounts tab** with a Kanban-style pipeline:
- Column headers: **Lead** | **Pending Info** | **Info Complete** | **Quoting** | **Quoted** | **Bound**
- Each account rendered as a card in its status column showing company name, DOT#, fleet size
- Clicking a card opens `AccountDetail` as before
- Keep a toggle to switch between pipeline and list view for usability

**Update `SubmittedMarkets.tsx`**:
- Add `info_requested` to the status dropdown with label "Additional Info Requested" and an orange/amber styling
- When staff sets a carrier to "info_requested", this signals the client that more info is needed

---

### 3. Client Portal - Mirror Quote Statuses

**Update `ClientPortal.tsx` and `ClientPortalForAccount.tsx`**:
- Currently the client only sees `published` quotes and `draft`/`reviewing` as "Carriers Reviewing"
- Update the RLS policy on `quotes` to let clients see quotes with status `submitted`, `reviewing`, `info_requested`, `quoted`, `bound`, `declined` (not just `published`)
- Show three sections on client portal:
  - **Carriers Reviewing**: quotes with status `submitted` or `reviewing`
  - **Action Needed**: quotes with status `info_requested` (highlighted with warning styling)
  - **Your Quotes**: quotes with status `quoted` or `bound` (showing premium)
- Each card shows carrier name, status badge, and premium when available

---

### 4. Messaging / Communication Portal

**New component `src/components/messaging/AccountMessages.tsx`**:
- Chat-style UI showing messages between client and staff for a given account
- Staff messages aligned right (blue), client messages aligned left (gray)
- Text input at bottom with send button
- File attachment button allowing document upload (PDF, DOC, images)
- Uploaded files stored in `client-documents` bucket, path saved on message record
- Attachments shown as clickable links/badges in the message
- Realtime subscription via `supabase.channel()` for live updates

**Integrate into Staff `AccountDetail.tsx`**:
- Add a "Messages" tab or collapsible section showing the conversation thread for the account
- Staff can send messages and view client replies

**Integrate into `ClientPortal.tsx` / `ClientPortalForAccount.tsx`**:
- Add a "Messages" card/section showing the conversation with the agency
- Client can send messages, upload documents, and see staff responses
- Show unread indicator if there are new messages

---

### 5. Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/new.sql` | Create `messages` table, `client-documents` bucket, update `quotes` constraint, update RLS on `quotes` |
| `src/components/messaging/AccountMessages.tsx` | **Create** - chat UI component |
| `src/components/staff/SubmittedMarkets.tsx` | Add `info_requested` status option |
| `src/components/staff/AccountDetail.tsx` | Add Messages section |
| `src/pages/ClientPortal.tsx` | Add Action Needed section, mirror quote statuses, add Messages section |
| `src/pages/ClientPortalForAccount.tsx` | Same client portal updates |
| `src/pages/StaffDashboard.tsx` | Add pipeline/Kanban view for accounts |


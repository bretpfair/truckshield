

# Plan: Generate TruckShield System Documentation (Word Document)

## What We're Building
A comprehensive `.docx` document covering every feature, automated email, automation, and workflow in the TruckShield / 360 Risk Partners platform. The document will be structured for team onboarding and reference.

## Document Structure

### 1. System Overview
- Platform purpose: trucking insurance CRM and client portal
- Two user roles: Staff (Admin/Producer) and Client
- Tech stack summary (web app with backend database and email infrastructure)

### 2. Staff Dashboard Features
- **Account Management**: Create accounts via DOT lookup (FMCSA/SAFER auto-fill) or manual entry; duplicate DOT detection; search and filter
- **Pipeline View**: Drag-and-drop Kanban board with columns: Lead → Pending Info → Info Complete → Quoting → Quoted → Bound; stale account warnings; producer filtering
- **Account Detail View**: Full account record with collapsible sections, producer assignment (admin-only), status management, application preview, PDF export
- **Carrier Manager**: Add/edit carriers with appetite criteria (fleet size, revenue, authority age, cargo types, states, business types); upload appetite guides and logos
- **AI Market Guidance**: Gemini-powered carrier matching with scores (0-100), tiers (Strong/Partial/Poor), strengths and concerns; "Mark as Submitted" to enter quoting pipeline
- **Submitted Markets**: Track carrier quote statuses (Submitted → Under Review → Info Requested → Quoted → Declined → Bound); upload quote documents; update quotes with revised premium; bind coverage with final premium and policy document; request additional info from client; decline with mandatory reason
- **Document Hub**: Categorized file storage (Loss Runs, Cab Cards, Quotes, Policies, MVR, Drivers License, Misc); upload with category selection; standardized naming: `[Category]_[CompanyName]_[Date].ext`
- **Task Manager**: Create tasks per account with priority (Low/Medium/High), due dates, assignee, completion tracking
- **Activity Log**: Chronological audit trail of all actions on an account
- **Messaging**: Real-time bidirectional chat per account with file attachments, read receipts
- **Analytics Dashboard** (Admin-only): Pipeline funnel chart, status distribution, stale account alerts, producer performance metrics
- **Staff Management** (Admin-only): View staff members, invite new staff via email
- **PDF Import**: Upload existing PDF applications for data extraction
- **Client Invite**: Send/resend magic link invitations to clients

### 3. Client Portal Features
- **Journey Timeline**: Visual 4-stage progress indicator (Submission → Quoting → Quoted → Bound)
- **Application Wizard**: 10-step form (Applicant Info, Coverage Selections, Radius of Operations, Commodities, Power Units, Trailers, Drivers, Loss History, General Questions, Review & Submit); auto-save; red border validation for incomplete fields; cab card and loss run uploads inline
- **Info Request Banner**: Persistent alert when a carrier has requested additional information
- **Quote Display**: Carrier logo, premium amount, downloadable quote PDF
- **Policy Renewal Card**: For bound policies — shows expiration date and countdown
- **Document Hub**: View and download documents shared by staff; upload documents
- **Messaging**: Chat with agency staff, file attachments

### 4. Authentication & Onboarding
- **Client Authentication**: Magic link (passwordless) via email invitation
- **Staff Authentication**: Email/password signup via invitation link with token-based role assignment
- **Client Invitation Auto-trigger**: Whenever `contact_email` is set on an account (via wizard, SAFER import, or manual entry), an invitation is automatically sent
- **Staff Invitation Flow**: Admin generates time-limited token → email sent → signup/login via invite link → `accept_staff_invitation` grants admin role

### 5. Automated Status Progression (Database Triggers)
The `auto_update_account_status` trigger automatically transitions account status:

| Trigger Event | From Status | To Status |
|---|---|---|
| Application completed (step ≥ 10) | pending_info | info_complete |
| First quote submitted to carrier | lead/pending_info/info_complete | quoting |
| Quote received from carrier | quoting | quoted |
| Coverage bound | any | bound |

Each transition logs an activity entry and fires the `notify-status-change` edge function for email notifications.

### 6. Automated Emails (9 Templates)

| Template | Trigger | Recipient | Contents |
|---|---|---|---|
| **Client Portal Invite** | Contact email set on account | Client | Magic link to access portal |
| **Application Received** | Application submitted (status → info_complete) | Client | Confirmation that application was received |
| **Application Completed (Staff)** | Application submitted | All admins + assigned producer | Alert with company name, DOT#, submitter name |
| **Pipeline Status Change** | Account status changes (quoting/quoted/bound) | Client | Status update with portal link |
| **Carrier Status Change** | Carrier quote status updated | Client | Carrier name, new status, portal link (statuses: Submitted, Under Review, Quoted, Quote Updated, Declined, Bound) |
| **Additional Info Request** | Staff requests info from carrier panel | Client | Carrier name, request details, portal link |
| **Application Reminder** | Daily cron (every 3 days) | Clients with incomplete apps | Completion percentage, portal link |
| **Info Request Reminder** | Daily cron (every 3 days) | Clients with pending info requests | Carrier name, request details, days pending |
| **New Message Received** | New message sent | Opposite party (client↔staff) | Message preview, portal link |

### 7. In-App Notifications (Database Triggers)
The `create_notification_on_event` trigger creates bell notifications:
- **New message from client** → All admins + assigned producer
- **New message from staff** → Client
- **Info requested by carrier** → Client
- **Quote available** → Client

### 8. Scheduled Jobs
- **Reminder Emails Cron**: Runs daily, sends application reminders (incomplete apps in pending_info with linked client) and info request reminders (pending info_requests) — throttled to every 3 days per recipient

### 9. Document Naming Convention
All uploads follow: `[Category]_[Company_Name]_[Suffix]_[Date].[ext]`
- Examples: `Loss_Run_Acme_Trucking_2026-03-29.pdf`, `Quote_Acme_Trucking_Cover_Whale_2026-03-29.pdf`
- Applied to: Loss runs, cab cards, Document Hub uploads, quote uploads, bind documents

### 10. Key Workflows (End-to-End)

**New Account → Bound Policy workflow diagram:**
```text
DOT Lookup (SAFER) ──► Account Created ──► Client Invited (auto)
        │                                        │
        ▼                                        ▼
  Staff reviews data                   Client completes 10-step app
        │                                        │
        ▼                                        ▼
  AI Market Guidance ──► Mark Carriers Submitted ──► Status: Quoting
        │                                               │
        ▼                                               ▼
  Carriers review ──► Quote received ──► Status: Quoted
        │                                      │
        ▼                                      ▼
  Staff enters final premium ──► Uploads binder ──► Status: Bound
                                                      │
                                                      ▼
                                              Policy Renewal Card shown
```

## Technical Approach
- Generate using `docx-js` (Node.js library)
- Professional formatting with branded headings, tables, and flow descriptions
- Output to `/mnt/documents/TruckShield_System_Documentation.docx`
- QA by converting to images and inspecting each page

## Estimated Scope
- Single script execution generating ~15-20 page document
- No codebase changes required


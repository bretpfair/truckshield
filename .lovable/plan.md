

## Recommended Enhancements for a Seamless CRM Portal

Based on a thorough review of the current codebase, here are the highest-impact improvements organized by priority.

---

### Priority 1 — Core CRM Gaps

**A. Activity Log & Internal Notes per Account**
- Create an `activity_log` table (`account_id`, `user_id`, `action_type`, `description`, `created_at`)
- Auto-log key events: status changes, quote updates, messages sent, documents uploaded
- Add a staff-only "Notes & Activity" timeline in AccountDetail showing chronological history
- Staff can add freeform internal notes (not visible to clients)

**B. Task / Follow-Up Reminders**
- Create a `tasks` table (`account_id`, `assigned_to`, `title`, `due_date`, `status`, `priority`)
- Add a "Tasks" section in AccountDetail for staff to create follow-ups (e.g., "Call client re: loss runs", "Follow up with carrier X")
- Show overdue/upcoming tasks on the dashboard with a count badge
- Filter pipeline cards to highlight accounts with overdue tasks

**C. Centralized Document Hub per Account**
- Currently documents only exist as message attachments — no organized view
- Create a "Documents" tab in AccountDetail showing all uploaded files: cab cards, loss runs, message attachments, quote documents
- Allow staff to upload documents directly (not just via messaging)
- Categorize documents: Applications, Loss Runs, Cab Cards, Quotes, Misc
- Mirror a read-only version on the client portal so clients see their uploaded docs

---

### Priority 2 — Automation & Notifications

**D. Notification System**
- Create a `notifications` table (`user_id`, `account_id`, `type`, `message`, `read`, `created_at`)
- Trigger notifications on: new message received, carrier status changed to `info_requested`, new quote available, task due
- Add a bell icon in the header with unread count badge
- Notification dropdown showing recent items with click-to-navigate

**E. Automated Status Progression**
- Auto-update account status from `pending_info` to `info_complete` when application reaches step 10 (review)
- Auto-update to `quoting` when first quote is marked `submitted`
- Auto-update to `quoted` when first quote is marked `quoted`
- Keeps pipeline accurate without staff manually updating account statuses

**F. Email Notifications via Backend Function**
- Send email when: client has a new message from agency, carrier requests additional info, a quote is ready
- Use a backend function triggered by database webhooks
- Keeps clients engaged without needing to constantly check the portal

---

### Priority 3 — UX & Efficiency

**G. Proper Client Invitation Flow**
- Currently just shows a URL — no actual invite mechanism
- Add email invite: staff enters client email + selects account → sends branded invite email with signup link
- On signup, auto-link the client to their account using an invite token
- Eliminates manual `client_user_id` assignment

**H. Advanced Pipeline Interactions**
- Drag-and-drop cards between pipeline columns to change account status
- Show a message count badge on pipeline cards for accounts with unread messages
- Add hover preview showing key account details without clicking in
- Mobile-responsive: stack pipeline columns vertically on small screens

**I. Dashboard Analytics**
- Conversion funnel: Lead → Pending → Complete → Quoting → Quoted → Bound with percentages
- Aging report: accounts stuck in a status for too long (highlighted in red)
- Revenue summary: total bound premiums, average premium, win rate
- Time-period filtering (this week, month, quarter)

**J. Quote Comparison for Clients**
- Side-by-side comparison view when multiple quotes are available
- Show coverage details, premiums, and carrier ratings
- "Select Quote" button for clients to indicate their preferred option

---

### Priority 4 — Polish

**K. Renewal Tracking**
- Flag accounts approaching `current_coverage_expiry` (30/60/90 day warnings)
- Dashboard widget showing upcoming renewals
- Auto-create a new "lead" for renewal when expiry is within 90 days

**L. Search & Filtering Improvements**
- Filter accounts by status, date range, assigned carrier, premium range
- Sort by created date, company name, expiry date
- Saved filter presets for common views ("My overdue tasks", "Quotes ready")

---

### Suggested Implementation Order

| Phase | Items | Effort |
|-------|-------|--------|
| Phase 1 | Activity Log (A), Automated Status (E), Client Invite (G) | Medium |
| Phase 2 | Document Hub (C), Notifications (D), Pipeline UX (H) | Medium-High |
| Phase 3 | Tasks (B), Email Notifications (F), Dashboard Analytics (I) | High |
| Phase 4 | Quote Comparison (J), Renewals (K), Search/Filter (L) | Medium |

Each phase builds on the previous one. Phase 1 fills the most critical operational gaps. Phase 2 adds the engagement layer. Phase 3 brings proactive workflow management. Phase 4 is competitive polish.


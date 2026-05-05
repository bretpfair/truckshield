# Project Memory

## Core
Bold UI with Space Grotesk (headings) and JetBrains Mono (data), electric blue/cyan accents. Supports light/dark mode.
App branding: 'TruckShield, powered by 360 Risk Partners'. Domain: truckshield.360riskpartners.com.
Roles: Admin (global access), Producer (RLS restricted to assigned), Client (invite-only magic link).
Quotes and binder documents must be stored in the 'loss-runs' storage bucket.
Document uploads must use format: [Category]_[Company_Name]_[Suffix]_[Date].[ext].
Emails sent via Resend connector. Verified sender domain is truckshield.360riskpartners.com (NOT send.truckshield...).
Emails include contact info instead of 'do not reply', dark theme.
DOT number uniqueness is strictly enforced at the database level.
Application progress blocks on 100% total validations for Radius and Commodities.
Auto-saves in application wizard are capped at step 9 to prevent premature completion triggers.
Security: RLS policies heavily restrict clients. No non-staff metadata updates.

## Memories
- [Design Direction](mem://style/design-direction) — Bold modern UI, blue/cyan accents, Space Grotesk fonts
- [Email Branding](mem://style/email-branding) — Transactional email branding, typography, and specific contact details
- [Mobile UI Optimization](mem://style/mobile-ui-optimization) — Mobile-first responsive UI rules for dashboards and messaging
- [Branding](mem://style/branding) — Branding text, logos, and production domain URL
- [Roles & Onboarding](mem://auth/roles-and-onboarding) — Role definitions, RLS restrictions, and onboarding rules
- [Client Portal](mem://features/client-portal) — 4-stage journey timeline, Info Request Banner, and Document Hub
- [Quote Generation Workflow](mem://features/quote-generation-workflow) — Quote workflow and document storage bucket constraints
- [Application Wizard](mem://features/application-wizard) — 10-step wizard completion and submission state rules
- [Document Upload](mem://features/document-upload) — Document naming conventions and storage category keys
- [VIN Decoding](mem://features/vin-decoding) — Power Units auto-fill via NHTSA VIN Decoder API
- [Application PDF Export](mem://features/application-pdf-export) — Structured PDF export format and layout rules
- [Staff CRM Pipeline](mem://features/staff-crm-pipeline) — 5-stage CRM flow, progress calculations, and mandatory decline reasons
- [Communication Portal](mem://features/communication-portal) — Real-time messaging, automated emails, and responsive UI
- [Client Onboarding](mem://features/client-onboarding) — Magic link invite flow and token handling
- [CRM Analytics](mem://features/crm-analytics) — CRM metrics, conversion funnel, and Client Adoption tracking
- [Notification System](mem://features/notification-system) — Multi-channel notifications and scheduled reminders
- [Staff Account Management](mem://features/staff-account-management) — Staff view features, activity log tracking, and auto-assignment
- [Data Ingestion Strategy](mem://features/data-ingestion-strategy) — AI-powered PDF import using Gemini 2.5 Flash
- [Preview Routes](mem://features/preview-routes) — Handling of preview mock data routes and write-bypassing
- [Carrier Management](mem://features/carrier-management) — Interface for carriers and AI parsing of appetite guides
- [Staff Invitation Flow](mem://features/staff-invitation-flow) — Admin staff invitation token flow and role assignment
- [Staff Analytics](mem://features/staff-analytics) — Producer Performance dashboard metrics and leaderboards
- [Staff Team Management](mem://features/staff-team-management) — Staff management interface and invitation tracking
- [Login Tracking](mem://features/login-tracking) — Client login history and activity log records
- [Post-Bind Sequence](mem://features/post-bind-sequence) — Automated welcome email and 30-day review request
- [Task Management Automation](mem://features/task-management-automation) — Daily task management digest emails for staff
- [AI FAQ Chat](mem://features/ai-faq-chat) — AI FAQ chat widget capabilities and human escalation path
- [Resend Email](mem://integrations/resend-email) — Resend transactional email setup, verified domain, and connector
- [FMCSA SAFER Lookup](mem://integrations/fmcsa-safer-lookup) — SAFER API DOT lookup for prefill and uniqueness constraints
- [CTQ Webhook](mem://integrations/ctq-webhook) — CTQ webhook lead ingestion mapping and fallback logic
- [Cover Whale API](mem://integrations/cover-whale-api) — Cover Whale API v1.3 integration rules and mappings
- [Carrier Matching](mem://logic/carrier-matching) — AI carrier matching, scoring logic, and specific carrier constraints
- [Loss History Rules](mem://logic/insurance-application/loss-history-rules) — Loss history collection and sync with New Venture status
- [Equipment Rules](mem://logic/insurance-application/equipment-rules) — Power Unit and Trailer equipment entry constraints
- [Radius & Operations Logic](mem://logic/insurance-application/radius-and-operations-logic) — Radius distribution validation (must equal exactly 100%)
- [Coverage Limits Logic](mem://logic/insurance-application/coverage-limits-logic) — Coverage limits constraints and UI labeling for industry terms
- [Power Unit Specifications](mem://logic/insurance-application/power-unit-specifications) — Granular GVW classes required for Power Units
- [Trailer Types](mem://logic/insurance-application/trailer-types) — Allowed trailer types curated list
- [Commodities Rules](mem://logic/insurance-application/commodities-rules) — Commodities collection, prefill, and 100% total validation
- [General Questions Logic](mem://logic/insurance-application/general-questions-logic) — Underwriting questions format and revenue prefill
- [Applicant Info](mem://logic/insurance-application/applicant-info) — Applicant Info section prefill and New Venture logic
- [Driver Rules](mem://logic/insurance-application/driver-rules) — Driver entry requirements and validation UX
- [Automated Account Status Progression](mem://logic/automated-account-status-progression) — Automated status transition triggers and notifications
- [Submission Logic](mem://logic/insurance-application/submission-logic) — Application auto-saves capped at step 9
- [Progress Calculation](mem://logic/insurance-application/progress-calculation) — Application progress percentage calculation logic
- [Business Type Normalization](mem://logic/business-type-normalization) — Normalization of business types to canonical list
- [Producer CC Notifications](mem://logic/communication-logic/producer-cc-notifications) — Automatic CC logic for assigned producers on emails
- [Security Architecture](mem://architecture/security-architecture) — Security model constraints: RLS, triggers, privilege escalation prevention



# Cover Whale API Integration Plan

## Overview

Integrate Cover Whale's API directly into TruckShield so staff can request quotes, check indications, view submission status, and initiate binding — all from within the account detail view. The system will map existing application data to Cover Whale's API payload format automatically.

## Prerequisites — API Credentials

Before building, we need to securely store three Cover Whale secrets:
- **CW_BASE_URL** — `https://api.coverwhale.dev` (dev) or `https://api.coverwhale.com` (prod)
- **CW_USERNAME** — the username associated with `integrations@360riskpartners.com`
- **CW_PASSWORD** — the password provided by Cover Whale

These will be stored as backend secrets and used only by backend functions. You will need to obtain the actual credentials from Cover Whale after registering `integrations@360riskpartners.com`.

---

## Architecture

```text
┌──────────────────────────────┐
│   Staff UI (AccountDetail)   │
│  "Get CW Quote" / "Get CW   │
│   Indication" buttons        │
└──────────┬───────────────────┘
           │ supabase.functions.invoke()
           ▼
┌──────────────────────────────┐
│  Edge Function:              │
│  coverwhale-api              │
│  ─ authenticates with CW     │
│  ─ maps account data → CW   │
│    payload format            │
│  ─ calls CW endpoints       │
│  ─ returns results           │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Cover Whale API             │
│  (api.coverwhale.dev)        │
└──────────────────────────────┘
```

---

## Step 1: Store API Credentials

Use the secrets tool to request the Cover Whale username and password from you. The base URL will also be stored as a secret so we can switch between dev/prod easily.

## Step 2: Create `coverwhale-api` Edge Function

A single edge function with action-based routing:

- **`authenticate`** — POST to `/authentication` with username/password, returns an AccessToken (cached for ~24h)
- **`quote`** — Maps account data to the CW quote payload, POSTs to `/quote`, returns quote result with coverages, submission number, and PDF link
- **`indication`** — Same mapping but POSTs to `/indication` (accepts incomplete data)
- **`submission-status`** — GET to `/submission/{submission_number}`, returns current status
- **`bind`** — PUT to `/bind` with coverage elections, shipping address, and binding method

**Data mapping logic** (account/drivers/vehicles/trailers/loss history → CW payload):
- `accounts` fields → `insuredInformation`, `garageAddress`, `mailingAddress`, `coverage`, `limits`, `operations`, `radius`
- `power_units` table → `vehicles` array (VIN, year, make, model, class, body type)
- `trailers` table → `trailers` array
- `drivers` table → `drivers` array (name, DOB, license, experience, accidents/violations)
- `loss_history` table → `losses` object (by year, per coverage line)
- `commodity_info` from account → `commodities` array
- `garage_locations` → `terminals` array
- Retail agent info will use the assigned producer's profile or a default agency config

## Step 3: Database — Track CW Submissions

Add a `coverwhale_submissions` table to store submission tracking data:
- `id`, `account_id`, `quote_id` (links to existing quotes table)
- `submission_number` (CW's identifier)
- `status` (Quoted, Bind Requested, Bound, Declined, etc.)
- `quote_pdf_url`, `coverages_data` (JSON of returned coverage breakdown)
- `created_at`, `updated_at`

RLS policies: admins full access, producers on assigned accounts.

## Step 4: UI — Staff-Side Integration

**In SubmittedMarkets / AccountDetail:**
- Add a "Get Cover Whale Quote" button (visible when Cover Whale is a carrier in the system)
- When clicked: calls the edge function with `action: "quote"`, passing the account ID
- The edge function fetches all related data server-side and builds the payload
- On success: automatically creates/updates a quote record in the `quotes` table with the CW premium, stores the submission number in `coverwhale_submissions`, and logs activity
- A "Get Indication" button for preliminary pricing before full data is ready
- A "Check Status" button for existing CW submissions to refresh status
- A "Bind" action on quoted CW submissions (opens dialog for coverage elections, broker fees, effective date, signature flow)

**Quote result display:**
- Show per-coverage breakdown (AL, APD, MTC, TGL, NTL) with premium, limit, deductible
- Link to the CW quote PDF
- Show submission number for reference

## Step 5: Activity Logging

All CW API interactions will be logged to `activity_log`:
- "Cover Whale indication requested"
- "Cover Whale quote received — Submission #XXXXX — Total premium: $XX,XXX"
- "Cover Whale bind initiated — Submission #XXXXX"
- "Cover Whale status check — Current status: [status]"

---

## Technical Details

**Authentication flow**: The edge function will authenticate on each request (or cache the token in the response). CW tokens last ~24 hours. The pre-request script pattern from the Postman collection shows: POST to `/authentication` with `{username, password}`, response returns `{AccessToken}`. This token is sent as `AccessToken` header on subsequent requests.

**Payload mapping examples** (key transformations):
- `account.dot_number` → `insuredInformation.dotNumber` (numeric)
- `account.company_name` → `insuredInformation.legalName`
- `account.coverage_selections` → `coverage.requestAl`, `coverage.requestApd`, etc.
- `account.radius_operations` → `radius.radius0_50`, `radius51_200`, etc.
- `power_units[].vin` → `vehicles[].vin`, `power_units[].gvw_class` → `vehicles[].classKey`
- `drivers[].date_of_birth` → formatted as `MM/DD/YYYY`
- Loss history policy terms → `losses` object keyed by year (1, 2, 3...)

**Error handling**: CW returns 422 for validation errors (e.g., "Commodity % must equal 100%", "VIN numbers must be unique"). These will be surfaced to staff in a toast/dialog with actionable guidance.

---

## Files to Create/Modify

1. **Create** `supabase/functions/coverwhale-api/index.ts` — Edge function
2. **Create** DB migration for `coverwhale_submissions` table
3. **Modify** `src/components/staff/SubmittedMarkets.tsx` — Add CW action buttons
4. **Modify** `src/components/staff/AccountDetail.tsx` — Pass CW submission data, add indication button
5. **Modify** `src/components/staff/ActivityLog.tsx` — Add icon for CW-related activity types


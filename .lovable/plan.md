

## CTQ Webhook Integration Plan

Since the CTQ portal doesn't support custom headers, we'll build the webhook endpoint **without API key authentication**. Instead, we'll use basic validation to ensure incoming data has the expected structure.

### What gets built

1. **Edge Function: `ctq-webhook`**
   - Accepts POST requests with JSON payload from CTQ
   - Validates the payload has expected fields (company name, DOT, etc.)
   - Maps CTQ fields → your database tables:
     - Prospect/company info → `accounts` (company_name, dba, DOT, MC, owner, address, etc.)
     - Drivers → `drivers` table
     - Vehicles → `power_units` or `trailers` (based on `is_trailer` flag)
     - Loss history → `loss_history` table
     - Coverage/commodities → `accounts.coverage_selections` and `accounts.commodity_info` JSON fields
   - Duplicate check by DOT number: updates existing account if found, creates new if not
   - Sets new accounts to status `'lead'` to distinguish from manual entries
   - Returns success/error response to CTQ

2. **Database migration**
   - Add `'lead'` as a valid status for accounts (if status is constrained)

3. **Staff Dashboard update**
   - Show `'lead'` status accounts with a distinguishing label so staff can see CTQ imports

### Security note
The endpoint will be open (no auth header), but will validate the JSON structure and reject malformed requests. Since CTQ is the only system with the URL, risk is low. We can add IP allowlisting or a query-string token later if needed.

### Technical details
- The edge function uses the Supabase service role key to insert data (bypassing RLS)
- All inserts happen in a transaction-like flow: account first, then related records
- CTQ URL to configure: `https://czowzqkqzvsamfhkaozk.supabase.co/functions/v1/ctq-webhook`
- Format: JSON (already configured)




## Plan: Fix Quote PDF Downloads & Show Premium Instead of Status Badge

### Problem
1. **Quote PDFs not accessible on client side**: Staff uploads quote PDFs to the `loss-runs` storage bucket (path stored in `coverage_details.quote_file_path`), but the client portal "Your Quotes" section has no download button.
2. **Status badge instead of premium**: The screenshot shows "Quoted" badge — user wants the premium amount displayed there instead.

### Changes

**File: `src/pages/ClientPortal.tsx`** (lines ~360-374, "Your Quotes" section)

- Replace the `<Badge>` showing "Quoted"/"Bound" with a styled premium amount display (e.g., `$25,000`)
- Add a **Download Quote** button for quotes that have `coverage_details.quote_file_path`
- The download button will generate a signed URL from the `loss-runs` bucket using `supabase.storage.from("loss-runs").createSignedUrl(path, 3600)` and open it in a new tab

**File: `src/pages/ClientPortalForAccount.tsx`** (lines ~320-335, "Your Quotes" section)

- Apply the same changes: premium amount instead of status badge, plus download button

### Technical Details

- The `loss-runs` bucket already has RLS policies allowing authenticated users to SELECT — so signed URLs will work for clients.
- Quote file path is in `q.coverage_details?.quote_file_path`
- Premium is in `q.premium_estimate`
- Will add a small async handler that creates a signed URL and opens it via `window.open()`


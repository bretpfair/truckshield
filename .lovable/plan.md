

## Fix: Attach Auto-Status Triggers to Pipeline

### Problem
The `auto_update_account_status()` function exists with correct logic but no triggers are attached, so quote status changes don't propagate to account pipeline status.

### Solution
Create a database migration that attaches triggers:

1. **Trigger on `accounts` table** — fires on UPDATE, calls `auto_update_account_status()` when `application_step` changes (moves account from `pending_info` → `info_complete` when step reaches 10).

2. **Trigger on `quotes` table** — fires on INSERT and UPDATE, calls `auto_update_account_status()` to handle:
   - Quote submitted → account moves to `quoting`
   - Quote marked `quoted` → account moves to `quoted`
   - Quote marked `bound` → account moves to `bound`

### Migration SQL
```sql
CREATE TRIGGER trg_auto_status_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

CREATE TRIGGER trg_auto_status_quotes
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();
```

The `accounts` trigger uses BEFORE UPDATE (since it modifies `NEW.status` directly), while the `quotes` trigger uses AFTER (since it runs an UPDATE on the accounts table).

### Result
After this migration, any quote status change made in a customer record will immediately reflect on the pipeline dashboard — no manual status updates needed.


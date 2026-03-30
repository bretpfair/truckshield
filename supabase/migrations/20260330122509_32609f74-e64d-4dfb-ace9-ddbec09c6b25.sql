
-- Wire the auto_update_account_status trigger to both accounts and quotes tables
CREATE TRIGGER auto_update_account_status_on_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

CREATE TRIGGER auto_update_account_status_on_quotes
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

-- Fix the stuck KULWINDER S BASSI account: it has 'quoted' quotes so status should be 'quoted'
UPDATE public.accounts
SET status = 'quoted'
WHERE id = 'd331b36e-b7b1-491b-8635-c3b1829ac8fc'
  AND status = 'info_complete';

-- Log the correction
INSERT INTO public.activity_log (account_id, action_type, description)
VALUES ('d331b36e-b7b1-491b-8635-c3b1829ac8fc', 'status_change', 'Status corrected to Quoted (had quoted quotes but trigger was missing)');

CREATE TRIGGER trg_auto_status_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();

CREATE TRIGGER trg_auto_status_quotes
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_status();
-- handle_new_user é security definer e estava exposta em /rest/v1/rpc para anon.
-- Só o trigger em auth.users (executado por supabase_auth_admin) deve chamá-la.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

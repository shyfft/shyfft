create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create or replace function public.grant_admin_for_owner_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and lower(new.email) = 'shreyashchavaragi@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    update public.profiles set verified = true where id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.grant_admin_for_owner_email() from public, anon, authenticated;

create trigger on_auth_user_created_grant_admin after insert on auth.users
for each row execute function public.grant_admin_for_owner_email();
create trigger on_auth_user_confirmed_grant_admin after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_admin_for_owner_email();

-- profile is created by handle_new_user after insert; ensure admin profile gets verified too
create or replace function public.verify_admin_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(new.id, 'admin') then new.verified := true; end if;
  return new;
end $$;
revoke execute on function public.verify_admin_profile() from public, anon, authenticated;
create trigger profiles_admin_verified before insert on public.profiles
for each row execute function public.verify_admin_profile();

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where lower(email) = 'shreyashchavaragi@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
update public.profiles set verified = true
where id in (select user_id from public.user_roles where role = 'admin');

create or replace function public.set_user_verified(_target uuid, _verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only the admin can change verification' using errcode = '42501';
  end if;
  update public.profiles set verified = _verified where id = _target;
end $$;
revoke execute on function public.set_user_verified(uuid, boolean) from public, anon;
grant execute on function public.set_user_verified(uuid, boolean) to authenticated;
-- Two access levels for the admin: 'admin' and 'editor'.
--
-- The site's access model stays "trust everyone, publish direct" for CONTENT —
-- every authenticated co-author still writes every content table (see the RLS
-- loop in schema.sql). This table gates CREDENTIALS only: who may change another
-- co-author's email or password, invite someone new, or delete an account.
--
--   admin   — everything an editor can do, plus the Users ▸ Co-authors panel
--   editor  — content, plus their own email/password (auth.updateUser)
--
-- The Users panel talks to the `admin-users` Edge Function, which is the only
-- thing holding the service_role key. It re-checks this table on every call —
-- the UI hiding the panel from editors is convenience, not the control.

create table if not exists user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('admin', 'editor')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

drop trigger if exists set_updated_at on user_roles;
create trigger set_updated_at before update on user_roles
  for each row execute function set_updated_at();

-- Every co-author may READ roles: the admin needs its own level to decide what
-- to render, and the Co-authors list shows everyone's. There is deliberately no
-- write policy — roles change only through the Edge Function's service_role
-- client, so nobody can promote themselves with the publishable key.
alter table user_roles enable row level security;

drop policy if exists "authors read roles" on user_roles;
create policy "authors read roles" on user_roles
  for select to authenticated using (true);

-- New accounts (invited through the admin or created in the Supabase dashboard)
-- land as 'editor'. An admin promotes them from the Users panel.
create or replace function handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user_role();

-- Bootstrap: the project owner starts as the admin, everyone who already has an
-- account starts as an editor. Promote further admins from the Users panel —
-- this seed only ever runs against accounts that exist today.
insert into user_roles (user_id, role)
select id, case when email = 'dhansen@area71.com' then 'admin' else 'editor' end
from auth.users
on conflict (user_id) do nothing;

-- Role enum
do $$ begin
  create type public.app_role as enum ('admin', 'student');
exception when duplicate_object then null; end $$;

-- user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles read auth" on public.user_roles;
create policy "user_roles read auth"
on public.user_roles for select
to authenticated
using (true);

-- has_role security definer function
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Notes admin write policies
drop policy if exists "notes admin insert" on public.notes;
create policy "notes admin insert"
on public.notes for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notes admin update" on public.notes;
create policy "notes admin update"
on public.notes for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "notes admin delete" on public.notes;
create policy "notes admin delete"
on public.notes for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Grant admin to the lecturer if account exists
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'godae.beega@uat.edu.ng'
on conflict (user_id, role) do nothing;

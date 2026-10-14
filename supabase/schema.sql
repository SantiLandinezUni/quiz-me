-- QuizMe database schema. Paste into Supabase: SQL Editor -> New query -> Run.

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  material text not null default '',
  quiz jsonb,
  created_at timestamptz not null default now()
);

create index if not exists study_sets_user_created_idx
  on public.study_sets (user_id, created_at desc);

-- Row Level Security: each user only sees and changes their own rows.
alter table public.study_sets enable row level security;

-- Nothing for logged-out visitors (anon role).
revoke all on public.study_sets from anon;
grant select, insert, update, delete on public.study_sets to authenticated;

drop policy if exists "Users can read their own study sets" on public.study_sets;
create policy "Users can read their own study sets"
  on public.study_sets for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own study sets" on public.study_sets;
create policy "Users can create their own study sets"
  on public.study_sets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own study sets" on public.study_sets;
create policy "Users can update their own study sets"
  on public.study_sets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own study sets" on public.study_sets;
create policy "Users can delete their own study sets"
  on public.study_sets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

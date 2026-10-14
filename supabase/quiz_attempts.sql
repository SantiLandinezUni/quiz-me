-- QuizMe: quiz attempt history. Run AFTER schema.sql.
-- Paste into Supabase: SQL Editor -> New query -> Run.

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  -- "quiz" = a generated quiz, "mistakes" = a "Practise my mistakes" round.
  kind text not null default 'quiz' check (kind in ('quiz', 'mistakes')),
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  -- Full questions answered wrong (so they can be practised later, even
  -- after the study set's quiz is regenerated).
  wrong_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(wrong_questions) = 'array'),
  -- Normalised text of questions answered right (retires old mistakes).
  correct_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_set_created_idx
  on public.quiz_attempts (study_set_id, created_at desc);
create index if not exists quiz_attempts_user_idx
  on public.quiz_attempts (user_id);

-- Row Level Security: each user only sees and changes their own attempts.
alter table public.quiz_attempts enable row level security;

-- Nothing for logged-out visitors. Attempts are history, so no updates.
revoke all on public.quiz_attempts from anon;
revoke all on public.quiz_attempts from authenticated;
grant select, insert, delete on public.quiz_attempts to authenticated;

drop policy if exists "Users can read their own attempts" on public.quiz_attempts;
create policy "Users can read their own attempts"
  on public.quiz_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Can only add attempts for yourself, on a study set you own.
drop policy if exists "Users can add attempts to their own study sets" on public.quiz_attempts;
create policy "Users can add attempts to their own study sets"
  on public.quiz_attempts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete their own attempts" on public.quiz_attempts;
create policy "Users can delete their own attempts"
  on public.quiz_attempts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

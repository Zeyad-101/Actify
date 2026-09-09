-- Actify · Supabase schema
-- Run in the Supabase SQL editor in one pass.

create extension if not exists pgcrypto;


-- profiles
create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text,
  skin        text,
  hair_style  text,
  hair_color  text,
  eyes        text,
  shirt       text,
  pants       text,
  shoes       text,
  accessory   text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = user_id);


-- interests
create table public.interests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  tag         text not null,
  rating      int  not null check (rating between 1 and 10),
  is_custom   boolean default false,
  created_at  timestamptz default now()
);

create index interests_user_id_idx on public.interests (user_id);

alter table public.interests enable row level security;

create policy "interests_select_own"
  on public.interests for select
  using (auth.uid() = user_id);

create policy "interests_insert_own"
  on public.interests for insert
  with check (auth.uid() = user_id);

create policy "interests_update_own"
  on public.interests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "interests_delete_own"
  on public.interests for delete
  using (auth.uid() = user_id);


-- schedule_items
create table public.schedule_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  title         text not null,
  start_time    time not null,
  end_time      time not null,
  is_recurring  boolean default false,
  weekdays      int[] default '{}',
  specific_date date,
  created_at    timestamptz default now()
);

create index schedule_items_user_id_idx on public.schedule_items (user_id);

alter table public.schedule_items enable row level security;

create policy "schedule_items_select_own"
  on public.schedule_items for select
  using (auth.uid() = user_id);

create policy "schedule_items_insert_own"
  on public.schedule_items for insert
  with check (auth.uid() = user_id);

create policy "schedule_items_update_own"
  on public.schedule_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "schedule_items_delete_own"
  on public.schedule_items for delete
  using (auth.uid() = user_id);


-- tasks
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean default false,
  created_at  timestamptz default now()
);

create index tasks_user_id_idx on public.tasks (user_id);

alter table public.tasks enable row level security;

create policy "tasks_select_own"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own"
  on public.tasks for delete
  using (auth.uid() = user_id);


-- history
create table public.history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  activity_id      text not null,
  category         text not null,
  mood             text,
  feedback         text check (feedback is null or feedback in ('loved', 'good', 'meh', 'no')),
  rejection_reason text,
  created_at       timestamptz default now()
);

create index history_user_id_idx      on public.history (user_id);
create index history_created_at_idx  on public.history (created_at desc);

alter table public.history enable row level security;

create policy "history_select_own"
  on public.history for select
  using (auth.uid() = user_id);

create policy "history_insert_own"
  on public.history for insert
  with check (auth.uid() = user_id);

create policy "history_update_own"
  on public.history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "history_delete_own"
  on public.history for delete
  using (auth.uid() = user_id);


-- google_calendar_tokens
create table public.google_calendar_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text,
  connected     boolean default false
);

alter table public.google_calendar_tokens enable row level security;

create policy "google_calendar_tokens_select_own"
  on public.google_calendar_tokens for select
  using (auth.uid() = user_id);

create policy "google_calendar_tokens_insert_own"
  on public.google_calendar_tokens for insert
  with check (auth.uid() = user_id);

create policy "google_calendar_tokens_update_own"
  on public.google_calendar_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "google_calendar_tokens_delete_own"
  on public.google_calendar_tokens for delete
  using (auth.uid() = user_id);

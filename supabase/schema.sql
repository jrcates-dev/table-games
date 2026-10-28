-- Casino Table Games Arena — Supabase schema
--
-- Apply with:  supabase db push        (or paste into the SQL editor)
--
-- Two tables. `profiles` holds one mutable row per player per game: bankroll,
-- settings, stats and a trimmed history, stored as JSON so the client owns the
-- shape and schema changes do not require a migration. `runs` is append-only
-- and feeds the leaderboard — a row is written each time a bankroll run ends.
--
-- Every row is keyed by `game`. A blackjack hand and a craps shoot are not
-- comparable units, so the two must never share a bankroll or a leaderboard;
-- putting the column in the key rather than filtering on read is what makes
-- mixing them impossible rather than merely unlikely.
--
-- NOTE: the client currently writes blackjack rows only. Craps persists to
-- local storage until `SupabaseAdapter` is generalised past a blackjack-shaped
-- profile (see `src/store/crapsStorage.ts`).

create table if not exists public.profiles (
  user_id      uuid not null references auth.users (id) on delete cascade,
  game         text not null default 'blackjack' check (game in ('blackjack', 'craps')),
  display_name text not null default 'Guest',
  payload      jsonb not null,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  primary key (user_id, game)
);

create table if not exists public.runs (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  game              text not null default 'blackjack' check (game in ('blackjack', 'craps')),
  display_name      text not null default 'Guest',
  peak_bankroll     bigint not null check (peak_bankroll >= 0),
  -- Rounds for blackjack, shoots for craps: the game's own unit of play.
  rounds_played     integer not null check (rounds_played >= 0),
  -- Blackjack only. Craps has no single correct play to be graded against.
  strategy_accuracy double precision check (strategy_accuracy between 0 and 1),
  -- Craps only: most throws held in one shoot, the real craps brag.
  longest_roll      integer check (longest_roll >= 0),
  started_at        timestamptz not null,
  created_at        timestamptz not null default now()
);

-- The leaderboard is always read for one game, sorted by peak bankroll.
create index if not exists runs_game_peak_bankroll_idx
  on public.runs (game, peak_bankroll desc);

create index if not exists runs_user_idx on public.runs (user_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.runs     enable row level security;

-- A player may read and write only their own profile.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "own profile write" on public.profiles;
create policy "own profile write"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Runs are world-readable so the leaderboard works, but a player may only
-- insert rows attributed to themselves, and rows are immutable once written.
drop policy if exists "runs are public" on public.runs;
create policy "runs are public"
  on public.runs for select
  using (true);

drop policy if exists "insert own runs" on public.runs;
create policy "insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

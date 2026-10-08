-- Reinos del Caos — base de datos de cuentas, partidas y ranking.
-- Pégalo una vez en Supabase → SQL Editor → New query → Run.

-- Partida de cada jugador (solo la puede leer y guardar su dueño)
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  data       jsonb not null,
  saved_at   bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
drop policy if exists "leer mi partida" on public.saves;
drop policy if exists "crear mi partida" on public.saves;
drop policy if exists "guardar mi partida" on public.saves;
create policy "leer mi partida"    on public.saves for select using (auth.uid() = user_id);
create policy "crear mi partida"   on public.saves for insert with check (auth.uid() = user_id);
create policy "guardar mi partida" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ranking (todos lo ven, cada uno solo cambia su propia marca)
create table if not exists public.leaderboard (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  level      int not null default 1,
  power      int not null default 0,
  tower      int not null default 0,
  combo      int not null default 0,
  bosses     int not null default 0,
  rank       int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.leaderboard enable row level security;
drop policy if exists "ver ranking" on public.leaderboard;
drop policy if exists "crear mi marca" on public.leaderboard;
drop policy if exists "subir mi marca" on public.leaderboard;
create policy "ver ranking"    on public.leaderboard for select using (true);
create policy "crear mi marca" on public.leaderboard for insert with check (auth.uid() = user_id);
create policy "subir mi marca" on public.leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.leaderboard to anon, authenticated;
grant select, insert, update on public.saves, public.leaderboard to authenticated;

-- Perfil al inspeccionar: aura, mascota, dificultad y mundo alcanzado (añadido después)
alter table public.leaderboard add column if not exists look jsonb;

-- ════════════════════════════════════════════════════════════════════
-- Supply Generation Dashboard — esquema de base de datos (Supabase / Postgres)
-- Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá ("Run").
-- Es seguro re-ejecutarlo: usa IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ════════════════════════════════════════════════════════════════════

-- Extensión para generar UUIDs (suele venir activada en Supabase).
create extension if not exists "pgcrypto";

-- ── Tabla: weeks (la unidad central es la SEMANA) ────────────────────
create table if not exists public.weeks (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,            -- lunes de la semana
  insights    text not null default '',
  created_at  timestamptz not null default now()
);

-- ── Tabla: opportunities (búsquedas mostradas en la semana) ──────────
create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  week_id       uuid not null references public.weeks(id) on delete cascade,
  role          text not null default '',
  company       text not null default '',
  seniority     text not null default 'Junior'
                check (seniority in ('Junior', 'Semi-Senior', 'Senior')),
  applications  integer not null default 0,    -- postulaciones
  presented     integer not null default 0,    -- candidatos presentados
  confirmed     integer not null default 0,    -- candidatos confirmados
  date          date,                          -- opcional
  created_at    timestamptz not null default now()
);

-- ── Tabla: contents (piezas publicadas en la semana) ─────────────────
create table if not exists public.contents (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references public.weeks(id) on delete cascade,
  channel     text not null default 'LinkedIn'
              check (channel in ('LinkedIn', 'Instagram', 'TikTok')),
  title       text not null default '',
  views       integer not null default 0,
  url         text,                            -- opcional
  created_at  timestamptz not null default now()
);

-- ── Tabla puente: content_opportunities (relación muchos-a-muchos) ───
create table if not exists public.content_opportunities (
  content_id      uuid not null references public.contents(id) on delete cascade,
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  primary key (content_id, opportunity_id)
);

-- ── Índices ──────────────────────────────────────────────────────────
create index if not exists idx_opportunities_week  on public.opportunities(week_id);
create index if not exists idx_contents_week        on public.contents(week_id);
create index if not exists idx_co_content           on public.content_opportunities(content_id);
create index if not exists idx_co_opportunity       on public.content_opportunities(opportunity_id);
create index if not exists idx_weeks_week_start     on public.weeks(week_start desc);

-- ════════════════════════════════════════════════════════════════════
-- RLS "allow all" — es una herramienta interna pública, la anon key
-- (publishable) puede leer y escribir todo.
-- ════════════════════════════════════════════════════════════════════
alter table public.weeks                  enable row level security;
alter table public.opportunities          enable row level security;
alter table public.contents               enable row level security;
alter table public.content_opportunities  enable row level security;

-- weeks
drop policy if exists "allow all weeks" on public.weeks;
create policy "allow all weeks" on public.weeks
  for all to anon, authenticated using (true) with check (true);

-- opportunities
drop policy if exists "allow all opportunities" on public.opportunities;
create policy "allow all opportunities" on public.opportunities
  for all to anon, authenticated using (true) with check (true);

-- contents
drop policy if exists "allow all contents" on public.contents;
create policy "allow all contents" on public.contents
  for all to anon, authenticated using (true) with check (true);

-- content_opportunities
drop policy if exists "allow all content_opportunities" on public.content_opportunities;
create policy "allow all content_opportunities" on public.content_opportunities
  for all to anon, authenticated using (true) with check (true);

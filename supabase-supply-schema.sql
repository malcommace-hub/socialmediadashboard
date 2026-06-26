-- Seeds · Supply Generation Dashboard
-- Proyecto interárea Marketing × Attraction
-- Correr en el SQL Editor de Supabase (mismo proyecto que el dashboard de redes)

-- ─────────────────────────────────────────────
-- SEMANAS (una fila por semana; insights editoriales)
-- ─────────────────────────────────────────────
create table if not exists supply_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,   -- lunes de la semana (clave)
  insights text,                     -- 1-2 párrafos sobre la semana
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- OPORTUNIDADES (búsquedas mostradas en la semana)
-- ─────────────────────────────────────────────
create table if not exists supply_opportunities (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references supply_weeks(id) on delete cascade,
  name text not null,                -- nombre de la búsqueda / rol
  company text,                      -- empresa
  seniority text check (seniority in ('Junior', 'Semi-Senior', 'Senior')),
  opp_date date,
  applications int default 0,        -- postulaciones a esta oportunidad
  presented int default 0,           -- candidatos presentados
  confirmed int default 0,           -- candidatos confirmados
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- CONTENIDOS (piezas publicadas en la semana)
-- ─────────────────────────────────────────────
create table if not exists supply_contents (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references supply_weeks(id) on delete cascade,
  channel text check (channel in ('LinkedIn', 'Instagram', 'TikTok')),
  title text,
  views bigint default 0,
  url text,
  content_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- VÍNCULO contenido ↔ oportunidad (qué oportunidades se mostraron en cada pieza)
-- ─────────────────────────────────────────────
create table if not exists supply_content_opportunities (
  content_id uuid not null references supply_contents(id) on delete cascade,
  opportunity_id uuid not null references supply_opportunities(id) on delete cascade,
  primary key (content_id, opportunity_id)
);

create index if not exists idx_supply_opps_week on supply_opportunities(week_id);
create index if not exists idx_supply_contents_week on supply_contents(week_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (allow all — herramienta interna, protegida por env/deploy)
-- ─────────────────────────────────────────────
alter table supply_weeks enable row level security;
alter table supply_opportunities enable row level security;
alter table supply_contents enable row level security;
alter table supply_content_opportunities enable row level security;

create policy "allow all" on supply_weeks for all using (true) with check (true);
create policy "allow all" on supply_opportunities for all using (true) with check (true);
create policy "allow all" on supply_contents for all using (true) with check (true);
create policy "allow all" on supply_content_opportunities for all using (true) with check (true);

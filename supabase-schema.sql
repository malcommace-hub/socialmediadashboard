-- Seeds Social Media Dashboard
-- Run this in Supabase SQL Editor to set up the database

-- ─────────────────────────────────────────────
-- INSTAGRAM
-- ─────────────────────────────────────────────

create table if not exists instagram_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null, -- 1-12
  total_followers int default 0,
  new_followers int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  post_date date,
  type text check (type in ('Reel', 'Post', 'Collab', 'Story')),
  description text,
  views bigint default 0,
  impressions bigint default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  permalink text unique, -- deduplication key
  collab_account text, -- e.g. "@sofijobs"
  is_manual boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- LINKEDIN
-- ─────────────────────────────────────────────

create table if not exists linkedin_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  total_followers int default 0,
  new_followers int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

create table if not exists linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  post_date date,
  title text,
  impressions bigint default 0,
  interactions int default 0,
  er_decimal numeric(6,4) default 0, -- e.g. 0.0966 = 9.66%
  permalink text unique, -- deduplication key
  is_manual boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- TIKTOK
-- ─────────────────────────────────────────────

create table if not exists tiktok_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  total_followers int default 0,
  new_followers int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

create table if not exists tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  video_date date,
  title text,
  views bigint default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  permalink text unique, -- deduplication key
  is_manual boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- YOUTUBE
-- ─────────────────────────────────────────────

create table if not exists youtube_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  shorts_views bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

-- ─────────────────────────────────────────────
-- NEWSLETTER (LinkedIn Seeds Business Radar)
-- ─────────────────────────────────────────────

create table if not exists newsletter_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  new_subscribers int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

create table if not exists newsletter_episodes (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  episode_number int,
  title text,
  views bigint default 0,
  lead_magnet_downloads int default 0,
  published_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- WEB / WEBFLOW
-- ─────────────────────────────────────────────

create table if not exists web_monthly (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  total_sessions int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month)
);

create table if not exists web_utm_sources (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  source text not null, -- 'instagram', 'linkedin', 'tiktok', 'linktree', 'other'
  sessions int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, month, source)
);

-- ─────────────────────────────────────────────
-- OBJECTIVES (Q vs Q tracking)
-- ─────────────────────────────────────────────

create table if not exists objectives (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  quarter int not null check (quarter in (1,2,3,4)),
  channel text not null, -- 'instagram', 'linkedin', 'tiktok', 'youtube', 'web'
  metric text not null,  -- 'impressions', 'followers', 'er', 'views'
  target_value numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year, quarter, channel, metric)
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (allow all for now - single user)
-- ─────────────────────────────────────────────

alter table instagram_monthly enable row level security;
alter table instagram_posts enable row level security;
alter table linkedin_monthly enable row level security;
alter table linkedin_posts enable row level security;
alter table tiktok_monthly enable row level security;
alter table tiktok_videos enable row level security;
alter table youtube_monthly enable row level security;
alter table newsletter_monthly enable row level security;
alter table newsletter_episodes enable row level security;
alter table web_monthly enable row level security;
alter table web_utm_sources enable row level security;
alter table objectives enable row level security;

-- Public read/write policies (protected by env vars + deploy config)
-- For a single-user internal tool, we allow all from anon key
create policy "allow all" on instagram_monthly for all using (true) with check (true);
create policy "allow all" on instagram_posts for all using (true) with check (true);
create policy "allow all" on linkedin_monthly for all using (true) with check (true);
create policy "allow all" on linkedin_posts for all using (true) with check (true);
create policy "allow all" on tiktok_monthly for all using (true) with check (true);
create policy "allow all" on tiktok_videos for all using (true) with check (true);
create policy "allow all" on youtube_monthly for all using (true) with check (true);
create policy "allow all" on newsletter_monthly for all using (true) with check (true);
create policy "allow all" on newsletter_episodes for all using (true) with check (true);
create policy "allow all" on web_monthly for all using (true) with check (true);
create policy "allow all" on web_utm_sources for all using (true) with check (true);
create policy "allow all" on objectives for all using (true) with check (true);

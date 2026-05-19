-- Agrega campos para views/reach manual del mes en Instagram
-- Correr en Supabase SQL Editor

ALTER TABLE instagram_monthly
  ADD COLUMN IF NOT EXISTS total_views_manual bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reach_manual bigint DEFAULT 0;

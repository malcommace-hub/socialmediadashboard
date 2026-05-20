-- Seed: Instagram historical monthly data (Nov 2025 – Apr 2026)
-- Run AFTER supabase-migration-005.sql

INSERT INTO instagram_monthly (year, month, total_views_manual, total_interactions, avg_er)
VALUES
  (2025, 11, 1004800, 152000, 3.4000),
  (2025, 12, 1720000,  92000, 4.1000),
  (2026,  1, 1820000,  72500, 3.9000),
  (2026,  2, 2570000, 195200, 4.9200),
  (2026,  3, 1740000,  99000, 5.6800),
  (2026,  4, 1347000,  61200, 5.0400)
ON CONFLICT (year, month) DO UPDATE SET
  total_views_manual = EXCLUDED.total_views_manual,
  total_interactions = EXCLUDED.total_interactions,
  avg_er             = EXCLUDED.avg_er;

-- Seed: Instagram historical monthly data (Nov 2025 – May 2026)
-- Run AFTER supabase-migration-005.sql

INSERT INTO instagram_monthly (year, month, total_views_manual, total_interactions, avg_er, new_followers, total_followers)
VALUES
  (2025, 11, 1004800, 152000, 3.4000,  2400, 65863),
  (2025, 12, 1720000,  92000, 4.1000,  5500, 71363),
  (2026,  1, 1820000,  72500, 3.9000,  5300, 76663),
  (2026,  2, 2570000, 195200, 4.9200,  4200, 80863),
  (2026,  3, 1740000,  99000, 5.6800,  1648, 82511),
  (2026,  4, 1347000,  61200, 5.0400,  1675, 84186),
  (2026,  5,        0,      0,   NULL,  2198, 86384)
ON CONFLICT (year, month) DO UPDATE SET
  total_views_manual = EXCLUDED.total_views_manual,
  total_interactions = EXCLUDED.total_interactions,
  avg_er             = EXCLUDED.avg_er,
  new_followers      = EXCLUDED.new_followers,
  total_followers    = EXCLUDED.total_followers;

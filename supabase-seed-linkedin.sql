-- Seed: LinkedIn historical monthly data (Dec 2025 – Apr 2026)
-- Run AFTER supabase-migration-004.sql

INSERT INTO linkedin_monthly (year, month, new_followers, total_impressions, total_interactions, avg_er)
VALUES
  (2025, 12, 1520, 146390,  619,  6.0000),
  (2026,  1, 2305, 224181, 2305, 10.0000),
  (2026,  2,  994, 142872,  734,  6.5000),
  (2026,  3, 1118, 107298,  328, 13.4600),
  (2026,  4, 1500, 228000,  968,  9.6500)
ON CONFLICT (year, month) DO UPDATE SET
  new_followers      = EXCLUDED.new_followers,
  total_impressions  = EXCLUDED.total_impressions,
  total_interactions = EXCLUDED.total_interactions,
  avg_er             = EXCLUDED.avg_er;

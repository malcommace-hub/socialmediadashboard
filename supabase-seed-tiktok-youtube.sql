-- Seed: TikTok + YouTube Shorts historical monthly data (Jan – Apr 2026)
-- Requires migration-002 (total_views/total_interactions on tiktok_monthly) to be run first

-- TikTok
INSERT INTO tiktok_monthly (year, month, total_views, total_interactions, new_followers)
VALUES
  (2026, 1, 1200000, 54244, 1800),
  (2026, 2,  575000, 29050,  763),
  (2026, 3,  244000, 11800,  203),
  (2026, 4,  128000,  4870,  105)
ON CONFLICT (year, month) DO UPDATE SET
  total_views        = EXCLUDED.total_views,
  total_interactions = EXCLUDED.total_interactions,
  new_followers      = EXCLUDED.new_followers;

-- YouTube Shorts
INSERT INTO youtube_monthly (year, month, shorts_views)
VALUES
  (2026, 1, 14700),
  (2026, 2, 31300),
  (2026, 3, 18000),
  (2026, 4,  5200)
ON CONFLICT (year, month) DO UPDATE SET
  shorts_views = EXCLUDED.shorts_views;

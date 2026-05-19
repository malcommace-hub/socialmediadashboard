-- Migration 002: Add total_views and total_interactions to tiktok_monthly
-- Run in Supabase SQL Editor

ALTER TABLE tiktok_monthly
  ADD COLUMN IF NOT EXISTS total_views bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_interactions bigint DEFAULT 0;

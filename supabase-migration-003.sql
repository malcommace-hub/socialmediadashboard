-- Migration 003: Add aggregate totals to linkedin_monthly for manual historical entry
-- Run in Supabase SQL Editor

ALTER TABLE linkedin_monthly
  ADD COLUMN IF NOT EXISTS total_impressions bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_interactions bigint DEFAULT 0;

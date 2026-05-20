-- Migration 005: Add total_interactions and avg_er to instagram_monthly
-- Run BEFORE supabase-seed-instagram.sql

ALTER TABLE instagram_monthly
  ADD COLUMN IF NOT EXISTS total_interactions bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_er decimal(6,4) DEFAULT NULL;

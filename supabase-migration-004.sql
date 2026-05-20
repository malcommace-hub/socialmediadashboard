-- Migration 004: Add avg_er to linkedin_monthly for manual ER entry
-- Run BEFORE supabase-seed-linkedin.sql

ALTER TABLE linkedin_monthly
  ADD COLUMN IF NOT EXISTS avg_er decimal(6,4) DEFAULT NULL;

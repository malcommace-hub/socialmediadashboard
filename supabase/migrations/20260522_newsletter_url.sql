-- Add url column to newsletter_episodes for linking to published articles
ALTER TABLE newsletter_episodes ADD COLUMN IF NOT EXISTS url text;

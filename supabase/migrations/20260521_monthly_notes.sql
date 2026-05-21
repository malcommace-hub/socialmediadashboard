-- Monthly editorial notes ("En Seeds lo vemos")
-- Run manually via Supabase dashboard or psql before using the feature.

CREATE TABLE IF NOT EXISTS monthly_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL,
  content text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month)
);

CREATE TABLE featured_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL,
  channel text NOT NULL,
  post_url text,
  description text,
  views integer,
  er_pct numeric,
  editorial_note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON featured_content(year, month);

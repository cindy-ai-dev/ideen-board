CREATE TABLE IF NOT EXISTS boards (
  id text PRIMARY KEY,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boards_updated_at_idx ON boards (updated_at DESC);
CREATE INDEX IF NOT EXISTS boards_created_at_idx ON boards (created_at DESC);

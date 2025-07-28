CREATE TABLE IF NOT EXISTS trigger_state (
  workflow_id UUID PRIMARY KEY,
  state JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

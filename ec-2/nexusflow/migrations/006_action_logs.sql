CREATE TABLE IF NOT EXISTS action_logs (
  id SERIAL PRIMARY KEY,
  workflow_run_id UUID,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

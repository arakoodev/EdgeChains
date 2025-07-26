CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  final_output JSONB,
  error_details JSONB
);

CREATE TABLE IF NOT EXISTS workflow_merge_staging (
  id SERIAL PRIMARY KEY,
  workflow_run_id UUID NOT NULL,
  parent_job_id VARCHAR(255) NOT NULL,
  input_name VARCHAR(50) NOT NULL,
  item_index INTEGER NOT NULL,
  item_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_merge_staging_run_parent
  ON workflow_merge_staging (workflow_run_id, parent_job_id);

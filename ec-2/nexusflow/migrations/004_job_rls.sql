-- Enable row level security policies for per-job access

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- Allow selecting rows only when the session job_id matches
DROP POLICY IF EXISTS workflow_runs_by_job ON workflow_runs;
CREATE POLICY workflow_runs_by_job ON workflow_runs
  USING (id::text = current_setting('edgechains.job_id', true));


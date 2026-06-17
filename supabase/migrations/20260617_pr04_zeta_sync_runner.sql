create unique index if not exists idx_integration_sync_runs_one_active_per_stream
  on public.integration_sync_runs (organization_id, provider, stream)
  where status in ('queued', 'running');

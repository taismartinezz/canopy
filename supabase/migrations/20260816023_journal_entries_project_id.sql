-- Add project_id to journal_entries so entries can be scoped to a lab project.
-- This column has always been in schema.sql but was never applied as a migration.
-- After running this, PostgREST's schema cache must be reloaded so the column
-- becomes visible to the API (NOTIFY pgrst, 'reload schema' runs at the end).

alter table journal_entries
  add column if not exists project_id uuid references projects(id) on delete cascade;

-- Reload PostgREST schema cache so the new column is immediately visible.
notify pgrst, 'reload schema';

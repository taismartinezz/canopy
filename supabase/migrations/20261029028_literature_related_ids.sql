-- Add related_ids column to literature_items for cross-linking papers
alter table literature_items
  add column if not exists related_ids uuid[] not null default '{}';

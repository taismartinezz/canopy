-- Migration 012: Add volume and pages columns to literature_items.
-- These were present on LiteratureItem in TypeScript but had no backing DB column,
-- so Zotero-imported volume/issue and page ranges were silently dropped.

alter table literature_items
  add column if not exists volume text,
  add column if not exists pages  text;

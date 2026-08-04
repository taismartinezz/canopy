-- Migration 018: Add zotero_key to lit_annotations for idempotent re-sync.
--
-- When Zotero annotations are re-imported on a subsequent sync of the same
-- collection, they must upsert rather than create duplicates. The Zotero
-- annotation key (e.g. "K3QMXR7P") is stable for the lifetime of the
-- annotation item and makes a reliable dedup key.
--
-- NULL zotero_key means the annotation was created manually inside Canopy and
-- is unaffected by the unique constraint.

ALTER TABLE lit_annotations
  ADD COLUMN IF NOT EXISTS zotero_key varchar(128) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lit_annotations_item_zotero_key_unique
  ON lit_annotations (item_id, zotero_key)
  WHERE zotero_key IS NOT NULL;

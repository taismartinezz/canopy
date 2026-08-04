-- Migration 019: Add color column to lit_annotations.
--
-- lit_annotations was created before migrations were tracked here.
-- The color column stores a CSS hex string (e.g. "#FBBF24") matching Canopy's
-- five highlight colors. NULL means no color tag (plain comment or highlight
-- with no color assignment).
--
-- Idempotent: IF NOT EXISTS lets this run safely more than once.

ALTER TABLE lit_annotations
  ADD COLUMN IF NOT EXISTS color varchar(32) DEFAULT NULL;

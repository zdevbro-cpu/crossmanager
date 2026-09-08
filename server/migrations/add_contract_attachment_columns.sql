-- Migration: Add Firebase Storage columns to contracts table
-- Date: 2025-12-13
-- Purpose: Migrate contract attachments from JSONB to Firebase Storage

-- Add new columns for Firebase Storage file references
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS attachment_path TEXT,
ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contracts_attachment_path ON contracts(attachment_path);

-- Comment for documentation
COMMENT ON COLUMN contracts.attachment_path IS 'Firebase Storage path (e.g., contracts/{projectId}/{filename})';
COMMENT ON COLUMN contracts.attachment_size IS 'File size in bytes';
COMMENT ON COLUMN contracts.attachment_name IS 'Original filename';

-- Note: The existing 'attachment' JSONB column will be kept for backward compatibility
-- and can be removed in a future migration after data migration is complete

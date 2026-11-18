-- ======================================================================
-- SAAS Cabañas - Migration: Add 'resuelta' and 'cancelada' to maintenance_status_enum
-- Ensures compatibility with both feminine and masculine Spanish variations
-- ======================================================================

ALTER TYPE public.maintenance_status_enum ADD VALUE IF NOT EXISTS 'resuelta';
ALTER TYPE public.maintenance_status_enum ADD VALUE IF NOT EXISTS 'cancelada';

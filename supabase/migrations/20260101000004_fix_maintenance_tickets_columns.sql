-- ======================================================================
-- SAAS Cabañas - Migration: Add missing columns and relax nullability on maintenance_tickets
-- Ensures incident reports from Reception and Admin can be stored with area names,
-- estimated/actual costs, supplier assignment, and allows nullable cabin_id for common areas.
-- ======================================================================

ALTER TABLE public.maintenance_tickets ALTER COLUMN cabin_id DROP NOT NULL;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS area_name TEXT;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS cost_estimated_ars NUMERIC(12,2);
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS cost_actual_ars NUMERIC(12,2);

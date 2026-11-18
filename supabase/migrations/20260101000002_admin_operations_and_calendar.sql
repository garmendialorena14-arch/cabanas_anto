-- ======================================================================
-- SAAS Cabañas - Migration: Admin Operations, Calendar, Holidays & Reallocation Audit
-- ======================================================================

-- 1. ADD ACCESSIBILITY COLUMNS TO RESERVATIONS
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS has_reduced_mobility BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobility_notes TEXT;

-- 2. EXTEND HOLIDAY_EXCEPTIONS FOR SPECIAL DATES & API HOLIDAYS
ALTER TABLE public.holiday_exceptions
  ADD COLUMN IF NOT EXISTS rate_multiplier NUMERIC(4,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS min_nights INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_official_api BOOLEAN DEFAULT false;

-- 3. ENABLE RLS ON SEASON_CONFIG & HOLIDAY_EXCEPTIONS (Fixing Supabase security advisory)
ALTER TABLE public.season_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "season_config_read" ON public.season_config;
CREATE POLICY "season_config_read" ON public.season_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "season_config_modify" ON public.season_config;
CREATE POLICY "season_config_modify" ON public.season_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "holiday_exceptions_read" ON public.holiday_exceptions;
CREATE POLICY "holiday_exceptions_read" ON public.holiday_exceptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "holiday_exceptions_modify" ON public.holiday_exceptions;
CREATE POLICY "holiday_exceptions_modify" ON public.holiday_exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. CREATE RESERVATION_CHANGES AUDIT TABLE (Movimientos, Reubicaciones y Modificaciones con Motivo Obligatorio)
CREATE TABLE IF NOT EXISTS public.reservation_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    previous_cabin_id UUID REFERENCES public.cabins(id),
    new_cabin_id UUID REFERENCES public.cabins(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('reubicacion', 'fechas', 'pax', 'general')),
    reason TEXT NOT NULL,
    accessibility_warning_accepted BOOLEAN NOT NULL DEFAULT false,
    previous_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservation_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservation_changes_select" ON public.reservation_changes;
CREATE POLICY "reservation_changes_select" ON public.reservation_changes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reservation_changes_insert" ON public.reservation_changes;
CREATE POLICY "reservation_changes_insert" ON public.reservation_changes FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_exceptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_config TO authenticated;
GRANT SELECT, INSERT ON public.reservation_changes TO authenticated;

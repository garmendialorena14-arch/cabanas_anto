-- ======================================================================
-- SAAS Cabañas - Migration: Enable Maintenance Management for Reception and Admins
-- Allows both Reception staff and Administrators to report, view, and update
-- maintenance tickets (cabins, pool, common areas) and preventive maintenance (pool chemicals/facilities).
-- ======================================================================

-- 1. POLICIES FOR MAINTENANCE TICKETS
DROP POLICY IF EXISTS "maintenance_select" ON public.maintenance_tickets;
CREATE POLICY "maintenance_select" ON public.maintenance_tickets FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));

DROP POLICY IF EXISTS "maintenance_insert" ON public.maintenance_tickets;
CREATE POLICY "maintenance_insert" ON public.maintenance_tickets FOR INSERT TO authenticated 
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));

DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_tickets;
CREATE POLICY "maintenance_update" ON public.maintenance_tickets FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));

-- 2. POLICIES FOR PREVENTIVE MAINTENANCE (Control Pileta y Áreas Comunes)
DROP POLICY IF EXISTS "preventive_select" ON public.preventive_maintenance;
CREATE POLICY "preventive_select" ON public.preventive_maintenance FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));

DROP POLICY IF EXISTS "preventive_modify" ON public.preventive_maintenance;
CREATE POLICY "preventive_modify" ON public.preventive_maintenance FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento')) 
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));

-- 3. GRANTS
GRANT SELECT, INSERT, UPDATE ON public.maintenance_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.preventive_maintenance TO authenticated;

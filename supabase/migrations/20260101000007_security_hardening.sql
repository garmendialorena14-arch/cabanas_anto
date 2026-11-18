-- ======================================================================
-- SAAS Cabañas Anto - Migración de Hardening y Blindaje de Seguridad
-- Archivo: 20260101000007_security_hardening.sql
-- Cumplimiento de Skill: auditor-seguridad-apps
-- ======================================================================

-- 1. Habilitar RLS en reservation_changes y restringir acceso a staff autorizado
ALTER TABLE IF EXISTS public.reservation_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservation_changes_insert_all ON public.reservation_changes;
DROP POLICY IF EXISTS reservation_changes_select_all ON public.reservation_changes;
DROP POLICY IF EXISTS reservation_changes_staff_all ON public.reservation_changes;

CREATE POLICY reservation_changes_staff_all ON public.reservation_changes
FOR ALL TO authenticated
USING (get_current_user_role() = ANY (ARRAY['dueno'::user_role_enum, 'admin'::user_role_enum, 'recepcion'::user_role_enum]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['dueno'::user_role_enum, 'admin'::user_role_enum, 'recepcion'::user_role_enum]));

-- 2. Proteger reservas de huéspedes (Eliminar select y update anónimos)
DROP POLICY IF EXISTS reservations_select_anon ON public.reservations;
DROP POLICY IF EXISTS reservations_update_anon ON public.reservations;

-- 3. Proteger datos de contacto de prospectos/leads (Eliminar lectura y edición anónima)
-- La inserción (leads_insert_anon_and_staff) se conserva para que el formulario web funcione
DROP POLICY IF EXISTS leads_select_anon ON public.leads;
DROP POLICY IF EXISTS leads_update_anon ON public.leads;

-- 4. Blindar cotizaciones, feriados y temporadas operativas
DROP POLICY IF EXISTS exchange_rates_modify_anon ON public.exchange_rates;
DROP POLICY IF EXISTS holiday_exceptions_modify_anon ON public.holiday_exceptions;
DROP POLICY IF EXISTS season_config_modify_anon ON public.season_config;

-- 5. Proteger logs de auditoría interna
DROP POLICY IF EXISTS audit_logs_anon_read_write ON public.audit_logs;

-- 6. Blindar conexiones del Bot de Telegram (Solo Dueño y Admin autenticados)
DROP POLICY IF EXISTS channel_connections_anon_all ON public.channel_connections;
DROP POLICY IF EXISTS channel_connections_select ON public.channel_connections;
REVOKE ALL ON public.channel_connections FROM anon;

-- 7. Resolver advertencia de Security Advisor sobre funciones SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;

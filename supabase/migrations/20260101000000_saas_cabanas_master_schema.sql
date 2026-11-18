-- ======================================================================
-- SAAS Cabañas - Master Database Schema Migration
-- Unified Architecture with Strict RLS, RBAC, PII Data Masking,
-- Bank Accounts (ARS & USD) & Mobility Assistance
-- ======================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('dueno', 'recepcion', 'maestranza', 'mantenimiento');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cabin_floor_enum AS ENUM ('PB', 'PA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE lead_source_enum AS ENUM ('web', 'email', 'manual', 'telegram', 'telefono', 'otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE lead_status_enum AS ENUM ('nuevo', 'contactado', 'cotizado', 'reservado', 'descartado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status_enum AS ENUM ('solicitada', 'senada', 'confirmada', 'checkin', 'checkout', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_concept_enum AS ENUM ('sena', 'saldo', 'adicional', 'deposito_garantia', 'reembolso');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('transferencia_ars', 'efectivo_ars', 'efectivo_usd', 'tarjeta', 'mercadopago');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE supplier_category_enum AS ENUM ('lavanderia', 'amenities_limpieza', 'desayunos_sin_tacc', 'mantenimiento_pileta', 'electricidad_gas', 'plomeria', 'blanquería_compra', 'otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE housekeeping_item_cat_enum AS ENUM ('toallas_bano', 'toallas_pileta', 'sabanas', 'amenities_jabones', 'limpieza_quimicos', 'desayuno');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE loan_status_enum AS ENUM ('prestado', 'devuelto', 'extraviado_danado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_priority_enum AS ENUM ('baja', 'media', 'alta', 'urgente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_status_enum AS ENUM ('pendiente', 'en_progreso', 'resuelta', 'cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE bank_currency_enum AS ENUM ('ARS', 'USD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. CABINS (12 unidades exactas del predio)
CREATE TABLE IF NOT EXISTS public.cabins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabin_number INT UNIQUE NOT NULL CHECK (cabin_number BETWEEN 1 AND 12),
    name TEXT NOT NULL,
    floor cabin_floor_enum NOT NULL,
    max_guests INT NOT NULL CHECK (max_guests BETWEEN 1 AND 8),
    has_accessible_mobility BOOLEAN NOT NULL DEFAULT false,
    base_rate_usd NUMERIC(10,2) NOT NULL CHECK (base_rate_usd > 0),
    description TEXT,
    amenities TEXT[] DEFAULT '{}',
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PARKING SPOTS (12 cocheras cubiertas, regla 1:1)
CREATE TABLE IF NOT EXISTS public.parking_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_number INT UNIQUE NOT NULL CHECK (spot_number BETWEEN 1 AND 12),
    cabin_id UUID REFERENCES public.cabins(id) ON DELETE SET NULL,
    is_occupied BOOLEAN NOT NULL DEFAULT false,
    current_license_plate TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. LIVE EXCHANGE RATES (USD / Dólar Blue)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_pair TEXT NOT NULL DEFAULT 'USD_ARS_BLUE',
    buy_rate NUMERIC(12,2) NOT NULL CHECK (buy_rate > 0),
    sell_rate NUMERIC(12,2) NOT NULL CHECK (sell_rate > 0),
    source TEXT NOT NULL DEFAULT 'dolarapi.com',
    is_manual_override BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. USER PROFILES & RBAC (Conectado a auth.users y 2FA/MFA)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'recepcion',
    phone TEXT,
    pin_quick_access TEXT,
    mfa_enforced BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function: Obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role_enum AS $$
DECLARE
    v_role_txt text;
BEGIN
    SELECT role::text INTO v_role_txt
    FROM public.user_profiles
    WHERE id = auth.uid() AND is_active = true;

    IF v_role_txt IS NULL THEN
        SELECT (raw_user_meta_data->>'role') INTO v_role_txt
        FROM auth.users
        WHERE id = auth.uid();
    END IF;

    IF v_role_txt = 'admin' THEN
        RETURN 'dueno'::public.user_role_enum;
    ELSIF v_role_txt IN ('dueno', 'recepcion', 'maestranza', 'mantenimiento') THEN
        RETURN v_role_txt::public.user_role_enum;
    ELSE
        RETURN NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. CLIENTS (CRM de Huéspedes con Alerta de Movilidad y Dietas)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni_passport TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    city_country TEXT,
    has_reduced_mobility BOOLEAN NOT NULL DEFAULT false,
    mobility_notes TEXT,
    has_celiac_sin_tacc BOOLEAN NOT NULL DEFAULT false,
    dietary_notes TEXT,
    vip_status BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. BANK ACCOUNTS (Cuentas Bancarias Oficiales en ARS y USD para Cobro de Señas/Saldos)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency bank_currency_enum NOT NULL DEFAULT 'ARS',
    bank_name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'Caja de Ahorro',
    account_number TEXT,
    cbu_cvu TEXT NOT NULL,
    alias TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    cuit_cuil TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. LEADS (Base de Interesados con Asistencia de Movilidad)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    contact_phone TEXT,
    contact_email TEXT,
    source lead_source_enum NOT NULL DEFAULT 'web',
    desired_check_in DATE,
    desired_check_out DATE,
    pax_count INT DEFAULT 2,
    cabin_preference_id UUID REFERENCES public.cabins(id) ON DELETE SET NULL,
    has_reduced_mobility BOOLEAN NOT NULL DEFAULT false,
    mobility_notes TEXT,
    budget_estimated_usd NUMERIC(10,2),
    status lead_status_enum NOT NULL DEFAULT 'nuevo',
    converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    telegram_chat_id BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. RESERVATIONS (Motor Bimonetario con Reglas de Congelamiento)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabin_id UUID NOT NULL REFERENCES public.cabins(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guest_count INT NOT NULL CHECK (guest_count >= 1),
    status reservation_status_enum NOT NULL DEFAULT 'solicitada',
    
    -- Tarifario Bimonetario
    daily_rate_usd NUMERIC(10,2) NOT NULL CHECK (daily_rate_usd > 0),
    total_nights INT NOT NULL CHECK (total_nights > 0),
    total_usd NUMERIC(12,2) NOT NULL CHECK (total_usd > 0),
    blue_rate_at_booking NUMERIC(12,2) NOT NULL CHECK (blue_rate_at_booking > 0),
    total_ars_at_booking NUMERIC(14,2) NOT NULL CHECK (total_ars_at_booking > 0),
    
    -- Seña: Congela únicamente el porcentaje abonado en USD
    sena_percentage NUMERIC(5,2) NOT NULL DEFAULT 30.00 CHECK (sena_percentage BETWEEN 10 AND 100),
    sena_usd_required NUMERIC(12,2) NOT NULL,
    sena_paid_ars NUMERIC(14,2) NOT NULL DEFAULT 0,
    sena_paid_usd_equiv NUMERIC(12,2) NOT NULL DEFAULT 0,
    sena_blue_rate NUMERIC(12,2),
    sena_paid_at TIMESTAMPTZ,
    
    -- Saldo: En USD billete o pesificado al check-in
    balance_pending_usd NUMERIC(12,2) NOT NULL,
    balance_paid_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
    balance_paid_ars NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance_blue_rate_at_checkin NUMERIC(12,2),
    balance_paid_at TIMESTAMPTZ,
    
    -- Operatividad
    parking_spot_number INT CHECK (parking_spot_number BETWEEN 1 AND 12),
    vehicle_license_plate TEXT,
    breakfast_included BOOLEAN NOT NULL DEFAULT true,
    has_celiac_sin_tacc BOOLEAN NOT NULL DEFAULT false,
    dietary_notes TEXT,
    has_reduced_mobility BOOLEAN NOT NULL DEFAULT false,
    mobility_notes TEXT,
    internal_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reservation_dates CHECK (check_out_date > check_in_date)
);

-- 11. PAYMENTS (Transacciones & Comprobantes)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    concept payment_concept_enum NOT NULL,
    amount_ars NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
    applied_blue_rate NUMERIC(12,2) NOT NULL,
    payment_method payment_method_enum NOT NULL,
    payment_reference TEXT,
    receipt_url TEXT,
    registered_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. SUPPLIERS (Proveedores)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    contact_name TEXT,
    category supplier_category_enum NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    cuit TEXT,
    address TEXT,
    payment_terms TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. HOUSEKEEPING INVENTORY (Maestranza, Toallas, Jabones, Blanquería)
CREATE TABLE IF NOT EXISTS public.housekeeping_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    category housekeeping_item_cat_enum NOT NULL,
    unit TEXT NOT NULL DEFAULT 'unidades',
    stock_depot INT NOT NULL DEFAULT 0 CHECK (stock_depot >= 0),
    min_alert_threshold INT NOT NULL DEFAULT 10 CHECK (min_alert_threshold >= 0),
    preferred_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. HOUSEKEEPING LOGS (Recambio de toallas c/ 3 días)
CREATE TABLE IF NOT EXISTS public.housekeeping_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabin_id UUID NOT NULL REFERENCES public.cabins(id),
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bath_towels_changed INT NOT NULL DEFAULT 0 CHECK (bath_towels_changed >= 0),
    hand_towels_changed INT NOT NULL DEFAULT 0 CHECK (hand_towels_changed >= 0),
    bed_sheets_changed INT NOT NULL DEFAULT 0 CHECK (bed_sheets_changed >= 0),
    amenities_replenished BOOLEAN NOT NULL DEFAULT true,
    cleaning_status TEXT NOT NULL DEFAULT 'completada' CHECK (cleaning_status IN ('pendiente', 'en_curso', 'completada', 'inspeccionada')),
    performed_by UUID REFERENCES auth.users(id),
    observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. POOL & BEACH LOANS (Toallones de pileta & Reposeras)
CREATE TABLE IF NOT EXISTS public.pool_beach_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    cabin_id UUID NOT NULL REFERENCES public.cabins(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('toallon_pileta', 'reposera', 'sombrilla')),
    quantity INT NOT NULL CHECK (quantity > 0),
    status loan_status_enum NOT NULL DEFAULT 'prestado',
    loaned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    returned_at TIMESTAMPTZ,
    notes TEXT,
    handled_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. MAINTENANCE TICKETS (Averías y Reparaciones)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabin_id UUID REFERENCES public.cabins(id) ON DELETE SET NULL,
    area_name TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority maintenance_priority_enum NOT NULL DEFAULT 'media',
    status maintenance_status_enum NOT NULL DEFAULT 'pendiente',
    assigned_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    cost_estimated_ars NUMERIC(12,2),
    cost_actual_ars NUMERIC(12,2),
    reported_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. PREVENTIVE MAINTENANCE (Control Pileta y Áreas Comunes)
CREATE TABLE IF NOT EXISTS public.preventive_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    facility TEXT NOT NULL CHECK (facility IN ('pileta', 'quincho', 'bombas_riego', 'termotanques')),
    ph_level NUMERIC(4,2),
    chlorine_level NUMERIC(4,2),
    water_temp_celsius NUMERIC(4,1),
    filter_status TEXT,
    observations TEXT,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. AUDIT LOGS (Inmutable append-only security trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ======================================================================
-- SEGURIDAD: DATA MASKING & VISTAS OPERATIVAS (Cumplimiento Auditoría)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.mask_dni(dni TEXT)
RETURNS TEXT AS $$
BEGIN
    IF dni IS NULL OR length(dni) < 4 THEN
        RETURN '***';
    END IF;
    RETURN LEFT(dni, 2) || repeat('*', length(dni) - 4) || RIGHT(dni, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.mask_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
    IF phone IS NULL OR length(phone) < 6 THEN
        RETURN '****';
    END IF;
    RETURN LEFT(phone, 4) || repeat('*', length(phone) - 6) || RIGHT(phone, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vista segura para Maestranza y Personal Operativo (security_invoker = true)
CREATE OR REPLACE VIEW public.v_operational_reservations
WITH (security_invoker = true) AS
SELECT 
    r.id,
    r.cabin_id,
    c.cabin_number,
    c.name AS cabin_name,
    c.floor AS cabin_floor,
    cl.full_name AS guest_name,
    public.mask_dni(cl.dni_passport) AS masked_dni,
    public.mask_phone(cl.phone) AS masked_phone,
    r.guest_count,
    r.check_in_date,
    r.check_out_date,
    r.status,
    r.parking_spot_number,
    r.vehicle_license_plate,
    r.breakfast_included,
    r.has_celiac_sin_tacc,
    r.dietary_notes,
    cl.has_reduced_mobility,
    cl.mobility_notes,
    r.created_at
FROM public.reservations r
JOIN public.cabins c ON c.id = r.cabin_id
JOIN public.clients cl ON cl.id = r.client_id;

-- ======================================================================
-- AUDITORÍA AUTOMATIZADA POR TRIGGERS
-- ======================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_log_record()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity,
        entity_id,
        old_data,
        new_data
    ) VALUES (
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id)::TEXT,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_reservations ON public.reservations;
CREATE TRIGGER trg_audit_reservations
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_record();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_record();

DROP TRIGGER IF EXISTS trg_audit_exchange_rates ON public.exchange_rates;
CREATE TRIGGER trg_audit_exchange_rates
    AFTER INSERT OR UPDATE ON public.exchange_rates
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_record();

DROP TRIGGER IF EXISTS trg_audit_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_audit_bank_accounts
    AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_record();

-- ======================================================================
-- ROW LEVEL SECURITY (RLS) - DEFAULT DENY & GRANULAR POLICIES
-- ======================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_dni(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_phone(TEXT) TO authenticated;

-- Activar RLS en todas las tablas
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_beach_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Grants de tablas
GRANT SELECT ON public.cabins TO anon, authenticated;
GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT INSERT ON public.reservations TO anon;
GRANT INSERT ON public.clients TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabins TO authenticated;
GRANT SELECT, UPDATE ON public.parking_spots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exchange_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_beach_loans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preventive_maintenance TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.v_operational_reservations TO authenticated;

-- BANK ACCOUNTS POLICIES
CREATE POLICY "bank_accounts_select_staff" ON public.bank_accounts FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion'));

CREATE POLICY "bank_accounts_dueno_crud" ON public.bank_accounts FOR ALL TO authenticated
    USING (public.get_current_user_role() = 'dueno')
    WITH CHECK (public.get_current_user_role() = 'dueno');

-- CABINS
CREATE POLICY "cabins_select_policy" ON public.cabins FOR SELECT TO anon, authenticated
    USING (is_active = true OR public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "cabins_dueno_insert" ON public.cabins FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() = 'dueno');
CREATE POLICY "cabins_dueno_update" ON public.cabins FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'dueno') WITH CHECK (public.get_current_user_role() = 'dueno');
CREATE POLICY "cabins_dueno_delete" ON public.cabins FOR DELETE TO authenticated
    USING (public.get_current_user_role() = 'dueno');

-- PARKING SPOTS
CREATE POLICY "parking_select_policy" ON public.parking_spots FOR SELECT TO authenticated USING (true);
CREATE POLICY "parking_update_policy" ON public.parking_spots FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));

-- EXCHANGE RATES
CREATE POLICY "exchange_select_policy" ON public.exchange_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "exchange_dueno_insert" ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "exchange_dueno_update" ON public.exchange_rates FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'dueno') WITH CHECK (public.get_current_user_role() = 'dueno');

-- USER PROFILES
CREATE POLICY "profiles_select_own_or_admin" ON public.user_profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.get_current_user_role() = 'dueno');
CREATE POLICY "profiles_update_own" ON public.user_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.get_current_user_role() = 'dueno')
    WITH CHECK (public.get_current_user_role() = 'dueno' OR (id = auth.uid() AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid())));
CREATE POLICY "profiles_insert_dueno" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() = 'dueno');

-- CLIENTS
CREATE POLICY "clients_select_staff" ON public.clients FOR SELECT TO authenticated USING (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "clients_insert_all" ON public.clients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "clients_update_staff" ON public.clients FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));

-- LEADS
CREATE POLICY "leads_insert_anon_and_staff" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "leads_select_staff" ON public.leads FOR SELECT TO authenticated USING (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "leads_update_staff" ON public.leads FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "leads_delete_dueno" ON public.leads FOR DELETE TO authenticated USING (public.get_current_user_role() = 'dueno');

-- RESERVATIONS
CREATE POLICY "reservations_select_staff" ON public.reservations FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza'));
CREATE POLICY "reservations_insert_policy" ON public.reservations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "reservations_update_staff" ON public.reservations FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "reservations_delete_dueno" ON public.reservations FOR DELETE TO authenticated USING (public.get_current_user_role() = 'dueno');

-- PAYMENTS
CREATE POLICY "payments_select_staff" ON public.payments FOR SELECT TO authenticated USING (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "payments_insert_staff" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion'));
CREATE POLICY "payments_update_dueno" ON public.payments FOR UPDATE TO authenticated
    USING (public.get_current_user_role() = 'dueno') WITH CHECK (public.get_current_user_role() = 'dueno');

-- SUPPLIERS
CREATE POLICY "suppliers_select_staff" ON public.suppliers FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));
CREATE POLICY "suppliers_dueno_crud" ON public.suppliers FOR ALL TO authenticated
    USING (public.get_current_user_role() = 'dueno') WITH CHECK (public.get_current_user_role() = 'dueno');

-- HOUSEKEEPING INVENTORY & LOGS
CREATE POLICY "housekeeping_inv_select" ON public.housekeeping_inventory FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza'));
CREATE POLICY "housekeeping_inv_modify" ON public.housekeeping_inventory FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'maestranza')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'maestranza'));
CREATE POLICY "housekeeping_logs_select" ON public.housekeeping_logs FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza'));
CREATE POLICY "housekeeping_logs_insert" ON public.housekeeping_logs FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('dueno', 'maestranza'));

-- POOL BEACH LOANS
CREATE POLICY "pool_loans_select" ON public.pool_beach_loans FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza'));
CREATE POLICY "pool_loans_modify" ON public.pool_beach_loans FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion', 'maestranza'));

-- MAINTENANCE TICKETS
CREATE POLICY "maintenance_select" ON public.maintenance_tickets FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));
CREATE POLICY "maintenance_insert" ON public.maintenance_tickets FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('dueno', 'recepcion', 'mantenimiento'));
CREATE POLICY "maintenance_update" ON public.maintenance_tickets FOR UPDATE TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'mantenimiento')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'mantenimiento'));

-- PREVENTIVE MAINTENANCE
CREATE POLICY "preventive_select" ON public.preventive_maintenance FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'mantenimiento'));
CREATE POLICY "preventive_modify" ON public.preventive_maintenance FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('dueno', 'mantenimiento')) WITH CHECK (public.get_current_user_role() IN ('dueno', 'mantenimiento'));

-- AUDIT LOGS (Append-only)
CREATE POLICY "audit_select_dueno" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_current_user_role() = 'dueno');
CREATE POLICY "audit_insert_any_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ======================================================================
-- SEGURIDAD ADICIONAL: PROTEGER TABLAS LEGACY (Auditoría de Seguridad)
-- ======================================================================
ALTER TABLE IF EXISTS public.season_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.holiday_exceptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.season_config TO anon, authenticated;
GRANT SELECT ON public.holiday_exceptions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.season_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holiday_exceptions TO authenticated;

DROP POLICY IF EXISTS "season_config_read_all" ON public.season_config;
CREATE POLICY "season_config_read_all" ON public.season_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "season_config_modify_dueno" ON public.season_config;
CREATE POLICY "season_config_modify_dueno" ON public.season_config FOR ALL TO authenticated
    USING (public.get_current_user_role() = 'dueno')
    WITH CHECK (public.get_current_user_role() = 'dueno');

DROP POLICY IF EXISTS "holiday_exceptions_read_all" ON public.holiday_exceptions;
CREATE POLICY "holiday_exceptions_read_all" ON public.holiday_exceptions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "holiday_exceptions_modify_dueno" ON public.holiday_exceptions;
CREATE POLICY "holiday_exceptions_modify_dueno" ON public.holiday_exceptions FOR ALL TO authenticated
    USING (public.get_current_user_role() = 'dueno')
    WITH CHECK (public.get_current_user_role() = 'dueno');


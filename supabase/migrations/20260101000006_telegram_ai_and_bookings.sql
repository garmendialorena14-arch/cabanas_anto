-- ======================================================================
-- SAAS Cabañas - Migración: Telegram Bot, Asistentes IA, CRM & Reservas
-- Versión: 20260101000006
-- ======================================================================

-- 1. TABLA: channel_connections (Conexión del Bot de Telegram)
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_type TEXT NOT NULL DEFAULT 'telegram' CHECK (channel_type IN ('telegram', 'whatsapp')),
    bot_token TEXT NOT NULL,
    bot_username TEXT,
    webhook_url TEXT,
    webhook_secret TEXT,
    owner_chat_id TEXT, -- ID o Username de Telegram autorizado para el asistente privado
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA: assistants (Asistentes de Inteligencia Artificial Especializados)
CREATE TABLE IF NOT EXISTS public.assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role_description TEXT,
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLA: contacts (Contactos / Huéspedes de Canales de Mensajería)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT,
    external_id TEXT NOT NULL UNIQUE, -- Telegram Chat ID o User ID
    channel TEXT NOT NULL DEFAULT 'telegram',
    username TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLA: conversations (Hilos de conversación CRM con estado de control)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active', 'human_takeover')),
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABLA: messages (Mensajes individuales del chat)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant', 'human_agent')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABLA: bookings (Gestión de Reservas generadas o consultadas por el canal)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    cabin_name TEXT NOT NULL,
    cabin_id UUID REFERENCES public.cabins(id) ON DELETE SET NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests_count INT NOT NULL DEFAULT 2 CHECK (guests_count >= 1),
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'ARS',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_dates CHECK (check_out > check_in)
);

-- Índices para optimizar búsquedas rápidas en el Webhook y CRM
CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON public.contacts(external_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(check_in, check_out);

-- ======================================================================
-- SEGURIDAD & POLÍTICAS RLS (Para admin y recepcion)
-- ======================================================================

ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Permisos de lectura/escritura para roles autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;

-- Permisos para Webhooks backend (anon fallback seguro)
GRANT SELECT ON public.channel_connections TO anon;
GRANT SELECT ON public.assistants TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contacts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO anon;
GRANT SELECT, INSERT ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO anon;

-- POLÍTICAS: channel_connections
DROP POLICY IF EXISTS "channel_connections_select" ON public.channel_connections;
CREATE POLICY "channel_connections_select" ON public.channel_connections 
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "channel_connections_admin_all" ON public.channel_connections;
CREATE POLICY "channel_connections_admin_all" ON public.channel_connections 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin'));

-- POLÍTICAS: assistants
DROP POLICY IF EXISTS "assistants_select" ON public.assistants;
CREATE POLICY "assistants_select" ON public.assistants 
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "assistants_admin_all" ON public.assistants;
CREATE POLICY "assistants_admin_all" ON public.assistants 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin'));

-- POLÍTICAS: contacts
DROP POLICY IF EXISTS "contacts_staff_all" ON public.contacts;
CREATE POLICY "contacts_staff_all" ON public.contacts 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'));

DROP POLICY IF EXISTS "contacts_webhook_access" ON public.contacts;
CREATE POLICY "contacts_webhook_access" ON public.contacts 
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- POLÍTICAS: conversations
DROP POLICY IF EXISTS "conversations_staff_all" ON public.conversations;
CREATE POLICY "conversations_staff_all" ON public.conversations 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'));

DROP POLICY IF EXISTS "conversations_webhook_access" ON public.conversations;
CREATE POLICY "conversations_webhook_access" ON public.conversations 
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- POLÍTICAS: messages
DROP POLICY IF EXISTS "messages_staff_all" ON public.messages;
CREATE POLICY "messages_staff_all" ON public.messages 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'));

DROP POLICY IF EXISTS "messages_webhook_access" ON public.messages;
CREATE POLICY "messages_webhook_access" ON public.messages 
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- POLÍTICAS: bookings
DROP POLICY IF EXISTS "bookings_staff_all" ON public.bookings;
CREATE POLICY "bookings_staff_all" ON public.bookings 
    FOR ALL TO authenticated 
    USING (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'))
    WITH CHECK (public.get_current_user_role() IN ('dueno', 'admin', 'recepcion'));

DROP POLICY IF EXISTS "bookings_webhook_access" ON public.bookings;
CREATE POLICY "bookings_webhook_access" ON public.bookings 
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ======================================================================
-- SEED DE ASISTENTES ESPECIALIZADOS
-- ======================================================================

INSERT INTO public.assistants (name, role_description, model, is_active, system_prompt)
VALUES 
(
    'Reservas y Disponibilidad',
    'Especialista en verificar fechas, cotizar estadías y registrar datos de reservas de cabañas.',
    'gemini-2.5-flash',
    true,
    'Eres el Asistente Virtual Oficial de "Complejo de Cabañas Anto", ubicado en un entorno natural privilegiado.
Tu objetivo es brindar una atención cálida, profesional y ágil a huéspedes interesados en reservar.
El complejo cuenta con 12 cabañas totalmente equipadas (Cabañas 1 a 12).
Las cabañas de Planta Baja cuentan con accesibilidad para personas con movilidad reducida.
El check-in es a las 14:00 hs y el check-out es a las 10:00 hs.
Todas las estadías incluyen cochera cubierta individual, desayuno artesanal (con opciones sin TACC para celíacos previo aviso), ropa blanca, pileta y WiFi.
Cuando un usuario pregunte por disponibilidad:
1. Pregunta amablemente fecha de ingreso (check-in), egreso (check-out) y cantidad de personas (adultos y niños).
2. Si tiene alguna persona con movilidad reducida o celiaquía, indícale que contamos con unidades adaptadas y opciones seguras.
3. Si el usuario solicita un humano o no puede resolver su inquietud, indícale cordialmente que un recepcionista continuará la conversación.'
),
(
    'Consultas Generales y FAQ',
    'Responde dudas sobre servicios, ubicación, políticas de mascotas, horarios y servicios incluidos.',
    'gemini-2.5-flash',
    true,
    'Eres el Asistente de Consultas Frecuentes de "Complejo de Cabañas Anto".
Responde con amabilidad, precisión y brevedad.
Datos clave del complejo:
- Horarios: Check-in desde las 14:00 hs. Check-out hasta las 10:00 hs.
- Desayuno: Servido en la cabaña o desayunador de 08:00 a 10:30 hs. Contamos con vajilla y opciones exclusivas Sin TACC / Celíacos.
- Pileta y Solárium: Abierta de 09:00 a 20:00 hs en temporada.
- Cocheras: Cubiertas dentro del predio cerrado, una por cabaña numerada de 1 a 12.
- Mascotas: Se aceptan mascotas educadas de tamaño pequeño/mediano con previo aviso y cargo de limpieza adicional.
- Ubicación: Zona de fácil acceso, ambiente tranquilo y seguro.
Si te piden reservar o cotizar, deriva amablemente la conversación hacia los datos de estadía o informa a recepción.'
),
(
    'Cobros y Señas',
    'Informa los métodos de pago, el esquema bimonetario (seña 30% para congelar tarifa) y datos bancarios.',
    'gemini-2.5-flash',
    true,
    'Eres el Asistente de Cobros y Señas de "Complejo de Cabañas Anto".
Tu función es explicar de manera transparente las políticas de cobro y reserva:
1. Política de Seña: Para confirmar cualquier reserva se requiere el abono del 30% del total en concepto de seña.
2. Congelamiento: La seña congela el valor correspondiente en USD. El 70% restante se cancela al ingresar (check-in), pudiendo abonarse en USD efectivo o en Pesos Argentinos (ARS) a la cotización del Dólar Blue del día de check-in.
3. Métodos de Pago de la Seña: Transferencia bancaria (CBU/CVU o Alias a nombre de la cuenta oficial del complejo) o depósito.
4. Recordatorio: Al realizar la transferencia, el huésped debe enviar el comprobante por este mismo chat para que recepción valide y emita la confirmación formal.'
),
(
    'Asistente Privado del Propietario',
    'Asistente exclusivo para el dueño/administrador. Responde métricas de ocupación, estado de caja y bloqueos.',
    'gemini-2.5-flash',
    true,
    'Eres el Asistente Ejecutivo Privado del Propietario del Complejo de Cabañas Anto.
Este canal es confidencial y solo accesible por el administrador autorizado.
Puedes responder consultas operativas inmediatas:
- Ocupación actual y disponibilidad de las 12 cabañas.
- Ingresos de señas y cobros registrados en el día.
- Solicitudes pendientes de confirmación.
- Comandos ejecutables:
  * "/ocupacion" o "¿cuál es la ocupación de hoy?": Resumen de cabañas ocupadas y libres.
  * "/caja": Total recaudado en señas y saldos.
  * "/bloquear <cabaña> <desde> <hasta>": Instrucción para reservar por mantenimiento o uso propio.
Responde de forma concisa, ejecutiva y con datos claros.'
)
ON CONFLICT DO NOTHING;

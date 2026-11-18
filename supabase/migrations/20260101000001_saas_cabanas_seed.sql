-- ======================================================================
-- SAAS Cabañas - Master Seed Data Migration
-- Pre-populates 12 Cabins, 12 Parking Spots, Bank Accounts, Inventory & Suppliers
-- ======================================================================

-- 1. SEED 12 CABINS
INSERT INTO public.cabins (cabin_number, name, floor, max_guests, has_accessible_mobility, base_rate_usd, description, amenities, image_url)
VALUES
    (1, 'Cabaña El Roble (Accesible)', 'PB', 4, true, 85.00, 'Planta baja adaptada con rampa, puertas ensanchadas y baño para movilidad reducida.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Cocina Completa', 'Accesibilidad Motriz'], '/images/cabanas/Gemini_Generated_Image.jpeg'),
    (2, 'Cabaña Los Pinos (Accesible)', 'PB', 4, true, 85.00, 'Planta baja espaciosa, acceso directo al jardín y parque arbolado.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Cocina Completa', 'Accesibilidad Motriz'], '/images/cabanas/Gemini_Generated_Image2.jpeg'),
    (3, 'Cabaña Aromos (Accesible)', 'PB', 4, true, 85.00, 'Comodidad total en planta baja, ventanales luminosos al solarium.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Cocina Completa', 'Accesibilidad Motriz'], '/images/cabanas/Gemini_Generated_Image3.jpeg'),
    (4, 'Cabaña Sauces (Accesible)', 'PB', 4, true, 85.00, 'Diseño amplio con accesibilidad completa y pérgola exterior.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Cocina Completa', 'Accesibilidad Motriz'], '/images/cabanas/Gemini_Generated_Image4.jpeg'),
    (5, 'Cabaña Mirador I (Familiar)', 'PA', 6, false, 120.00, 'Planta alta para 6 pasajeros con 2 dormitorios independientes y terraza con asador.', ARRAY['WiFi', 'Smart TV', 'Aire Acondicionado', 'Asador Privado', 'Balcón Terraza', 'Vistas Panorámicas'], '/images/cabanas/Gemini_Generated_Image5.jpeg'),
    (6, 'Cabaña Mirador II (Familiar)', 'PA', 6, false, 120.00, 'Gran living comedor, terraza con vistas a las sierras y parrilla individual.', ARRAY['WiFi', 'Smart TV', 'Aire Acondicionado', 'Asador Privado', 'Balcón Terraza', 'Vistas Panorámicas'], '/images/cabanas/Gemini_Generated_Image6.jpeg'),
    (7, 'Cabaña Mirador III (Familiar)', 'PA', 6, false, 120.00, 'Ideal familias numerosas, 2 baños y balcón aterrazado con asador.', ARRAY['WiFi', 'Smart TV', 'Aire Acondicionado', 'Asador Privado', 'Balcón Terraza', 'Vistas Panorámicas'], '/images/cabanas/Gemini_Generated_Image7.jpeg'),
    (8, 'Cabaña Alborada I', 'PA', 4, false, 95.00, 'Planta alta con balcón aterrazado, parrilla individual y cocina equipada.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Balcón', 'Vistas al Parque'], '/images/cabanas/Gemini_Generated_Image_3gyxc63gyxc63gyx.jpg'),
    (9, 'Cabaña Alborada II', 'PA', 4, false, 95.00, 'Excelente luz natural, balcón privado y ambientes cálidos.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Balcón', 'Vistas al Parque'], '/images/cabanas/Gemini_Generated_Image_52yxzv52yxzv52yx.jpg'),
    (10, 'Cabaña Atardecer I', 'PA', 4, false, 95.00, 'Balcón con orientación oeste para disfrutar las mejores puestas de sol.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Balcón', 'Solarium'], '/images/cabanas/Gemini_Generated_Image_aq9df7aq9df7aq9d.jpg'),
    (11, 'Cabaña Atardecer II', 'PA', 4, false, 95.00, 'Ambiente relajante, asador en balcón terraza y vista a la piscina.', ARRAY['WiFi', 'Aire Acondicionado', 'Parrilla', 'Balcón', 'Solarium'], '/images/cabanas/Gemini_Generated_Image_aseog5aseog5aseo.jpg'),
    (12, 'Cabaña Serena Suite', 'PA', 4, false, 105.00, 'Unidad premium en planta alta con detalles de diseño y máximo confort.', ARRAY['WiFi', 'Hidromasaje', 'Smart TV', 'Balcón Terraza', 'Asador'], '/images/cabanas/Gemini_Generated_Image_b0233db0233db023.jpg')
ON CONFLICT (cabin_number) DO UPDATE SET
    name = EXCLUDED.name,
    base_rate_usd = EXCLUDED.base_rate_usd,
    image_url = EXCLUDED.image_url;

-- 2. SEED 12 PARKING SPOTS (Asociadas 1:1 a cada cabaña)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, cabin_number FROM public.cabins ORDER BY cabin_number LOOP
        INSERT INTO public.parking_spots (spot_number, cabin_id, is_occupied)
        VALUES (r.cabin_number, r.id, false)
        ON CONFLICT (spot_number) DO UPDATE SET
            cabin_id = EXCLUDED.cabin_id;
    END LOOP;
END $$;

-- 3. SEED INITIAL EXCHANGE RATE
INSERT INTO public.exchange_rates (currency_pair, buy_rate, sell_rate, source, is_manual_override)
VALUES ('USD_ARS_BLUE', 1265.00, 1285.00, 'dolarapi.com', false)
ON CONFLICT DO NOTHING;

-- 4. SEED BANK ACCOUNTS (Cuentas Oficiales para Transferencias de Huéspedes)
INSERT INTO public.bank_accounts (currency, bank_name, account_type, account_number, cbu_cvu, alias, account_holder, cuit_cuil, notes)
VALUES
    ('ARS', 'Banco de Galicia y Buenos Aires', 'Caja de Ahorro en Pesos', '4012345-6 123-4', '0070123130004012345642', 'CABANAS.ANTO.PESOS', 'Complejo Turístico Cabañas Anto S.R.L.', '30-71889900-5', 'Cuenta para transferencias de señas en pesos al valor del Dólar Blue del día.'),
    ('USD', 'Banco de Galicia y Buenos Aires', 'Caja de Ahorro en Dólares', '4012345-6 123-5', '0070123130004012345659', 'CABANAS.ANTO.USD', 'Complejo Turístico Cabañas Anto S.R.L.', '30-71889900-5', 'Cuenta para transferencias bancarias de saldos o señas en Dólares Estadounidenses (USD billete).')
ON CONFLICT DO NOTHING;

-- 5. SEED SUPPLIERS (Proveedores Iniciales)
INSERT INTO public.suppliers (business_name, contact_name, category, phone, email, cuit, payment_terms, notes)
VALUES
    ('Lavandería Central Serrana', 'Martín Gómez', 'lavanderia', '+54 9 3541 55-1234', 'pedidos@lavanderiaserrana.com.ar', '30-71234567-8', 'Cuenta corriente quincenal', 'Retiro y entrega lunes, miércoles y viernes.'),
    ('Distribuidora de Insumos & Amenities Hotel', 'Silvia Rossi', 'amenities_limpieza', '+54 9 3541 44-5678', 'ventas@amenitieshotel.com.ar', '27-24567890-4', 'Transferencia contra entrega', 'Jabones artesanales, shampoo y biodegradables.'),
    ('Canastas Artesanales & Sin TACC "La Celíaca"', 'Valeria Ortiz', 'desayunos_sin_tacc', '+54 9 3541 66-9900', 'valeria@desayunoscba.com', '27-28999111-2', 'Semanal adelantado', 'Canastas selladas en origen herméticamente para evitar contaminación cruzada.'),
    ('Mantenimiento Integral & Bombas Piscinas', 'Ing. Carlos Peralta', 'mantenimiento_pileta', '+54 9 3541 77-8899', 'carlos@piscinasymas.com.ar', '20-18456123-3', 'Factura A 30 días', 'Servicio de urgencias bombas, filtros y caldera climatizadora.')
ON CONFLICT DO NOTHING;

-- 6. SEED HOUSEKEEPING INVENTORY (Maestranza, Toallas, Insumos)
INSERT INTO public.housekeeping_inventory (item_name, category, unit, stock_depot, min_alert_threshold, notes)
VALUES
    ('Toallón de Baño Blanco Hotelero (550gr)', 'toallas_bano', 'unidades', 60, 20, 'Stock para rotación de 12 cabañas (recambio c/ 3 días)'),
    ('Toalla de Mano / Rostro Hotelera', 'toallas_bano', 'unidades', 50, 15, 'Recambio junto al toallón de baño'),
    ('Toallón de Pileta / Playa Azul Marino', 'toallas_pileta', 'unidades', 45, 15, 'Para préstamo diurno en solarium y pileta'),
    ('Juego de Sábanas 2 Plazas (Queen)', 'sabanas', 'juegos', 25, 8, 'Recambio semanal o por rotación de huésped'),
    ('Juego de Sábanas 1 Plaza (Twin)', 'sabanas', 'juegos', 35, 10, 'Para camas individuales de cabañas PB y PA'),
    ('Jabón Artesanal Vegetal 30g', 'amenities_jabones', 'unidades', 150, 40, 'Amenity de bienvenida por baño'),
    ('Shampoo & Acondicionador 40ml', 'amenities_jabones', 'unidades', 120, 30, 'Amenity de bienvenida'),
    ('Papel Higiénico Doble Hoja Premium', 'amenities_jabones', 'rollos', 100, 25, 'Reposición continua'),
    ('Cloro Líquido Concentrado (Pileta)', 'limpieza_quimicos', 'bidones 20L', 6, 2, 'Para dosificación diaria matutina')
ON CONFLICT DO NOTHING;

// ======================================================================
// SAAS Cabañas - Database & Domain Types
// ======================================================================

export type UserRole = 'dueno' | 'admin' | 'recepcion' | 'maestranza' | 'mantenimiento';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  pin_quick_access?: string | null;
  mfa_enforced: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CabinFloor = 'PB' | 'PA';

export interface Cabin {
  id: string;
  cabin_number: number;
  name: string;
  floor: CabinFloor;
  max_guests: number;
  has_accessible_mobility: boolean;
  base_rate_usd: number;
  description: string;
  amenities: string[];
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkingSpot {
  id: string;
  spot_number: number;
  cabin_id: string | null;
  is_occupied: boolean;
  current_license_plate: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  currency_pair: string;
  buy_rate: number;
  sell_rate: number;
  source: string;
  is_manual_override: boolean;
  recorded_at: string;
}

export type BankCurrency = 'ARS' | 'USD';

export interface BankAccount {
  id: string;
  currency: BankCurrency;
  bank_name: string;
  account_type: string;
  account_number?: string | null;
  cbu_cvu: string;
  alias: string;
  account_holder: string;
  cuit_cuil: string;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadSource = 'telegram' | 'web' | 'telefono' | 'mostrador' | 'instagram' | 'email' | 'manual' | 'otro';
export type LeadStatus = 'nuevo' | 'contactado' | 'cotizado' | 'en_conversacion' | 'reserva_realizada' | 'reservado' | 'descartado';

export interface Lead {
  id: string;
  full_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  source: LeadSource;
  desired_check_in?: string | null;
  desired_check_out?: string | null;
  pax_count: number;
  cabin_preference_id?: string | null;
  has_reduced_mobility: boolean;
  mobility_notes?: string | null;
  budget_estimated_usd?: number | null;
  status: LeadStatus;
  converted_client_id?: string | null;
  converted_reservation_id?: string | null;
  telegram_chat_id?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  dni_passport: string;
  full_name: string;
  email?: string | null;
  phone: string;
  city_country?: string | null;
  has_reduced_mobility: boolean;
  mobility_notes?: string | null;
  has_celiac_sin_tacc: boolean;
  dietary_notes?: string | null;
  vip_status: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ReservationStatus = 'solicitada' | 'senada' | 'confirmada' | 'checkin' | 'checkout' | 'cancelada';

export interface Reservation {
  id: string;
  cabin_id: string;
  client_id?: string;
  guest_name: string;
  guest_dni?: string;
  guest_email?: string;
  guest_phone?: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  status: ReservationStatus;
  
  // Bimonetary financial details
  daily_rate_usd: number;
  total_nights: number;
  total_usd: number;
  blue_rate_at_booking: number;
  total_ars_at_booking: number;
  
  // Seña rules
  sena_percentage: number;
  sena_usd_required: number;
  sena_paid_ars: number;
  sena_paid_usd_equiv: number;
  sena_blue_rate?: number | null;
  sena_paid_at?: string | null;
  
  // Saldo rules
  balance_pending_usd: number;
  balance_paid_usd: number;
  balance_paid_ars: number;
  balance_blue_rate_at_checkin?: number | null;
  balance_paid_at?: string | null;
  
  // Trazabilidad y Operatividad
  booking_channel?: string;
  created_by_role?: string;
  origin_lead_id?: string | null;

  // Logistics
  parking_spot_number?: number | null;
  vehicle_license_plate?: string | null;
  breakfast_included: boolean;
  has_celiac_sin_tacc: boolean;
  dietary_notes?: string | null;
  has_reduced_mobility: boolean;
  mobility_notes?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  cabin?: Cabin;
  client?: Client;
}

export type PaymentConcept = 'sena' | 'saldo' | 'adicional' | 'deposito_garantia' | 'reembolso';
export type PaymentMethod = 'transferencia_ars' | 'efectivo_ars' | 'efectivo_usd' | 'tarjeta' | 'mercadopago';

export interface Payment {
  id: string;
  reservation_id: string;
  bank_account_id?: string | null;
  concept: PaymentConcept;
  amount_ars: number;
  amount_usd: number;
  applied_blue_rate: number;
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  receipt_url?: string | null;
  registered_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export type SupplierCategory = 
  | 'lavanderia' 
  | 'amenities_limpieza' 
  | 'desayunos_sin_tacc' 
  | 'mantenimiento_pileta' 
  | 'electricidad_gas' 
  | 'plomeria' 
  | 'blanquería_compra' 
  | 'otro';

export interface Supplier {
  id: string;
  business_name: string;
  contact_name?: string | null;
  category: SupplierCategory;
  phone: string;
  email?: string | null;
  cuit?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type HousekeepingItemCat = 
  | 'toallas_bano' 
  | 'toallas_pileta' 
  | 'sabanas' 
  | 'amenities_jabones' 
  | 'limpieza_quimicos' 
  | 'desayuno';

export interface HousekeepingInventoryItem {
  id: string;
  item_name: string;
  category: HousekeepingItemCat;
  unit: string;
  stock_depot: number;
  min_alert_threshold: number;
  preferred_supplier_id?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface HousekeepingLog {
  id: string;
  cabin_id: string;
  reservation_id?: string | null;
  log_date: string;
  bath_towels_changed: number;
  hand_towels_changed: number;
  bed_sheets_changed: number;
  amenities_replenished: boolean;
  cleaning_status: 'pendiente' | 'en_curso' | 'completada' | 'inspeccionada';
  performed_by?: string | null;
  observations?: string | null;
  created_at: string;
}

export type MaintenancePriority = 'baja' | 'media' | 'alta' | 'urgente';
export type MaintenanceStatus = 'pendiente' | 'en_progreso' | 'resuelta' | 'resuelto' | 'cancelada' | 'cancelado';

export interface MaintenanceTicket {
  id: string;
  cabin_id?: string | null;
  area_name?: string | null;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_supplier_id?: string | null;
  cost_estimated_ars?: number | null;
  cost_actual_ars?: number | null;
  reported_by?: string | null;
  assigned_to?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreventiveMaintenance {
  id: string;
  record_date: string;
  facility: 'pileta' | 'quincho' | 'bombas_riego' | 'termotanques';
  ph_level?: number | null;
  chlorine_level?: number | null;
  water_temp_celsius?: number | null;
  filter_status?: string | null;
  observations?: string | null;
  performed_by?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
}

// ======================================================================
// CONFIGURACIÓN DE OPERATIVIDAD, TEMPORADAS & AUDITORÍA DE MOVIMIENTOS
// ======================================================================

export interface SeasonConfig {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  base_daily_usd_pb: number;
  base_daily_usd_pa_4pax: number;
  base_daily_usd_pa_6pax: number;
  notes?: string | null;
  updated_at?: string;
}

export type HolidayType = 'fin_de_semana_largo' | 'feriado_nacional' | 'fecha_especial' | 'inamovible' | 'trasladable';

export interface HolidayException {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  type: HolidayType;
  description?: string | null;
  rate_multiplier?: number;
  min_nights?: number;
  is_official_api?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ReservationChangeType = 'reubicacion' | 'fechas' | 'pax' | 'general';

export interface ReservationChange {
  id: string;
  reservation_id: string;
  previous_cabin_id?: string | null;
  new_cabin_id?: string | null;
  change_type: ReservationChangeType;
  reason: string;
  accessibility_warning_accepted: boolean;
  previous_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  changed_by?: string | null;
  created_at: string;
  // Joined
  previous_cabin?: Cabin;
  new_cabin?: Cabin;
}

// ======================================================================
// TELEGRAM, ASISTENTES IA, CRM & RESERVAS (Módulo Telegram)
// ======================================================================

export interface ChannelConnection {
  id: string;
  channel_type: 'telegram' | 'whatsapp';
  bot_token: string;
  bot_username?: string | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  owner_chat_id?: string | null;
  owner_phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assistant {
  id: string;
  name: string;
  role_description?: string | null;
  system_prompt: string;
  model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  full_name?: string | null;
  external_id: string;
  channel: string;
  username?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export type ConversationStatus = 'ai_active' | 'human_takeover';

export interface Conversation {
  id: string;
  contact_id: string;
  assistant_id?: string | null;
  status: ConversationStatus;
  last_message_preview?: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  // Relations
  contact?: Contact;
  assistant?: Assistant;
  messages?: Message[];
}

export type MessageSenderType = 'user' | 'assistant' | 'human_agent';

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  content: string;
  created_at: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  contact_id?: string | null;
  cabin_name: string;
  cabin_id?: string | null;
  check_in: string;
  check_out: string;
  guests_count: number;
  total_amount: number;
  currency: string;
  status: BookingStatus;
  reservation_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  contact?: Contact;
  cabin?: Cabin;
}



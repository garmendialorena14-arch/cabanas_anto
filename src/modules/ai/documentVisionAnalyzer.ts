// ======================================================================
// SAAS Cabañas - Analizador Inteligente de Documentos y Comprobantes (Visión IA)
// Modelo: Gemini Multimodal Vision (gemini-2.5-flash / gemini-3.1-flash-lite)
// Cumplimiento: Ley 25.326 de Protección de Datos Personales (Argentina)
// ======================================================================

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '@/modules/ai/geminiClient';
import { TelegramClient } from '@/modules/telegram/telegramClient';

export interface DocumentAnalysisResult {
  tipo_detectado: 'dni_o_pasaporte' | 'comprobante_transferencia' | 'otro';
  es_valido: boolean;
  es_dni: boolean;
  es_comprobante: boolean;
  es_legible: boolean;
  esta_completo: boolean;
  motivo: string;
  datos_extraidos: {
    dni_numero?: string | null;
    nombre_apellido?: string | null;
    monto_ars?: number | null;
    destinatario_coincide?: boolean | null;
    destinatario_nombre?: string | null;
    destinatario_alias_cbu?: string | null;
    remitente_nombre?: string | null;
    fecha_hora?: string | null;
    numero_operacion?: string | null;
  };
  mensaje_al_huesped: string;
  accion_sugerida_crm:
    | 'aprobar_dni'
    | 'pedir_reintento_dni'
    | 'confirmar_sena'
    | 'alertar_cuenta_incorrecta'
    | 'rechazar_imagen_ajena';
  purpose: string;
}

const PRIVACY_DISCLAIMER_HTML = `\n\n🔒 <i>Tus datos y documentación están resguardados bajo estricta confidencialidad (Ley de Protección de Datos Personales Nº 25.326) con el único fin de gestionar tu registro de estadía y seguro de pasajeros.</i>`;

/**
 * Descarga y analiza con visión multimodal la foto enviada por un usuario en Telegram.
 * Evalúa si es un DNI (legible, completo, sin recortes) o un comprobante de transferencia bancaria
 * con los datos y destinatario oficial de Cabañas Anto.
 */
export async function analyzeTelegramMedia({
  fileId,
  hasActiveReservation,
  guestName,
}: {
  fileId: string;
  hasActiveReservation: boolean;
  guestName?: string;
}): Promise<DocumentAnalysisResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn('[DocumentVision] GEMINI_API_KEY no disponible para análisis visual.');
    return null;
  }

  const { token } = await TelegramClient.getActiveToken();
  if (!token) {
    console.warn('[DocumentVision] Bot token no disponible para descargar archivo.');
    return null;
  }

  try {
    // 1. Obtener ruta del archivo en Telegram
    const client = new TelegramClient(token);
    const fileInfo = await client.getFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      console.warn('[DocumentVision] No se pudo obtener la ruta del archivo en Telegram.');
      return null;
    }

    // 2. Descargar la imagen
    const downloadUrl = client.getFileDownloadUrl(fileInfo.file_path);
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn('[DocumentVision] Error al descargar imagen de Telegram:', res.statusText);
      return null;
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.includes('png') ? 'image/png' : 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 3. Prompt de Visión Multimodal Especializado
    const prompt = `Actúas como el sistema de visión por computadora y control de calidad de recepción de Complejo Cabañas Anto (Mar Azul, Argentina).
Tu función es examinar detenidamente la imagen enviada por el huésped y responder con un JSON estructurado.

CONTEXTO DE LA CONVERSACIÓN:
- ¿El huésped ya posee una reserva confirmada/seña activa?: ${hasActiveReservation ? 'SÍ (Se le solicitó fotos del frente y dorso de su DNI o Pasaporte para el registro)' : 'NO (Posiblemente envía comprobante de transferencia/seña para confirmar)'}.
- Nombre del huésped registrado: "${guestName || 'Huésped'}".
- Cuentas oficiales de Cabañas Anto para recepción de señas:
  * Alias oficial: CABANAS.ANTO.RESERVAS
  * Titular oficial de cuenta: Complejo Cabañas Anto (o Lorena Garmendia)

INSTRUCCIONES DE CLASIFICACIÓN Y EVALUACIÓN:
1. Determina con total precisión qué tipo de imagen es:
   - 'dni_o_pasaporte': DNI argentino (tarjeta celeste/verde, frente o dorso), Pasaporte, Cédula de Identidad o Licencia de Conducir.
   - 'comprobante_transferencia': Captura de comprobante bancario o billetera virtual (Mercado Pago, Cuenta DNI, BNA+, Galicia, Santander, etc.).
   - 'otro': Foto de una mascota (perro, gato), selfie/persona, comida, paisaje/bosque, meme, sticker, o cualquier objeto no relacionado.

2. SI LA IMAGEN ES O SE PRETENDÍA QUE FUERA UN DNI / PASAPORTE:
   - es_dni: true únicamente si es realmente un documento de identidad; false si es un perro, paisaje, persona, comida, etc.
   - es_legible: true si los números de documento, nombre y fecha se leen con nitidez; false si está muy borroso, desenfocado o con reflejo de flash que oculta texto.
   - esta_completo: true si se ve el documento entero; false si está cortado en las esquinas, bordes o tapado con dedos/objetos.
   - Extraer: dni_numero y nombre_apellido si son legibles.
   - Redactar un mensaje cordial en mensaje_al_huesped adaptado a la situación:
     * Si no es un DNI (ej: mandó foto de un perro o una flor): Rechazar con amabilidad aclarando que no parece ser un documento y pedir la foto del DNI frente/dorso.
     * Si es DNI pero ilegible/borroso/con reflejo: Pedir amablemente que le tomen una foto más de cerca con buena luz y sin flash.
     * Si es DNI pero recortado o tapado con dedos: Pedir amablemente que lo encuadren completo sin tapar datos.
     * Si es válido, completo y legible: Agradecer y confirmar que el DNI fue validado exitosamente para su estadía.

3. SI LA IMAGEN ES UN COMPROBANTE DE TRANSFERENCIA / DEPÓSITO:
   - es_comprobante: true.
   - es_legible: true si se ve el monto y datos de la operación.
   - destinatario_coincide: true si fue transferido a Complejo Cabañas Anto, Lorena Garmendia o al Alias CABANAS.ANTO.RESERVAS; false si figura claramente dirigido a OTRA persona o empresa desconocida.
   - Extraer: monto_ars, destinatario_nombre, destinatario_alias_cbu, remitente_nombre, fecha_hora, numero_operacion.
   - Redactar un mensaje cordial en mensaje_al_huesped:
     * Si el destinatario no coincide: Alertar con cortesía que la transferencia no parece dirigida a Cabañas Anto y detallar a quién figura enviada para que revisen.
     * Si es ilegible o incompleto: Pedir el comprobante completo o PDF de la transferencia.
     * Si es correcto: Confirmar la recepción del comprobante indicando el monto y avisar que el equipo de recepción emitirá la reserva formal.

Responde ÚNICAMENTE con el siguiente objeto JSON estricto sin bloques markdown ni texto adicional:
{
  "tipo_detectado": "dni_o_pasaporte" | "comprobante_transferencia" | "otro",
  "es_valido": boolean,
  "es_dni": boolean,
  "es_comprobante": boolean,
  "es_legible": boolean,
  "esta_completo": boolean,
  "motivo": "string conciso explicando el resultado",
  "datos_extraidos": {
    "dni_numero": "string o null",
    "nombre_apellido": "string o null",
    "monto_ars": number_o_null,
    "destinatario_coincide": boolean_o_null,
    "destinatario_nombre": "string o null",
    "destinatario_alias_cbu": "string o null",
    "remitente_nombre": "string o null",
    "fecha_hora": "string o null",
    "numero_operacion": "string o null"
  },
  "mensaje_al_huesped": "string con el mensaje exacto redactado para Telegram",
  "accion_sugerida_crm": "aprobar_dni" | "pedir_reintento_dni" | "confirmar_sena" | "alertar_cuenta_incorrecta" | "rechazar_imagen_ajena"
}`;

    const ai = new GoogleGenAI({ apiKey });
    const aiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const rawJson = (aiRes.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawJson);

    // Adjuntar disclaimer de privacidad conforme a la Ley 25.326
    let finalGuestMessage = parsed.mensaje_al_huesped || '';
    if (parsed.es_valido || parsed.es_dni || parsed.es_comprobante) {
      if (!finalGuestMessage.includes('Ley de Protección de Datos')) {
        finalGuestMessage += PRIVACY_DISCLAIMER_HTML;
      }
    }

    const result: DocumentAnalysisResult = {
      tipo_detectado: parsed.tipo_detectado || (hasActiveReservation ? 'dni_o_pasaporte' : 'comprobante_transferencia'),
      es_valido: Boolean(parsed.es_valido),
      es_dni: Boolean(parsed.es_dni),
      es_comprobante: Boolean(parsed.es_comprobante),
      es_legible: Boolean(parsed.es_legible),
      esta_completo: Boolean(parsed.esta_completo),
      motivo: parsed.motivo || 'Evaluación completada por IA',
      datos_extraidos: parsed.datos_extraidos || {},
      mensaje_al_huesped: finalGuestMessage,
      accion_sugerida_crm: parsed.accion_sugerida_crm || (parsed.es_valido ? 'aprobar_dni' : 'rechazar_imagen_ajena'),
      purpose: 'checkin_hotelero_seguro_huespedes_ley_25326',
    };

    // Logging ético y seguro: NUNCA imprimir datos sensibles en logs
    console.info(`[DocumentVision] Imagen analizada (file_id=${fileId.slice(0, 10)}...). Tipo: ${result.tipo_detectado}. Válido: ${result.es_valido}. Motivo: ${result.motivo}`);

    return result;
  } catch (err: any) {
    console.error('[DocumentVision] Error durante el análisis visual:', err.message || err);
    return null;
  }
}

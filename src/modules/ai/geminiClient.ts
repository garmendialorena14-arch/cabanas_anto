// ======================================================================
// SAAS Cabañas - Google Gemini AI Client
// Modelo: gemini-2.5-flash
// SDK Oficial: @google/genai
// ======================================================================

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

/**
 * Obtiene la API Key de Gemini:
 * 1. Desde process.env.GEMINI_API_KEY
 * 2. Si está vacía, intenta leer el archivo Gemini.txt indicado por el usuario
 */
export function getGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return cleanKey(process.env.GEMINI_API_KEY);
  }

  const paths = [
    path.join(process.cwd(), 'Gemini.txt'),
    'C:\\Users\\Lore\\OneDrive\\Escritorio\\Doc Lore\\IA\\Antigravity\\SAAS Cabañas\\Gemini.txt',
    'C:\\Users\\Lore\\OneDrive\\Escritorio\\Doc Lore\\IA\\Antigravity\\Cabañas Anto\\Gemini.txt',
  ];

  for (const candidatePath of paths) {
    try {
      if (fs.existsSync(candidatePath)) {
        const fileContent = fs.readFileSync(candidatePath, 'utf-8').trim();
        if (fileContent.length > 5) {
          return cleanKey(fileContent);
        }
      }
    } catch {
      // Intentar siguiente ruta
    }
  }

  return '';
}

function cleanKey(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.toLowerCase().startsWith('api gemini')) {
    cleaned = cleaned.replace(/^api\s+gemini\s*/i, '').trim();
  }
  return cleaned;
}

export interface GenerateAiResponseParams {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'model'; content: string }>;
  model?: string;
  contextData?: string; // Información en vivo de cabañas, tarifas, feriados
}

export async function generateAssistantResponse({
  systemPrompt,
  userMessage,
  conversationHistory = [],
  model = 'gemini-3.1-flash-lite',
  contextData = '',
}: GenerateAiResponseParams): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return 'Hola, gracias por comunicarte con Cabañas Anto. En este momento el servicio automatizado de inteligencia artificial está configurándose. Un asesor de recepción te atenderá a la brevedad.';
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Preparar el prompt del sistema enriquecido con contexto en tiempo real
    const fullSystemInstruction = `${systemPrompt}

======================================================================
DATOS Y CONTEXTO EN TIEMPO REAL DEL COMPLEJO (ZONA HORARIA: America/Argentina/Buenos_Aires):
${contextData || 'No hay datos adicionales de contexto en este momento.'}
======================================================================
REGLAS CONVERSACIONALES CRÍTICAS:
1. UBICACIÓN: Complejo de Cabañas Anto está ubicado en MAR AZUL, Provincia de Buenos Aires, Argentina (en el bosque de pinos, a 300 metros de la playa). NUNCA digas que no estás en Mar Azul.
2. COMUNICACIONES Y CONTACTO: No se utiliza WhatsApp. Todo contacto es por este chat de Telegram o mediante llamada telefónica tradicional.
3. MEMORIA Y FLUJO DE RESERVAS (NO REPETIR PREGUNTAS):
   - Revisa minuciosamente TODO el historial antes de responder.
   - Si el huésped ya mencionó las fechas, cantidad de personas, o preferencias (como movilidad o celiaquía) en turnos previos, NUNCA se las vuelvas a pedir.
   - Si el huésped ya recibió la cotización y dice "avancemos", "sí, por favor", "quiero reservar", "dale", "cómo sigo", etc.:
     * NO repitas la cotización ni vuelvas a pedir fechas ni cantidad de huéspedes.
     * Avanza directamente con el CONTROL DE DATOS OBLIGATORIOS PARA LA RESERVA.
4. CONTROL DE DATOS OBLIGATORIOS DE RESERVA (CHECKLIST ACTIVO):
   Para emitir la ficha y voucher formal de reserva se requieren:
   a) Nombre y Apellido completo del titular.
   b) DNI o Pasaporte.
   c) Teléfono celular de contacto (para llamadas).
   d) Patente (dominio) del vehículo (para el acceso a su cochera cubierta individual).
   e) Requerimiento de desayuno Sin TACC para celíacos (confirmar si alguien lo necesita).
   f) Movilidad reducida / Planta baja (confirmar si requieren unidad adaptada).
   * REGLA DE EXCLUSIÓN: Si el huésped ya suministró alguno de estos datos, confirma que lo recibiste y solicita ÚNICAMENTE los que falten.
5. PAGO DE SEÑA Y CONDICIONES (DAR AL MOMENTO DE AVANZAR):
   - Seña del 30% para congelar el valor de la estadía en USD (informar monto en USD y equivalente en ARS al Dólar Blue del día).
   - Medio de pago: Transferencia bancaria al Alias: CABANAS.ANTO.RESERVAS (Titular: Complejo Cabañas Anto).
   - Indicar que envíen el comprobante de transferencia por este mismo chat para que recepción valide y emita el número oficial de reserva.
   - Informar condiciones de reserva y cancelación:
     * Check-in: 14:00 hs | Check-out: 10:00 hs.
     * Cancelación con 15 días o más de anticipación: la seña se conserva como crédito para otra fecha durante 12 meses.
     * Cancelación con menos de 15 días: la seña no es reembolsable.
6. SI EL USUARIO PIDE UN ASESOR O HUMANO: Comunica amablemente que transfieres la conversación a recepción humana.
7. FORMATO: Breve, cálido, profesional, formateado para Telegram con negritas y viñetas claras.`;

    // Normalizar historial asegurando formato estricto de turnos para Gemini API:
    // 1) El primer turno debe ser 'user'.
    // 2) Los turnos deben alternar entre 'user' y 'model'.
    const rawItems: Array<{ role: 'user' | 'model'; text: string }> = [];

    for (const msg of conversationHistory) {
      if (msg.content && msg.content.trim()) {
        rawItems.push({
          role: msg.role === 'model' ? 'model' : 'user',
          text: msg.content.trim(),
        });
      }
    }

    if (userMessage && userMessage.trim()) {
      rawItems.push({
        role: 'user',
        text: userMessage.trim(),
      });
    }

    // Asegurar que el historial no arranque con 'model'
    while (rawItems.length > 0 && rawItems[0].role === 'model') {
      rawItems.shift();
    }

    if (rawItems.length === 0) {
      rawItems.push({ role: 'user', text: userMessage.trim() || 'Hola' });
    }

    // Combinar mensajes consecutivos del mismo rol
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const item of rawItems) {
      const last = contents[contents.length - 1];
      if (last && last.role === item.role) {
        last.parts[0].text += `\n\n${item.text}`;
      } else {
        contents.push({
          role: item.role,
          parts: [{ text: item.text }],
        });
      }
    }

    // Modelos activos y rápidos con fallback automático
    const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    let lastError: any = null;
    for (const targetModel of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: 0.6,
          },
        });

        const replyText = response.text;
        if (replyText && replyText.trim() !== '') {
          return replyText.trim();
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Intento con modelo ${targetModel} falló, probando fallback:`, err.message);
      }
    }

    throw lastError || new Error('No se pudo generar respuesta con ningún modelo disponible.');
  } catch (err: any) {
    console.error('Error al generar respuesta con Gemini:', err);
    return 'Gracias por tu mensaje. En este momento estamos experimentando una breve interrupción con el asistente de IA. Un miembro del equipo de recepción responderá tu consulta a la brevedad.';
  }
}

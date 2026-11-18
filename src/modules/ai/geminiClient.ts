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
Instrucciones operativas adicionales:
- Responde siempre en español de manera cálida y concisa, ideal para mensajería instantánea de Telegram.
- Si el usuario confirma fechas y desea reservar, resume los datos (cabaña sugerida, fechas, personas) e indícale los pasos para la seña.
- Si el usuario dice "humano", "persona", "asesor" o similar, indícale cordialmente que pasas el chat a recepción.`;

    // Convertir historial a formato compatible
    const contents: any[] = [];

    // Agregar últimos mensajes de la conversación
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Agregar el mensaje actual del usuario
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Modelos candidatos en orden de prioridad (soporta fallback automático si Google depreca alguno)
    const normalizedModel = (model || '').replace(/^models\//, '');
    const modelCandidates = Array.from(
      new Set([
        normalizedModel === 'gemini-2.5-flash' ? 'gemini-3.1-flash-lite' : normalizedModel,
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
      ])
    ).filter(Boolean);

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

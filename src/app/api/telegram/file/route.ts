// ======================================================================
// SAAS Cabañas - Proxy de Archivos de Telegram (Comprobantes y Fotos DNI)
// Route: /api/telegram/file?file_id=...
// ======================================================================

import { NextRequest, NextResponse } from 'next/server';
import { TelegramClient } from '@/modules/telegram/telegramClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const fileId = req.nextUrl.searchParams.get('file_id');
    if (!fileId) {
      return NextResponse.json({ error: 'file_id es requerido' }, { status: 400 });
    }

    const { token } = await TelegramClient.getActiveToken();
    if (!token) {
      return NextResponse.json({ error: 'Bot token no configurado' }, { status: 500 });
    }

    const client = new TelegramClient(token);
    const fileInfo = await client.getFile(fileId);

    if (!fileInfo || !fileInfo.file_path) {
      return NextResponse.json({ error: 'Archivo no encontrado en Telegram' }, { status: 404 });
    }

    const downloadUrl = client.getFileDownloadUrl(fileInfo.file_path);
    const fileRes = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Error al descargar archivo desde Telegram' }, { status: fileRes.status });
    }

    const contentType = fileRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await fileRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Error en proxy de archivo Telegram:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

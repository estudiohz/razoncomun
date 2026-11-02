import { NextResponse } from 'next/server';
import { fijarAvisosPorToken } from '@/lib/newsletter/preferencia';

/**
 * Baja one-click (RFC 8058). El correo lleva
 *   List-Unsubscribe: <https://…/api/newsletter/baja?u=…&t=…>
 *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
 * y Gmail/Outlook hacen este POST cuando el usuario pulsa «Cancelar
 * suscripción» en su interfaz. La firma del enlace es la autorización.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const p = new URL(req.url).searchParams;
  const ok = await fijarAvisosPorToken(p.get('u'), p.get('t'), false);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

import { NextResponse } from 'next/server';
import { BrainServiceNotConfiguredError, callBrainService, clientIpFrom } from '@/lib/brain/serviceClient';

/**
 * Proxy fino del entrevistador de Opina (docs/tecnico/chatbot-opina.md).
 * Reenvía { message, history, sessionId, segment, userId } a
 * rc-brain-service /opina/turn. El cliente manda el historial completo en
 * cada turno (el servicio no guarda sesión en memoria, ver opinaFlow.mjs) --
 * primera llamada sin `message` = apertura contextual.
 */
export async function POST(request: Request) {
  let payload: {
    message?: unknown;
    history?: unknown;
    sessionId?: unknown;
    segment?: unknown;
    userId?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const body = {
    message: typeof payload.message === 'string' ? payload.message : null,
    history: Array.isArray(payload.history) ? payload.history : [],
    sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : 'sin-sesion',
    segment: typeof payload.segment === 'string' ? payload.segment : null,
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    channel: 'web',
  };

  try {
    const { status, body: respBody } = await callBrainService('/opina/turn', body, clientIpFrom(request));
    return NextResponse.json(respBody, { status });
  } catch (err) {
    if (err instanceof BrainServiceNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    return NextResponse.json({ error: 'No se pudo contactar con Opina.' }, { status: 502 });
  }
}

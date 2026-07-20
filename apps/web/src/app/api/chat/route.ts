import { NextResponse } from 'next/server';
import { BrainServiceNotConfiguredError, callBrainService, clientIpFrom } from '@/lib/brain/serviceClient';

/**
 * Proxy fino de "Pregunta a Razón Común" (docs/tecnico/rc-brain.md, fase 3).
 * Reenvía { message, sessionId } a rc-brain-service /chat -- el servicio es
 * quien aplica visibility='public', el guardrail anti-inyección, el rate
 * limit y el logging. Este endpoint NO añade lógica de negocio: si el
 * servicio no está configurado (BRAIN_SERVICE_URL ausente), lo dice
 * explícitamente en vez de fallar de forma confusa.
 */
export async function POST(request: Request) {
  let payload: { message?: unknown; sessionId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const message = typeof payload.message === 'string' ? payload.message : '';
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : 'sin-sesion';

  if (!message.trim()) {
    return NextResponse.json({ error: "Falta 'message'." }, { status: 400 });
  }

  try {
    const { status, body } = await callBrainService('/chat', { message, sessionId }, clientIpFrom(request));
    return NextResponse.json(body, { status });
  } catch (err) {
    if (err instanceof BrainServiceNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    return NextResponse.json({ error: 'No se pudo contactar con el cerebro de Razón Común.' }, { status: 502 });
  }
}

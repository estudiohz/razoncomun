import { beforeAll, describe, expect, it } from 'vitest';
import { leerEvento, tokenWebhook, tokenWebhookValido } from './brevo';

const ENVIO = '6219c26a-0000-4000-8000-000000000001';
const CAMP = '6219c26a-0000-4000-8000-000000000002';

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
});

describe('webhook de Brevo', () => {
  it('solo acepta su clave', () => {
    expect(tokenWebhookValido(tokenWebhook())).toBe(true);
    expect(tokenWebhookValido('a'.repeat(64))).toBe(false);
    expect(tokenWebhookValido(null)).toBe(false);
  });

  it('lee un clic con la cabecera que pusimos al enviar', () => {
    const ev = leerEvento({
      event: 'click',
      email: 'a@b.es',
      'message-id': '<x@razoncomun.com>',
      ts_event: 1_793_000_000,
      link: 'https://razoncomun.com/mes',
      'X-Mailin-custom': JSON.stringify({ envio: ENVIO, campana: CAMP }),
    })!;
    expect(ev.tipo).toBe('click');
    expect(ev.envioId).toBe(ENVIO);
    expect(ev.campaignId).toBe(CAMP);
    expect(ev.url).toBe('https://razoncomun.com/mes');
    expect(ev.ocurrido).toBe(new Date(1_793_000_000_000).toISOString());
  });

  it('el mismo evento repetido da la misma huella; otro enlace, otra', () => {
    const b = { event: 'click', 'message-id': '<x>', ts_event: 1, link: 'https://a' };
    expect(leerEvento(b)!.huella).toBe(leerEvento({ ...b })!.huella);
    expect(leerEvento({ ...b, link: 'https://b' })!.huella).not.toBe(leerEvento(b)!.huella);
  });

  it('ignora basura y cabeceras manipuladas', () => {
    expect(leerEvento(null)).toBeNull();
    expect(leerEvento({ email: 'x' })).toBeNull();
    const ev = leerEvento({ event: 'opened', 'X-Mailin-custom': '{"envio":"1; drop table"}' })!;
    expect(ev.envioId).toBeNull();
  });
});

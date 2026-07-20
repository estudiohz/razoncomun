import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ArticuloConRelaciones } from './tipos';
import { selloTrazabilidad } from './consultas';
import { site } from '@/lib/site';

/**
 * Evento de publicación → n8n (rc-08 hace la autopublicación en redes).
 *
 * ⚠️ Entrega "best effort": el esquema NO tiene tabla de outbox, así que este
 * módulo dispara un webhook y punto. Si n8n está caído, el evento se pierde
 * (queda registrado en el log del servidor). Ver el informe: pedimos a rc-02
 * una tabla `content_outbox` para tener entrega al-menos-una-vez con
 * reintentos. El contrato del payload está documentado en `BLOG-EVENTS.md`
 * y no cambia con la migración a outbox.
 */

export const VERSION_EVENTO = '1';

export interface EventoPublicacion {
  version: string;
  evento: 'articulo.publicado';
  emitido_en: string;
  articulo: {
    id: string;
    slug: string;
    url: string;
    titulo: string;
    extracto: string | null;
    imagen: string | null;
    categoria: { slug: string; nombre: string; color: string } | null;
    tipo: 'editorial' | 'observatorio';
    publicado_en: string | null;
    fuentes: string[];
    elaborado_con_ia: boolean;
    revisado_por: string | null;
  };
}

export function construirEvento(articulo: ArticuloConRelaciones): EventoPublicacion {
  const sello = selloTrazabilidad(articulo);
  const base = articulo.source_type === 'observatorio' ? '/observatorio' : '/blog';
  return {
    version: VERSION_EVENTO,
    evento: 'articulo.publicado',
    emitido_en: new Date().toISOString(),
    articulo: {
      id: articulo.id,
      slug: articulo.slug,
      url: `${site.urlBase}${base}/${articulo.slug}`,
      titulo: articulo.title,
      extracto: articulo.excerpt,
      imagen: articulo.cover_image,
      categoria: articulo.categoria
        ? {
            slug: articulo.categoria.slug,
            nombre: articulo.categoria.name,
            color: articulo.categoria.color,
          }
        : null,
      tipo: articulo.source_type,
      publicado_en: articulo.published_at,
      fuentes: sello.fuentes,
      elaborado_con_ia: sello.elaboradoConIa,
      revisado_por: sello.revisadoPor,
    },
  };
}

/** Firma HMAC-SHA256 del cuerpo exacto que se envía. Cabecera `X-RC-Firma`. */
export function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex');
}

/** Verificación en tiempo constante — para que rc-08 valide igual del otro lado. */
export function verificarFirma(cuerpo: string, firma: string, secreto: string): boolean {
  const esperada = Buffer.from(firmar(cuerpo, secreto), 'utf8');
  const recibida = Buffer.from(firma, 'utf8');
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/**
 * Emite el evento. No lanza nunca: publicar un artículo no puede fallar
 * porque n8n esté caído. Devuelve si se entregó, para poder avisar en la UI.
 */
export async function emitirPublicacion(
  articulo: ArticuloConRelaciones,
): Promise<{ entregado: boolean; motivo?: string }> {
  const url = process.env.N8N_BLOG_WEBHOOK_URL;
  const secreto = process.env.N8N_BLOG_WEBHOOK_SECRET;

  const evento = construirEvento(articulo);

  if (!url || !secreto) {
    console.warn(
      '[blog] N8N_BLOG_WEBHOOK_URL/SECRET sin configurar; evento no emitido:',
      JSON.stringify(evento),
    );
    return { entregado: false, motivo: 'webhook-no-configurado' };
  }

  const cuerpo = JSON.stringify(evento);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-RC-Evento': evento.evento,
        'X-RC-Firma': firmar(cuerpo, secreto),
      },
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error('[blog] n8n respondió', res.status, 'al evento', evento.articulo.slug);
      return { entregado: false, motivo: `http-${res.status}` };
    }
    return { entregado: true };
  } catch (e) {
    console.error('[blog] fallo al emitir evento de publicación:', e);
    return { entregado: false, motivo: 'error-red' };
  }
}

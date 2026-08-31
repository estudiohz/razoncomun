import { describe, expect, it } from 'vitest';
import { codificarLineas, decodificarLineas, hostDe, verificarImporte } from './pedido';

describe('carrito en la metadata de Stripe', () => {
  it('va y vuelve sin perder nada', () => {
    const lineas = [
      { variantId: 5440442338, cantidad: 2 },
      { variantId: 5440442339, cantidad: 1 },
    ];
    const texto = codificarLineas(lineas);
    expect(texto).toBe('5440442338:2,5440442339:1');
    expect(decodificarLineas(texto)).toEqual(lineas);
  });

  it('descarta basura en vez de fabricar un pedido raro', () => {
    expect(decodificarLineas('')).toEqual([]);
    expect(decodificarLineas(null)).toEqual([]);
    expect(decodificarLineas('abc,1:2,:,3:0,-4:1')).toEqual([{ variantId: 1, cantidad: 2 }]);
  });

  it('falla en claro si el carrito no cabe en los 500 caracteres de Stripe', () => {
    // Con ids reales de Printful (10 dígitos) caben unas 38 líneas distintas.
    const enormes = Array.from({ length: 60 }, (_, i) => ({
      variantId: 5440442338 + i,
      cantidad: 1,
    }));
    expect(() => codificarLineas(enormes)).toThrow(/metadata de Stripe/);
  });
});

describe('verificarImporte — la puerta que impide fabricar sin cobrar', () => {
  it('acepta solo el importe exacto', () => {
    expect(verificarImporte({ subtotalCents: 2750, envioCents: 649, cobradoCents: 3399 }).ok).toBe(true);
  });

  it('rechaza un descuadre aunque sea de un céntimo', () => {
    const v = verificarImporte({ subtotalCents: 2750, envioCents: 649, cobradoCents: 3398 });
    expect(v.ok).toBe(false);
    expect(v.motivo).toMatch(/no coincide/);
    // No se redondea ni se "acepta por poco": un céntimo de diferencia
    // significa que algo cambió entre la sesión y el cobro.
    expect(v.esperadoCents).toBe(3399);
  });

  it('rechaza si Stripe no informa del importe', () => {
    expect(verificarImporte({ subtotalCents: 2750, envioCents: 0, cobradoCents: null }).ok).toBe(false);
    expect(verificarImporte({ subtotalCents: 2750, envioCents: 0, cobradoCents: 0 }).ok).toBe(false);
  });

  it('cuenta el envío: cobrar solo el producto NO cuadra', () => {
    const v = verificarImporte({ subtotalCents: 2750, envioCents: 649, cobradoCents: 2750 });
    expect(v.ok).toBe(false);
  });
});

describe('hostDe — la marca que impide que dev fabrique compras de producción', () => {
  it('extrae el host de una URL completa', () => {
    expect(hostDe('https://www.razoncomun.com')).toBe('www.razoncomun.com');
    expect(hostDe('https://dev.razoncomun.com/')).toBe('dev.razoncomun.com');
    expect(hostDe('http://localhost:3000')).toBe('localhost:3000');
  });

  it('dev y producción NO se confunden', () => {
    expect(hostDe('https://dev.razoncomun.com')).not.toBe(hostDe('https://www.razoncomun.com'));
  });

  it('no revienta con basura', () => {
    expect(hostDe('no-es-una-url')).toBe('no-es-una-url');
    expect(hostDe('')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import {
  itemsParaPedido,
  itemsParaTarifas,
  normalizarDetalle,
  normalizarResumen,
  normalizarTarifa,
  precioACents,
  type LineaResuelta,
} from './normalizar';
import { formatoPrecio, subtotalCents } from './precios';
import type { VarianteTienda } from './tipos';

/**
 * Respuesta REAL de la cuenta de Razón Común (14/08/2026), recortada:
 * `GET /store/products/455830220`. Los dos ids distintos son el meollo:
 * sync variant 5440442338 vs. catálogo 10798.
 */
const DETALLE_REAL = {
  sync_product: {
    id: 455830220,
    name: 'Stainless steel water bottle',
    thumbnail_url: 'https://files.cdn.printful.com/botella.png',
  },
  sync_variants: [
    {
      id: 5440442338,
      name: 'Stainless steel water bottle',
      variant_id: 10798,
      retail_price: '27.00',
      currency: 'EUR',
      availability_status: 'active',
      product: { variant_id: 10798, product_id: 382, image: 'https://files.cdn.printful.com/v.png' },
      files: [
        // Fichero de IMPRESIÓN: su preview es el logo suelto, no el producto.
        { id: 1, type: 'default', preview_url: 'https://files.cdn.printful.com/logo-suelto.png' },
        // Fichero de PREVIEW: el mockup con nuestro diseño puesto.
        {
          id: 2,
          type: 'preview',
          preview_url: 'https://files.cdn.printful.com/mockup-botella.png',
          thumbnail_url: 'https://files.cdn.printful.com/mockup-botella-thumb.png',
        },
        // Segunda vista (otro mockup) -> galería.
        { id: 3, type: 'preview', preview_url: 'https://files.cdn.printful.com/mockup-botella-2.png' },
        // Repetida: Printful repite URLs; no debe salir dos veces.
        { id: 4, type: 'preview', preview_url: 'https://files.cdn.printful.com/mockup-botella.png' },
      ],
    },
  ],
};

describe('normalizar — respuesta real de Printful', () => {
  it('separa el sync variant id del id de catálogo', () => {
    const d = normalizarDetalle(DETALLE_REAL)!;
    expect(d.nombre).toBe('Stainless steel water bottle');
    expect(d.variantes).toHaveLength(1);
    const v = d.variantes[0];
    expect(v.id).toBe(5440442338);
    expect(v.catalogVariantId).toBe(10798);
    expect(v.id).not.toBe(v.catalogVariantId);
  });

  it('enseña el mockup con el diseño, nunca el producto en blanco', () => {
    // El bug de la ficha (31/08/2026): se pintaba `product.image`, que es la
    // botella lisa del catálogo de Printful, sin nuestro logo.
    const v = normalizarDetalle(DETALLE_REAL)!.variantes[0];
    expect(v.imagen).toBe('https://files.cdn.printful.com/mockup-botella.png');
    expect(v.imagen).not.toBe('https://files.cdn.printful.com/v.png');
    expect(v.imagen).not.toBe('https://files.cdn.printful.com/logo-suelto.png');
  });

  it('junta todos los previews en la galería, sin repetir', () => {
    expect(normalizarDetalle(DETALLE_REAL)!.variantes[0].imagenes).toEqual([
      'https://files.cdn.printful.com/mockup-botella.png',
      'https://files.cdn.printful.com/mockup-botella-2.png',
    ]);
  });

  it('sin fichero de preview cae al thumbnail del producto (que sí lleva diseño)', () => {
    const sinPreview = {
      ...DETALLE_REAL,
      sync_variants: [{ ...DETALLE_REAL.sync_variants[0], files: [{ id: 1, type: 'default' }] }],
    };
    const v = normalizarDetalle(sinPreview)!.variantes[0];
    expect(v.imagen).toBe('https://files.cdn.printful.com/botella.png');
    // Una sola foto: la ficha oculta la tira de miniaturas.
    expect(v.imagenes).toHaveLength(1);
  });

  it('convierte el precio decimal de Printful a céntimos', () => {
    expect(normalizarDetalle(DETALLE_REAL)!.variantes[0].precioCents).toBe(2700);
    expect(precioACents('6.49')).toBe(649);
    expect(precioACents('0.10')).toBe(10);
    expect(precioACents(undefined)).toBe(0);
    expect(precioACents('-5')).toBe(0);
  });

  it('lee el catalogVariantId también si solo viene anidado en `product`', () => {
    const sinRaiz = {
      ...DETALLE_REAL,
      sync_variants: [{ ...DETALLE_REAL.sync_variants[0], variant_id: undefined }],
    };
    expect(normalizarDetalle(sinRaiz)!.variantes[0].catalogVariantId).toBe(10798);
  });

  it('marca no disponible cuando availability_status no es active', () => {
    const agotado = {
      ...DETALLE_REAL,
      sync_variants: [{ ...DETALLE_REAL.sync_variants[0], availability_status: 'discontinued' }],
    };
    expect(normalizarDetalle(agotado)!.variantes[0].disponible).toBe(false);
  });

  it('devuelve null si la respuesta no trae sync_product', () => {
    expect(normalizarDetalle({} as Record<string, unknown>)).toBeNull();
  });

  it('normaliza la fila de la parrilla', () => {
    const r = normalizarResumen({ id: 455830220, name: 'Botella', thumbnail_url: 'x.png', variants: 3 });
    expect(r).toEqual({ id: 455830220, nombre: 'Botella', imagen: 'x.png', numVariantes: 3 });
  });

  it('limpia los caracteres invisibles del nombre de la tarifa', () => {
    // Printful devuelve word-joiners (U+2060) dentro del nombre del envío.
    const t = normalizarTarifa({
      id: 'STANDARD',
      name: 'Envío estándar⁠ (2-5 días)⁠',
      rate: '6.49',
      currency: 'EUR',
      minDeliveryDays: 2,
      maxDeliveryDays: 5,
    });
    expect(t.nombre).toBe('Envío estándar (2-5 días)');
    expect(t.nombre).not.toMatch(/[⁠​]/);
    expect(t.precioCents).toBe(649);
    expect(t.diasMin).toBe(2);
  });
});

describe('itemsParaTarifas / itemsParaPedido — el error nº1 de esta integración', () => {
  const variante: VarianteTienda = {
    id: 5440442338,
    catalogVariantId: 10798,
    nombre: 'Talla única',
    precioCents: 2700,
    moneda: 'EUR',
    imagen: null,
    imagenes: [],
    disponible: true,
  };
  const lineas: LineaResuelta[] = [{ variante, cantidad: 2 }];

  it('/shipping/rates recibe el id de CATÁLOGO, nunca el sync id', () => {
    const items = itemsParaTarifas(lineas);
    expect(items).toEqual([{ variant_id: 10798, quantity: 2 }]);
    // Si alguien "simplifica" usando variante.id, la API responde
    // 400 Invalid variant ID: este assert lo caza antes de desplegar.
    expect(items[0].variant_id).not.toBe(variante.id);
  });

  it('el pedido recibe el SYNC id (es el que lleva el diseño impreso)', () => {
    const items = itemsParaPedido(lineas);
    expect(items).toEqual([{ sync_variant_id: 5440442338, quantity: 2 }]);
    expect(items[0].sync_variant_id).not.toBe(variante.catalogVariantId);
  });

  it('falla en claro si una variante llega sin catalogVariantId', () => {
    const rota: LineaResuelta[] = [{ variante: { ...variante, catalogVariantId: 0 }, cantidad: 1 }];
    expect(() => itemsParaTarifas(rota)).toThrow(/catalogVariantId/);
    // El pedido sí puede seguir: solo necesita el sync id.
    expect(itemsParaPedido(rota)[0].sync_variant_id).toBe(5440442338);
  });
});

describe('precios', () => {
  // Intl separa importe y símbolo con un espacio DURO (U+00A0), no uno
  // normal — es lo correcto (impide que el € salte solo a la línea
  // siguiente), pero rompe cualquier comparación escrita con espacio normal.
  const NBSP = ' ';

  it('agrupa los miles (useGrouping always, lección de 21dc4f7)', () => {
    expect(formatoPrecio(2700)).toBe(`27,00${NBSP}€`);
    expect(formatoPrecio(100000)).toBe(`1.000,00${NBSP}€`);
    expect(formatoPrecio(0)).toBe(`0,00${NBSP}€`);
  });

  it('suma el carrito por líneas', () => {
    expect(
      subtotalCents([
        { precioCents: 2700, cantidad: 2 },
        { precioCents: 1550, cantidad: 1 },
      ]),
    ).toBe(6950);
    expect(subtotalCents([])).toBe(0);
  });
});

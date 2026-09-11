import { describe, it, expect } from 'vitest';
import { formatearNumeroAfiliado, numeroDesdeBusqueda } from './numero';

describe('número de socio', () => {
  it('rellena a cinco dígitos y no recorta los que se pasan', () => {
    expect(formatearNumeroAfiliado(1)).toBe('00001');
    expect(formatearNumeroAfiliado(42)).toBe('00042');
    expect(formatearNumeroAfiliado(99999)).toBe('99999');
    expect(formatearNumeroAfiliado(123456)).toBe('123456');
  });

  it('devuelve null si no hay número (usuario no socio)', () => {
    expect(formatearNumeroAfiliado(null)).toBeNull();
    expect(formatearNumeroAfiliado(undefined)).toBeNull();
  });

  it('el buscador entiende el número con y sin ceros delante', () => {
    expect(numeroDesdeBusqueda('42')).toBe(42);
    expect(numeroDesdeBusqueda('00042')).toBe(42);
    expect(numeroDesdeBusqueda('Socio 42')).toBe(42);
  });

  it('devuelve null cuando se busca texto sin dígitos', () => {
    expect(numeroDesdeBusqueda('Ana García')).toBeNull();
    expect(numeroDesdeBusqueda('')).toBeNull();
  });
});

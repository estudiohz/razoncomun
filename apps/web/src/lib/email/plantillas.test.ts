import { describe, expect, it } from 'vitest';
import { correoBienvenida } from './plantillas';

/**
 * El correo de bienvenida llevaba "a los 3 meses de antigüedad" escrito a
 * mano, mientras la regla real la fija un ajuste del admin. Estos tests
 * cuidan que el plazo que se le promete a quien se hace socio sea el que se
 * pasa, y que si falta caiga en el mismo valor que la base de datos.
 */
const BASE = { nombre: 'Ana', periodo: 'monthly' as const, amountCents: 500 };

describe('correoBienvenida: plazo para votar', () => {
  it('usa el plazo que se le pasa, en el texto plano y en el HTML', () => {
    const c = correoBienvenida({ ...BASE, plazoVoto: 'a partir de 2 días de antigüedad' });
    expect(c.texto).toContain('departamento (a partir de 2 días de antigüedad).');
    expect(c.html).toContain('departamento (a partir de 2 días de antigüedad).');
  });

  it('sin plazo cae al valor por defecto (7 días, el de la migración 0019)', () => {
    const c = correoBienvenida(BASE);
    expect(c.texto).toContain('a partir de 7 días de antigüedad');
    expect(c.html).toContain('a partir de 7 días de antigüedad');
  });

  it('ya no promete "3 meses" a nadie', () => {
    const c = correoBienvenida({ ...BASE, plazoVoto: 'a partir de 2 días de antigüedad' });
    expect(c.texto).not.toMatch(/3 meses/);
    expect(c.html).not.toMatch(/3 meses/);
  });

  it('con 0 días el texto sigue siendo una frase correcta', () => {
    const c = correoBienvenida({ ...BASE, plazoVoto: 'desde el primer día' });
    expect(c.texto).toContain('departamento (desde el primer día).');
  });
});

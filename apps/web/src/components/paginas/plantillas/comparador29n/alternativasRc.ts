import type { ApartadoRc, PropuestaRc } from './tipos';
import vivienda from './rc/vivienda.json';
import energia from './rc/energia.json';
import inmigracion from './rc/inmigracion.json';
import turismo from './rc/turismo.json';
import sanidad from './rc/sanidad.json';
import educacion from './rc/educacion.json';
import trabajo from './rc/trabajo.json';
import autonomos from './rc/autonomos.json';
import economia from './rc/economia.json';

/**
 * Propuestas de Razón Común por apartado (rc/<id>.json): dato del problema,
 * cómo se mide, competencia, verificación con la misma vara que al resto y
 * `seguimiento` para marcar el cumplimiento durante la legislatura.
 */
const TODAS = [vivienda, energia, inmigracion, turismo, sanidad, educacion, trabajo, autonomos, economia] as unknown as ApartadoRc[];

export const ALTERNATIVAS_RC: Record<string, PropuestaRc[]> = Object.fromEntries(TODAS.map((a) => [a.id, a.propuestas]));

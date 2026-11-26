import type { Apartado } from '../tipos';
import vivienda from './vivienda.json';
import energia from './energia.json';
import inmigracion from './inmigracion.json';
import turismo from './turismo.json';
import sanidad from './sanidad.json';
import educacion from './educacion.json';
import trabajo from './trabajo.json';
import autonomos from './autonomos.json';
import economia from './economia.json';
import pensiones from './pensiones.json';
import corrupcion from './corrupcion.json';
import medioambiente from './medioambiente.json';

/** Orden de los apartados en el comparador. */
export const APARTADOS = [
  vivienda, energia, inmigracion, turismo, sanidad, educacion, trabajo, autonomos, economia, pensiones, corrupcion, medioambiente,
] as unknown as Apartado[];

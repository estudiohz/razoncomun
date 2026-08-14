import { Contenedor } from '@/components/layout/Contenedor';

/**
 * Estado "falta PRINTFUL_API_KEY en el entorno". Compartido por la parrilla
 * y por la ficha: si solo lo maneja una, la otra revienta con un 500
 * (pasó al desplegar T1 — lo cazó el curl de verificación, no el tsc).
 */
export function TiendaNoConfigurada() {
  return (
    <Contenedor as="section" className="py-14">
      <h1 className="text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.12]">Tienda</h1>
      <p className="mt-4 text-[16px] text-cuerpo">La tienda todavía no está configurada en este entorno.</p>
    </Contenedor>
  );
}

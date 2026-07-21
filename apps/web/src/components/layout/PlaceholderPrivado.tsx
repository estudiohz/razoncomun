import { Contenedor } from './Contenedor';
import { Boton } from '@/components/ui/Boton';

/** Placeholder para rutas privadas (client-side, noindex). Marco visual mínimo. */
export function PlaceholderPrivado({
  titulo,
  descripcion,
  dueño,
}: {
  titulo: string;
  descripcion: string;
  dueño: string;
}) {
  return (
    <Contenedor as="section" className="py-20">
      <div className="mx-auto max-w-[520px] rounded-tarjeta border border-linea bg-panel p-10 text-center shadow-nav">
        <h1 className="text-[26px] font-extrabold">{titulo}</h1>
        <p className="mt-3 text-[15px] text-cuerpo">{descripcion}</p>
        <div className="mt-6">
          <Boton href="/" variante="suave">
            Volver a la home
          </Boton>
        </div>
        <p className="mt-8 text-[12.5px] text-gris">Área privada.</p>
      </div>
    </Contenedor>
  );
}

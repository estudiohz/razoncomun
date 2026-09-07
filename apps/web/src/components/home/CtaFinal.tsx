import { Boton } from '@/components/ui/Boton';
import { Contenedor } from '@/components/layout/Contenedor';

/** CTA final: caja blanca con glows de marca y botón de alta ("Únete"). */
export function CtaFinal() {
  return (
    <section className="pb-[100px]">
      <Contenedor>
        <div className="relative overflow-hidden rounded-[28px] border border-linea bg-white px-10 py-20 text-center shadow-caja">
          <div
            className="pointer-events-none absolute -bottom-[300px] -right-[200px] h-[600px] w-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(139,48,217,.10),transparent 65%)' }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -top-[250px] -left-[180px] h-[500px] w-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(43,199,232,.12),transparent 65%)' }}
            aria-hidden
          />
          <h2 className="relative mx-auto max-w-[26ch] text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[1.18]">
            La alternativa que estabas esperando ya existe. Y es tuya.
          </h2>
          {/* "Únete", nunca "Afíliate", y → /unete (Sergio, 02/08 y 07/09/2026).
              Sigue sin pedirse dinero en el primer clic: /unete es la
              ESCALERA, y su primer peldaño es "Crea tu cuenta gratis". Lo que
              cambia respecto a agosto es el destino —antes /entrar, un
              formulario de login—, no la estrategia: quien no quiere pagar
              ve la opción gratis nada más llegar, en vez de tener que buscar
              un enlace pequeño al pie del login. */}
          <p className="relative mx-auto mb-[34px] mt-[18px] max-w-[50ch] text-cuerpo">
            Únete gratis y participa en las propuestas, las votaciones y el programa. Si además
            quieres sostenerlo, hacerte socio está a un paso.
          </p>
          <Boton href="/unete" variante="marca" className="relative">
            Únete
          </Boton>
        </div>
      </Contenedor>
    </section>
  );
}

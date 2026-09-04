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
          {/* "Únete" y no "Afíliate" (Sergio, 02/08/2026), igual que en el nav:
              la puerta grande es entrar gratis y participar; la cuota se pide
              después, con la persona ya dentro. Pedir dinero en el primer clic
              filtra justo a quien todavía no te conoce. La cuota sigue
              nombrada aquí y tiene su sitio en footer, burger y panel. */}
          <p className="relative mx-auto mb-[34px] mt-[18px] max-w-[50ch] text-cuerpo">
            Únete gratis y participa en las propuestas, las votaciones y el programa. Si además
            quieres sostenerlo, hacerte socio está a un paso.
          </p>
          <Boton href="/entrar" variante="marca" className="relative">
            Únete
          </Boton>
        </div>
      </Contenedor>
    </section>
  );
}

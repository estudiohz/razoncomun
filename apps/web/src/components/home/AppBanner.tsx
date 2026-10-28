import { Boton } from '@/components/ui/Boton';
import { VideoInstalarApp } from './VideoInstalarApp';

/**
 * Banner «Instala la app» de la portada, a todo el ancho como el de Discord.
 *
 * Razón Común es una PWA: se instala desde el navegador sin pasar por ninguna
 * tienda. El vídeo enseña el gesto (Compartir → Añadir a pantalla de inicio).
 *
 * Se oculta solo si ya se está dentro de la app instalada (`display-mode:
 * standalone`): ofrecer instalar lo que ya se está usando sobra. Es CSS puro,
 * sin JavaScript ni parpadeo.
 */
export function AppBanner() {
  return (
    <section
      id="instala-la-app"
      className="relative overflow-hidden bg-[linear-gradient(120deg,#12a692_0%,#6f2fc4_55%,#b02f8f_100%)] px-6 py-[84px] [@media(display-mode:standalone)]:hidden"
    >
      <div className="mx-auto grid max-w-[1160px] items-center gap-10 min-[860px]:grid-cols-[1.25fr_.75fr] min-[860px]:gap-14">
        <div className="text-center min-[860px]:text-left">
          <span className="mb-[18px] inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[12px] font-bold text-white backdrop-blur-[4px]">
            <span aria-hidden>📲</span> Instala la app
          </span>
          {/* En escritorio, siempre dos líneas: «Instala Razón Común» / «como una app en tu móvil». */}
          <h2 className="text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.16] tracking-[-.02em] !text-white">
            Instala Razón Común <span className="min-[860px]:block">como una app en tu móvil</span>
          </h2>
          <p className="mx-auto mb-6 mt-4 max-w-[48ch] text-[16px] text-white/90 min-[860px]:mx-0">
            Ahora puedes usar Razón Común como una aplicación: sin tiendas, sin descargas y sin ocupar
            espacio. Abre la web, inicia sesión y guárdala en tu pantalla de inicio: propón ideas, vota y
            sigue cada propuesta con avisos cuando algo que sigues cambie.
          </p>
          <ul className="mb-8 flex flex-col items-center gap-2 text-[14.5px] font-semibold text-white min-[860px]:items-start">
            <li>✓ Gratis y en menos de 10 segundos</li>
            <li>✓ iPhone (Safari) y Android (Chrome)</li>
            <li>✓ Se actualiza sola, siempre la última versión</li>
          </ul>
          <Boton href="/unete" variante="suave">
            Únete y participa
          </Boton>
        </div>

        <div className="mx-auto w-full max-w-[420px]">
          <VideoInstalarApp />
        </div>
      </div>
    </section>
  );
}

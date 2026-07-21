import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { PreguntaChat } from '@/components/chat/PreguntaChat';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Pregunta a Razón Común',
  descripcion:
    'Chat público de Razón Común: responde únicamente con el programa y la actividad publicada del partido, siempre citando la fuente. Es una IA, no decide nada — informa.',
  ruta: '/pregunta',
});

/**
 * "Pregunta a Razón Común" (docs/tecnico/rc-brain.md, fase 3 del RC-Brain).
 * Página de transparencia + el chat: explica qué es, qué corpus usa y sus
 * límites (salvaguarda explícita de rc-brain.md) antes del propio widget.
 */
export default async function PreguntaPage() {
  // Leemos la sesión para saber si ofrecer el formulario de "Complementa la
  // información" (registrados) o el CTA de registro (anónimos). Esto vuelve la
  // página dinámica, aceptable para un chat interactivo.
  const { user } = await getUsuarioYPerfil();
  const autenticado = Boolean(user);

  return (
    <section className="pb-[70px] pt-10">
      <Contenedor>
        <div className="relative overflow-hidden rounded-[28px] bg-noche px-[54px] py-[64px] text-white max-[960px]:px-[22px] max-[960px]:py-10">
          {/* Ambiente "Jarvis" replicado de IASection: retícula + glows animados */}
          <div className="ia-reticula pointer-events-none absolute inset-0" aria-hidden />
          <span
            className="glow-flota-1 pointer-events-none absolute -right-[140px] -top-[200px] h-[480px] w-[480px] rounded-full blur-[10px]"
            style={{ background: 'radial-gradient(circle,rgba(139,48,217,.3),transparent 65%)' }}
            aria-hidden
          />
          <span
            className="glow-flota-2 pointer-events-none absolute -bottom-[220px] -left-[150px] h-[440px] w-[440px] rounded-full blur-[10px]"
            style={{ background: 'radial-gradient(circle,rgba(43,199,232,.22),transparent 65%)' }}
            aria-hidden
          />

          {/* Núcleo de IA en pequeño, a la derecha (decorativo) */}
          <div
            className="absolute right-9 top-14 z-[1] flex aspect-square w-[150px] items-center justify-center max-[1100px]:hidden"
            aria-hidden
          >
            <span className="anillo a1 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
            <span className="anillo a2 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
            <span className="anillo a3 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
            <span className="orbita absolute inset-3 rounded-full border border-dashed border-white/20">
              <i className="absolute -top-[4px] left-1/2 -ml-1 h-2 w-2 rounded-full bg-cian shadow-[0_0_10px_#2BC7E8]" />
              <i className="absolute bottom-[12%] right-[2%] h-2 w-2 rounded-full bg-magenta shadow-[0_0_10px_#C3369E]" />
              <i className="absolute bottom-[12%] left-[2%] h-2 w-2 rounded-full bg-naranja shadow-[0_0_10px_#E8792F]" />
            </span>
            <svg
              className="drop-shadow-[0_0_18px_rgba(43,199,232,.5)]"
              width="76"
              height="76"
              viewBox="0 0 100 100"
              fill="none"
            >
              <defs>
                <linearGradient id="gia-pregunta" x1="0" y1="80" x2="100" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2BC7E8" />
                  <stop offset=".35" stopColor="#8B30D9" />
                  <stop offset=".65" stopColor="#C3369E" />
                  <stop offset="1" stopColor="#E8792F" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="38" stroke="url(#gia-pregunta)" strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
          <div className="relative z-[2] mx-auto max-w-[720px] text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cian/35 px-4 py-2 text-[12.5px] font-bold tracking-[.12em] text-[#7FE3F2]">
              <i className="inline-block h-[7px] w-[7px] rounded-full bg-cian" />
              PREGUNTA A RAZÓN COMÚN · IA
            </span>
            <h1 className="mb-4 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.14] !text-white">
              El programa de Razón Común, respondido con fuentes.
            </h1>
            <p className="mx-auto mb-8 max-w-[60ch] text-[15px] text-white/[.72]">
              Soy una inteligencia artificial, no una persona del partido. Solo respondo con lo que
              hay publicado en el programa de Razón Común — nunca con opinión propia. Si no está en
              mi base de datos, te lo digo en vez de inventar. Las decisiones del partido las toman
              personas, no yo. Por favor, haz preguntas sencillas y cortas.
            </p>
          </div>

          <div className="relative z-[2]">
            <PreguntaChat autenticado={autenticado} />
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

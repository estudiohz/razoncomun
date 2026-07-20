import { Contenedor } from '@/components/layout/Contenedor';
import { OpinaMiniChat } from '@/components/chat/OpinaMiniChat';

/**
 * "Habla con nuestra IA" — registro tech (Jarvis). Fondo noche #0A1633 con
 * retícula técnica, glows morado/cian animados y el aro del logo como núcleo
 * de IA con anillos de pulso y órbita. Fiel a boceto-4-teal.html.
 *
 * La UI conversacional (input + burbujas) vive en <OpinaMiniChat> (rc-08):
 * llama a /api/opina, que dispara el entrevistador de chatbot-opina.md.
 */
export function IASection() {
  return (
    <section className="pb-[70px] pt-5">
      <Contenedor>
        <div className="relative overflow-hidden rounded-[28px] bg-noche px-[54px] py-[76px] text-white max-[960px]:px-[26px] max-[960px]:py-14">
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

          <div className="relative z-[2] grid grid-cols-[1.05fr_.95fr] items-center gap-14 max-[960px]:grid-cols-1 max-[960px]:gap-[46px]">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cian/35 px-4 py-2 text-[12.5px] font-bold tracking-[.12em] text-[#7FE3F2]">
                <i className="inline-block h-[7px] w-[7px] rounded-full bg-cian" />
                OPINA · IA DE RAZÓN COMÚN
              </span>
              <h2 className="max-w-[18ch] text-[clamp(26px,3.2vw,40px)] font-extrabold leading-[1.14] !text-white">
                Habla con nuestra IA y{' '}
                <span className="bg-[linear-gradient(90deg,#2BC7E8,#8B30D9)] bg-clip-text text-transparent">
                  aporta tu idea
                </span>
                .
              </h2>
              <p className="my-4 max-w-[48ch] text-[15.5px] text-white/[.72]">
                Cuéntale qué cambiarías de España. Ella escucha, clasifica tu propuesta y la
                comunidad la delibera y la vota. Tu idea puede acabar en el programa.
              </p>

              <OpinaMiniChat />
            </div>

            {/* Núcleo de IA */}
            <div
              className="relative mx-auto flex aspect-square w-[min(300px,76vw)] items-center justify-center max-[960px]:order-first"
              aria-hidden
            >
              <span className="anillo a1 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
              <span className="anillo a2 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
              <span className="anillo a3 absolute inset-0 rounded-full border border-cian/40 opacity-0" />
              <span className="orbita absolute inset-6 rounded-full border border-dashed border-white/20">
                <i className="absolute -top-[5px] left-1/2 -ml-[5px] h-2.5 w-2.5 rounded-full bg-cian shadow-[0_0_12px_#2BC7E8]" />
                <i className="absolute bottom-[12%] right-[2%] h-2.5 w-2.5 rounded-full bg-magenta shadow-[0_0_12px_#C3369E]" />
                <i className="absolute bottom-[12%] left-[2%] h-2.5 w-2.5 rounded-full bg-naranja shadow-[0_0_12px_#E8792F]" />
              </span>
              <svg
                className="drop-shadow-[0_0_24px_rgba(43,199,232,.5)]"
                width="150"
                height="150"
                viewBox="0 0 100 100"
                fill="none"
              >
                <defs>
                  <linearGradient id="gia" x1="0" y1="80" x2="100" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2BC7E8" />
                    <stop offset=".35" stopColor="#8B30D9" />
                    <stop offset=".65" stopColor="#C3369E" />
                    <stop offset="1" stopColor="#E8792F" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="38" stroke="url(#gia)" strokeWidth="12" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

import { site } from '@/lib/site';

const discordPath =
  'M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419Z';

/** CTA parallax a Discord: foto de debate con degradado de marca fijo. */
export function DiscordParallax() {
  return (
    <section className="parallax-bg relative overflow-hidden px-6 py-[130px] text-center">
      <div className="relative mx-auto max-w-[720px]">
        <div className="mx-auto mb-[22px] flex h-[66px] w-[66px] items-center justify-center rounded-[20px] border border-white/35 bg-white/[.14] backdrop-blur-[4px]">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d={discordPath} />
          </svg>
        </div>
        <h2 className="mx-auto max-w-[20ch] text-[clamp(28px,3.8vw,46px)] font-extrabold leading-[1.14] tracking-[-.02em] !text-white">
          Únete a nuestros grupos de debate en Discord
        </h2>
        <p className="mx-auto mb-8 mt-[18px] max-w-[48ch] text-[17px] text-white/85">
          El programa se construye conversando. Comparte tu opinión, propón mejoras y debate cada
          punto con la comunidad — así nace la política basada en datos.
        </p>
        <a
          href={site.discord}
          className="inline-flex items-center gap-[11px] rounded-boton bg-[#5865F2] px-8 py-[15px] text-base font-bold text-white no-underline shadow-[0_10px_28px_rgba(0,0,0,.28)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden>
            <path d={discordPath} />
          </svg>
          Entrar en el Discord
        </a>
      </div>
    </section>
  );
}

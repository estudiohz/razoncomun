import { site } from '@/lib/site';
import { DiscordWidgetEnVivo } from './DiscordWidgetEnVivo';

const discordPath =
  'M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.42 2.157-2.42 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419Z';

/**
 * CTA a Discord con el widget en vivo (rediseño 16/09/2026: antes solo icono
 * + texto + botón; ahora se ve la comunidad real — quién está conectado —
 * junto a la llamada a la acción). Foto de debate + degradado de marca fijo,
 * igual que antes.
 *
 * El widget en sí (iframe de discord.com) es un Client Component aparte,
 * `DiscordWidgetEnVivo`: carga diferida al hacer scroll — ver el porqué ahí.
 */
export function DiscordParallax() {
  return (
    <section className="parallax-bg relative overflow-hidden px-6 py-[100px]">
      <div className="relative mx-auto grid max-w-[1040px] items-center gap-10 min-[860px]:grid-cols-[1.05fr_.95fr] min-[860px]:gap-14">
        <div className="text-center min-[860px]:text-left">
          <span className="mb-[18px] inline-flex items-center gap-[9px] rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[12px] font-bold text-white backdrop-blur-[4px]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#3BA55C] shadow-[0_0_0_3px_rgba(59,165,92,.3)]" />
            Comunidad activa ahora mismo
          </span>
          <h2 className="max-w-[18ch] text-[clamp(28px,3.6vw,42px)] font-extrabold leading-[1.16] tracking-[-.02em] !text-white min-[860px]:mx-0 mx-auto">
            Únete a nuestros grupos de debate en Discord
          </h2>
          <p className="mb-7 mt-[16px] max-w-[46ch] text-[16px] text-white/85 min-[860px]:mx-0 mx-auto">
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

        <div className="mx-auto w-full max-w-[380px]">
          <DiscordWidgetEnVivo serverId={site.discordServerId} />
          <p className="mt-3.5 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3BA55C]" />
            Quién está conectado, en directo
          </p>
        </div>
      </div>
    </section>
  );
}

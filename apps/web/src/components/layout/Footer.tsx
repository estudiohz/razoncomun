import Image from 'next/image';
import Link from 'next/link';
import { Contenedor } from './Contenedor';
import { IconoRed } from './iconos-redes';
import { navFooter, redesSociales, site } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

type EnlaceCms = { slug: string; title: string; show_footer: boolean; show_legal: boolean };

/**
 * Footer: aviso de registro + enlaces. Los enlaces legales/de página salen de
 * la tabla `pages` (CMS) según sus checkboxes "footer" y "legal"; los fijos
 * (Contacto, Discord) de `navFooter`. Lee como anon: RLS solo devuelve páginas
 * publicadas.
 */
export async function Footer() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pages')
    .select('slug, title, show_footer, show_legal')
    .eq('published', true)
    .or('show_footer.eq.true,show_legal.eq.true')
    .order('position');

  const paginas = (data ?? []) as EnlaceCms[];
  const enFooter = paginas.filter((p) => p.show_footer);
  const enLegal = paginas.filter((p) => p.show_legal);

  const claseEnlace = 'text-[13.5px] font-semibold text-white/85 no-underline hover:text-white';

  return (
    /* Full-bleed: el degradado de marca ocupa todo el ancho de la ventana;
       el contenido se alinea dentro del Contenedor habitual (max-w-wrap). */
    <footer className="bg-grad py-8 text-white">
      <Contenedor>
        {/* Móvil: logo centrado y las 8 redes en una rejilla 4x2 también
            centrada (petición de Sergio — el wrap libre partía en 5+3 o 6+2
            según el ancho y quedaba descolgado). En ≥720px, lo de siempre:
            logo a la izquierda, iconos en fila a la derecha. */}
        <div className="flex flex-col items-center gap-6 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:justify-between min-[720px]:gap-5">
          <Image
            src="/logo-rc-blanco.png"
            alt={site.nombre}
            width={1400}
            height={225}
            className="h-8 w-auto"
          />
          <div className="grid grid-cols-4 justify-items-center gap-3 min-[720px]:flex min-[720px]:flex-wrap min-[720px]:items-center">
            {redesSociales.map((red) => (
              <a
                key={red.nombre}
                href={red.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={red.aria}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:border-white hover:bg-white/20"
              >
                <IconoRed nombre={red.icono} className="h-[17px] w-[17px]" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-[26px] gap-y-2 border-t border-white/20 pt-6">
          {enFooter.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className={claseEnlace}>
              {p.title}
            </Link>
          ))}
          {navFooter.map((item) => (
            <Link key={item.href} href={item.href} className={claseEnlace}>
              {item.label}
            </Link>
          ))}
          <Link href="/entrar" className={claseEnlace}>
            Entrar
          </Link>
        </div>

        {enLegal.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {enLegal.map((p) => (
              <Link
                key={p.slug}
                href={`/${p.slug}`}
                className="text-[12.5px] text-white/65 no-underline hover:text-white/90"
              >
                {p.title}
              </Link>
            ))}
          </div>
        )}

        <p className="mt-7 text-[12.5px] text-white/60">
          © {new Date().getFullYear()} {site.nombre}. {site.registro} NIF: G26753582.
        </p>
      </Contenedor>
    </footer>
  );
}

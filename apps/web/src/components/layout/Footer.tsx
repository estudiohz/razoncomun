import Link from 'next/link';
import { Contenedor } from './Contenedor';
import { navFooter, site } from '@/lib/site';
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

  const claseEnlace = 'text-[13px] font-medium text-cuerpo no-underline hover:text-titular';

  return (
    <footer className="pb-[50px] pt-4">
      <Contenedor>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <p className="text-[13px] text-gris">
            © {new Date().getFullYear()} {site.nombre}. {site.registro}
          </p>
          <div className="flex flex-wrap items-center gap-[26px]">
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
        </div>

        {enLegal.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-linea pt-4">
            {enLegal.map((p) => (
              <Link
                key={p.slug}
                href={`/${p.slug}`}
                className="text-[12.5px] text-gris no-underline hover:text-titular"
              >
                {p.title}
              </Link>
            ))}
          </div>
        )}
      </Contenedor>
    </footer>
  );
}

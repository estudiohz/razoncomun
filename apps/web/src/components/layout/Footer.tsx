import Link from 'next/link';
import { Contenedor } from './Contenedor';
import { navFooter, site } from '@/lib/site';

/** Footer del boceto: aviso de registro + enlaces legales. */
export function Footer() {
  return (
    <footer className="pb-[50px] pt-4">
      <Contenedor className="flex flex-wrap items-center justify-between gap-5">
        <p className="text-[13px] text-gris">
          © {new Date().getFullYear()} {site.nombre}. {site.registro}
        </p>
        <div className="flex items-center gap-[26px]">
          {navFooter.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-cuerpo no-underline hover:text-titular"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/entrar"
            className="text-[13px] font-medium text-cuerpo no-underline hover:text-titular"
          >
            Entrar
          </Link>
        </div>
      </Contenedor>
    </footer>
  );
}

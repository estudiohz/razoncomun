import Image from 'next/image';
import Link from 'next/link';
import { Boton } from '@/components/ui/Boton';
import { navPrincipal, site } from '@/lib/site';

/** Nav flotante translúcido con logo e ítems. Fiel a boceto-4-teal.html. */
export function Nav() {
  return (
    <nav className="sticky top-3.5 z-50 my-3.5">
      <div className="mx-auto w-full max-w-wrap px-8">
        <div className="flex h-16 items-center justify-between rounded-[18px] border border-linea bg-white/85 px-[22px] shadow-nav backdrop-blur-[14px]">
          <Link href="/" className="flex items-center gap-3 no-underline" aria-label={site.nombre}>
            <Image
              src="/logo-rc.png"
              alt={site.nombre}
              width={150}
              height={34}
              priority
              className="h-[34px] w-auto"
            />
          </Link>
          <div className="flex items-center gap-[26px]">
            {navPrincipal.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hidden text-sm font-medium text-cuerpo no-underline hover:text-titular min-[960px]:inline"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/entrar"
              className="text-sm font-medium text-cuerpo no-underline hover:text-titular"
            >
              Entrar
            </Link>
            <Boton href="/afiliate" variante="grad" className="px-[22px] py-[9px] text-sm">
              Afíliate
            </Boton>
          </div>
        </div>
      </div>
    </nav>
  );
}

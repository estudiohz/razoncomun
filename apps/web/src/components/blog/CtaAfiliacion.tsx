import Link from 'next/link';

/**
 * CTA de afiliación del sidebar (.side-cta del boceto): tarjeta con el
 * degradado de marca y botón blanco. El degradado usa `bg-grad`, el token
 * de rc-04 — mismo `linear-gradient(120deg,#24AF9A,#8B30D9,#C3369E)` del boceto.
 */
export function CtaAfiliacion() {
  return (
    <section className="rounded-[16px] bg-grad p-6 text-white">
      <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[.08em] text-white/80">
        Súmate
      </h2>
      <p className="mb-4 text-[14.5px] text-white/[.92]">
        Este análisis lo hace posible la comunidad. Afíliate y decide qué investigamos.
      </p>
      <Link
        href="/afiliate"
        className="inline-block rounded-[11px] bg-white px-[22px] py-[11px] text-[14px] font-bold text-accion no-underline"
      >
        Afíliate
      </Link>
    </section>
  );
}

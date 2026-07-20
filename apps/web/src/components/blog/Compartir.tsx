/**
 * Barra de compartir (.compartir del boceto).
 *
 * Enlaces de intención puros — sin SDK de terceros, sin scripts de redes y
 * sin cookies: nada que consentir y coste cero, coherente con el presupuesto
 * del proyecto y con no filtrar a los lectores a plataformas externas.
 */
export function Compartir({ url, titulo }: { url: string; titulo: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);

  const redes = [
    { nombre: 'X', simbolo: '𝕏', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { nombre: 'Facebook', simbolo: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { nombre: 'WhatsApp', simbolo: '✆', href: `https://api.whatsapp.com/send?text=${t}%20${u}` },
    { nombre: 'LinkedIn', simbolo: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];

  return (
    <div className="mt-[34px] flex items-center gap-[10px] border-t border-linea pt-6">
      <span className="text-[13px] font-bold text-gris">Compartir:</span>
      {redes.map((r) => (
        <a
          key={r.nombre}
          href={r.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${r.nombre}`}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-linea bg-panel text-tinta no-underline transition-colors duration-200 hover:border-titular hover:text-titular"
        >
          <span aria-hidden>{r.simbolo}</span>
        </a>
      ))}
    </div>
  );
}

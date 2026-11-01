/**
 * Mención del origen de un caso (0073): el reel, artículo o web del que nace,
 * con su autor o medio. Va en toda ficha pública: el caso parte del trabajo
 * de otros y se reconoce.
 */
export function MencionOrigen({
  url,
  autor,
  autorUrl,
  className = '',
}: {
  url: string | null;
  autor: string | null;
  autorUrl?: string | null;
  className?: string;
}) {
  if (!url && !autor) return null;
  const esVideo = Boolean(url && /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/i.test(url));
  return (
    <p className={`text-[13px] text-gris ${className}`}>
      Origen:{' '}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold">
          {esVideo ? 'reel' : 'publicación'}
        </a>
      ) : esVideo ? (
        'reel'
      ) : (
        'publicación'
      )}
      {autor && (
        <>
          {' de '}
          {autorUrl ? (
            <a href={autorUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold">
              {autor}
            </a>
          ) : (
            <strong>{autor}</strong>
          )}
        </>
      )}
      . Verificado por Razón Común contra la fuente oficial.
    </p>
  );
}

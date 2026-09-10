import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { FormularioVideoDestacado } from './FormularioVideoDestacado';

/**
 * `/admin/portada` — vídeo destacado de la home (10/09/2026).
 *
 * Sustituye el tercer hueco de "Lo último del blog" (que pasa a llamarse
 * "Actualidad") por una carátula con play que abre un vídeo de YouTube.
 * Ver `lib/home/video-destacado.ts` para el modelo de datos.
 *
 * SOLO admin — mismo nivel que el resto de `/admin/ajustes`: es contenido
 * que ve cualquier visitante de la home, no una acción de un editor.
 */
export default async function PortadaAdminPage() {
  const { supabase } = await requireAdmin('/admin/portada');

  const { data: filas } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['home_video_url', 'home_video_caratula']);

  const porClave = new Map((filas ?? []).map((f) => [f.key, f.value]));
  const urlActual = typeof porClave.get('home_video_url') === 'string' ? String(porClave.get('home_video_url')) : '';
  const caratulaActual =
    typeof porClave.get('home_video_caratula') === 'string' ? String(porClave.get('home_video_caratula')) : '';

  return (
    <div className="max-w-[640px] space-y-8">
      <div>
        <h1 className="text-[24px] font-extrabold">Portada</h1>
        <p className="mt-1.5 text-[14px] text-gris">
          El vídeo destacado que sustituye el tercer hueco de "Actualidad" en la home pública.
        </p>
      </div>

      <Tarjeta className="p-6">
        <FormularioVideoDestacado urlInicial={urlActual} caratulaInicial={caratulaActual} />
      </Tarjeta>
    </div>
  );
}

import { permanentRedirect } from 'next/navigation';

/**
 * El listado de moderación pasó a ser la raíz `/admin/participacion` (antes
 * esta ruta era el listado y la raíz un hub de botones sin datos). Se conserva
 * como redirect 308 porque estaba enlazada desde el nav del panel y desde la
 * ficha de cada propuesta.
 *
 * OJO: `/admin/participacion/propuestas/[id]` (la ficha de moderación) NO se
 * ve afectada — es otra ruta y sigue funcionando.
 */
export default function ModeracionPropuestasRedirectPage() {
  permanentRedirect('/admin/participacion');
}

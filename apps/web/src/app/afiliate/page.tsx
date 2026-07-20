import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Afíliate',
  descripcion:
    'Afíliate a Razón Común y convierte tu cuota en recursos, legitimidad y voz para una política basada en evidencia. Autosuficiencia total: el partido se sostiene con sus afiliados.',
  ruta: '/afiliate',
});

export default function AfiliatePage() {
  return (
    <Placeholder
      eyebrow="Afiliación"
      titulo="Convierte tu cuota en una política mejor"
      descripcion="Razón Común se sostiene con sus afiliados: sin dependencia externa. Aquí vivirá el alta con domiciliación SEPA, el mandato y tu certificado fiscal anual."
      dueño="Afiliación/Transparencia (rc-07)"
    />
  );
}

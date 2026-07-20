import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Cuentas al céntimo',
  descripcion:
    'Transparencia financiera total de Razón Común: ingresos por cuotas y cada gasto del partido, con saldo real. Porque predicamos con el ejemplo.',
  ruta: '/cuentas',
});

export default function CuentasPage() {
  return (
    <Placeholder
      eyebrow="Transparencia"
      titulo="Nuestras cuentas, al céntimo"
      descripcion="Ingresos por cuotas y cada gasto del partido, en abierto y con saldo real. Aquí vivirá el panel público de transparencia financiera."
      dueño="Afiliación/Transparencia (rc-07)"
    />
  );
}

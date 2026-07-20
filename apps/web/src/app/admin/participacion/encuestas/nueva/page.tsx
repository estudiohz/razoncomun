import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { ConstructorEncuesta } from '@/components/participacion/ConstructorEncuesta';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Nueva encuesta',
  descripcion: 'Constructor de encuestas multi-pregunta de Razón Común.',
  ruta: '/admin/participacion/encuestas/nueva',
  noindex: true,
});

export default async function NuevaEncuestaPage() {
  const { supabase } = await requireAdminOCoordinador('/admin/participacion/encuestas/nueva');

  const { data: territorios } = await supabase
    .from('territories')
    .select('id, name')
    .eq('type', 'community')
    .order('name');

  return (
    <Contenedor as="section" className="py-14">
      <h1 className="text-[28px] font-extrabold text-titular">Nueva encuesta</h1>
      <div className="mt-8 max-w-[720px]">
        <ConstructorEncuesta territorios={territorios ?? []} />
      </div>
    </Contenedor>
  );
}

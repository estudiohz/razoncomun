/** Departamentos del manifiesto (compartido entre el alta pública y la edición en /admin). */
export const DEPARTAMENTOS = [
  'agricultura-ganaderia',
  'autonomos',
  'economia',
  'educacion',
  'gasto-publico',
  'igualdad',
  'industria',
  'justicia',
  'sanidad',
  'transportes',
  'vivienda',
] as const;

export function etiquetaDepartamento(department: string): string {
  return department.replace(/-/g, ' ');
}

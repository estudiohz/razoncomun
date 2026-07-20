// lib/brain/service/src/manifestoIndex.mjs
//
// Lista compacta de los 30 puntos del manifiesto para dar contexto al
// clasificador de Opina (así "punto del manifiesto" no es una alucinación
// libre del modelo, sino una elección entre 30 opciones conocidas + "fuera de
// programa"). Fuente: CLAUDE.md raíz del proyecto / supabase/seeds/0002_manifesto.sql
// (propiedad de rc-02) -- esto es una copia de solo lectura para prompting,
// no una fuente de verdad: si el manifiesto cambia, actualizar aquí a mano
// (o, mejor, sustituir por una consulta a `manifesto_points` en una futura
// versión -- no bloqueante para este gate).

export const MANIFESTO_POINTS = [
  "1. Cambio de Ecuación — romper el monopolio de la gobernanza con Kaizen y lógica técnica",
  "2. Socios Fundadores sin Cargos — quienes fundan no ocupan cargos políticos",
  "3. Idoneidad Profesional obligatoria — test psicotécnicos y CV verificable",
  "4. Protocolo de Seguridad y Salud — controles aleatorios de alcohol/drogas a políticos",
  "5. Ciudadanización del Senado — 50% senadores ciudadanos con mérito civil",
  "6. Igualdad Geométrica del Voto — una persona, un voto, mismo valor en todo el territorio",
  "7. Rectificación Popular — cesar a un cargo corrupto si el 70% lo vota",
  "8. Voto Blindado — votación online encriptada con auditoría vía DNI-e",
  "9. Justicia Técnica Rápida — separación de poderes, justicia rápida digital",
  "10. Independencia de la Información Pública — medios públicos gestionados por profesionales",
  "11. Eliminación de Aforamientos",
  "12. Puntos de Ciudadanía — pagar impuestos genera puntos canjeables",
  "13. Burocracia Cero y Silencio Positivo — trámites en <24h desde el móvil",
  "14. Auditoría de Gasto Inútil — el ahorro va a Sanidad/Seguridad/Educación",
  "15. Vivienda Lógica — desahucio en 48h, agilización de licencias",
  "16. Trazabilidad del Impuesto Personal — auditar tus impuestos vía DNI-e",
  "17. Modelo Autónomos Cuota Cero — solo cotizar sobre umbral de beneficios",
  "18. Tributación en Origen — tecnológicas extranjeras tributan donde operan",
  "19. Incentivo Fiscal al Valor Humano vs. IA",
  "20. Agencia de Datos Contrastados (AIDC) — anti-desinformación",
  "21. Gestión Lógica de la Inmigración — por capacitación y necesidad real",
  "22. Responsabilidad del Ciudadano",
  "23. Muerte Civil por Corrupción",
  "24. Obligatoriedad Presencial de diputados",
  "25. Obligación de Posicionamiento — prohibido el silencio estratégico",
  "26. Herencia Cero de Deuda Pública",
  "27. Independencia del CIS",
  "28. Prioridad Nacional en Agua y Energía",
  "29. Test de Estrés para Leyes",
  "30. Educación por Talento",
].join("\n");

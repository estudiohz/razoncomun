-- 0002_manifesto.sql
-- Seed de los 30 puntos fundacionales del manifiesto (fuente: CLAUDE.md raíz del
-- repositorio de contexto, sección "El Manifiesto — Los 30 Puntos de Gestión Real").
--
-- ⚠️ DECISIÓN PENDIENTE (a confirmar con el arquitecto/consejo): ningún punto se marca
-- is_core=true en este seed. modelo-datos.md define is_core como "núcleo inmutable, no
-- votable", pero ni CLAUDE.md ni modelo-datos.md especifican QUÉ puntos concretos son
-- núcleo inmutable frente a evolvables por votación del programa vivo. Se deja is_core=false
-- para los 30 por defecto (ningún punto bloqueado) hasta que se decida políticamente cuáles,
-- si alguno, deben protegerse de la mejora continua vía votación.

begin;

insert into public.manifesto_points (id, title, body, is_core) values
(1,  'Cambio de Ecuación', 'Romper el monopolio de la gobernanza con Kaizen y lógica técnica.', false),
(2,  'Socios Fundadores sin Cargos', 'Quienes fundan no ocupan cargos políticos; el presidente es un moderador, no quien decide.', false),
(3,  'Idoneidad Profesional obligatoria', 'Test psicotécnicos y CV verificable para candidatos.', false),
(4,  'Protocolo de Seguridad y Salud', 'Controles aleatorios de alcohol/drogas para políticos.', false),
(5,  'Ciudadanización del Senado', '50% de senadores serán ciudadanos con mérito civil.', false),
(6,  'Igualdad Geométrica del Voto', 'Una persona, un voto, mismo valor en todo el territorio.', false),
(7,  'Rectificación Popular', 'Si el 70% vota por cesar a un cargo corrupto, se cesa inmediatamente.', false),
(8,  'Voto Blindado', 'Votación online encriptada con auditoría individual via DNI-e.', false),
(9,  'Justicia Técnica Rápida', 'Separación real de poderes; Justicia Rápida Digital para pleitos menores.', false),
(10, 'Independencia de la Información Pública', 'Medios públicos gestionados por sus propios profesionales.', false),
(11, 'Eliminación de Aforamientos', 'Los políticos responden ante la ley igual que cualquier ciudadano.', false),
(12, 'Puntos de Ciudadanía', 'Pagar impuestos genera puntos canjeables (descuentos, aval para vivienda).', false),
(13, 'Burocracia Cero y Silencio Positivo', 'Cualquier trámite en menos de 24h desde el móvil.', false),
(14, 'Auditoría de Gasto Inútil', 'Eliminación de "grasa política"; el ahorro va a Sanidad/Seguridad/Educación.', false),
(15, 'Vivienda Lógica', 'Desahucio en 48h, agilización de licencias, mercado libre para bajar precios.', false),
(16, 'Trazabilidad del Impuesto Personal', 'Cada ciudadano puede auditar sus impuestos via DNI-e.', false),
(17, 'Modelo Autónomos "Cuota Cero"', 'Solo se cotiza cuando se supera el umbral de beneficios (~16.000€).', false),
(18, 'Tributación en Origen', 'Las tecnológicas extranjeras tributan donde operan.', false),
(19, 'Incentivo Fiscal al Valor Humano vs. IA', 'Bonificaciones para empresas que contraten personas.', false),
(20, 'Agencia de Datos Contrastados (AIDC)', 'Organismo independiente anti-desinformación.', false),
(21, 'Gestión Lógica de la Inmigración', 'Por capacitación y necesidad real, vinculada al respeto a las leyes.', false),
(22, 'Responsabilidad del Ciudadano', 'La pasividad permite la corrupción.', false),
(23, '"Muerte Civil" por Corrupción', 'Pérdida de pensión contributiva y lista al final de sanidad para corruptos.', false),
(24, 'Obligatoriedad Presencial', 'Sanciones económicas a diputados que no asistan.', false),
(25, 'Obligación de Posicionamiento', 'Prohibido el silencio estratégico en temas de Estado.', false),
(26, 'Herencia Cero de Deuda Pública', 'Prohibición de presupuestos con deuda estructural.', false),
(27, 'Independencia del CIS', 'El Gobierno no nombra a quien le audita ni a quien hace estadísticas.', false),
(28, 'Prioridad Nacional en Agua y Energía', 'Gestión técnica unificada por encima de disputas territoriales.', false),
(29, 'Test de Estrés para Leyes', 'Simulación de impacto antes de aplicar cualquier ley.', false),
(30, 'Educación por Talento', 'Detectar y potenciar las capacidades individuales de cada estudiante.', false);

commit;

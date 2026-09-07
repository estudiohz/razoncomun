/**
 * Consentimiento de cookies. La pieza de la que depende todo lo demás.
 *
 * REGLA QUE NO SE AFLOJA: el código de seguimiento (Analytics, píxel de Meta)
 * NO se carga hasta que la persona acepta. Inyectarlo en la cabecera "y ya"
 * dispara las cookies en el primer render, que es exactamente lo que el aviso
 * pretende impedir — y tener el aviso puesto lo empeora, porque acredita que
 * sabías que hacía falta consentimiento.
 *
 * Guía de la AEPD que condiciona el diseño (no son preferencias estéticas):
 *   · Rechazar tiene que ser TAN FÁCIL como aceptar, desde la primera capa y
 *     con el mismo peso visual. Nada de "Aceptar" en color y "Rechazar" en
 *     un enlace gris.
 *   · Sin acción no hay consentimiento: seguir navegando o cerrar el aviso NO
 *     equivale a aceptar.
 *   · Se puede retirar en cualquier momento, y con la misma facilidad.
 *   · El consentimiento caduca: se vuelve a preguntar pasados 24 meses.
 */

export type EstadoConsentimiento = 'aceptado' | 'rechazado';

export const CLAVE_CONSENTIMIENTO = 'rc_cookies_v1';

/** 24 meses, el máximo que la AEPD considera razonable antes de repreguntar. */
export const CADUCIDAD_MESES = 24;

export interface ConsentimientoGuardado {
  estado: EstadoConsentimiento;
  /** ISO. Sirve para caducarlo y como prueba de cuándo se dio. */
  fecha: string;
}

/**
 * Lee la decisión guardada, o null si no hay ninguna válida.
 *
 * Devuelve null también cuando ha caducado o cuando el valor está corrupto:
 * en la duda se vuelve a preguntar, que es el lado seguro. Nunca lanza — un
 * navegador con el almacenamiento bloqueado es un caso esperado, no un error.
 */
export function leerConsentimiento(): ConsentimientoGuardado | null {
  if (typeof window === 'undefined') return null;

  try {
    const crudo = window.localStorage.getItem(CLAVE_CONSENTIMIENTO);
    if (!crudo) return null;

    const dato = JSON.parse(crudo) as Partial<ConsentimientoGuardado>;
    if (dato.estado !== 'aceptado' && dato.estado !== 'rechazado') return null;
    if (!dato.fecha) return null;

    const dado = new Date(dato.fecha);
    if (Number.isNaN(dado.getTime())) return null;

    const caduca = new Date(dado);
    caduca.setMonth(caduca.getMonth() + CADUCIDAD_MESES);
    if (caduca < new Date()) return null;

    return { estado: dato.estado, fecha: dato.fecha };
  } catch {
    return null;
  }
}

/** Guarda la decisión y avisa a quien esté escuchando, sin recargar la página. */
export function guardarConsentimiento(estado: EstadoConsentimiento): void {
  if (typeof window === 'undefined') return;

  const dato: ConsentimientoGuardado = { estado, fecha: new Date().toISOString() };
  try {
    window.localStorage.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(dato));
  } catch {
    // Almacenamiento bloqueado: la decisión vale para esta visita y se
    // volverá a preguntar en la siguiente. Preferible a romper la página.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: dato }));
}

/** Borra la decisión: vuelve a salir el aviso. Es el "retirar el consentimiento". */
export function olvidarConsentimiento(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CLAVE_CONSENTIMIENTO);
  } catch {
    /* nada que hacer */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: null }));
}

/**
 * El aviso y el inyector de código son dos componentes hermanos, no padre e
 * hijo: uno vive al final del layout y el otro donde toque. Un evento del
 * `window` los comunica sin obligar a levantar el estado ni a recargar.
 */
export const EVENTO_CONSENTIMIENTO = 'rc:consentimiento-cookies';

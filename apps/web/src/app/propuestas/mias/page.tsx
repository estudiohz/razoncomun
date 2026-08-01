import { permanentRedirect } from 'next/navigation';

/**
 * "Mis hilos" se integró en el panel del usuario como `/panel/propuestas`
 * (docs/tecnico/panel-usuario.md, ola U2), que además de creadas y seguidas
 * añade las apoyadas y "Mis votos". Se conserva la ruta como redirect
 * permanente (308) porque está enlazada desde el tablero y el menú de usuario.
 */
export default function MisHilosRedirectPage() {
  permanentRedirect('/panel/propuestas');
}

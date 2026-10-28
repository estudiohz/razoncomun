'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const CLAVE = 'rc_app_visto';
const CADA_MS = 12 * 60 * 60 * 1000;

/**
 * Anota en el perfil que la persona tiene la app instalada (columna
 * `profiles.app_installed_at`, migración 0065) para poder verlo en
 * /admin/usuarios.
 *
 * Una PWA no avisa de que se ha instalado: solo se puede saber que la web se
 * abre en modo app (`display-mode: standalone`, o `navigator.standalone` en
 * iOS) o que el navegador dispara `appinstalled` (Android/Chrome). Por eso
 * "instalada" significa "la ha abierto como app con sesión iniciada".
 *
 * Se anota como mucho cada 12 h por dispositivo. Y también al iniciar sesión
 * ya dentro de la app: quien instala la app antes de entrar no tiene sesión la
 * primera vez que se abre, y sin este aviso quedaría sin marcar.
 */
export function RegistroInstalacionApp() {
  useEffect(() => {
    const supabase = createClient();
    const enApp = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;

    async function anotar(forzar = false) {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const ultima = Number(localStorage.getItem(CLAVE) ?? 0);
        if (!forzar && Date.now() - ultima < CADA_MS) return;
        const { error } = await supabase.rpc('mark_app_installed');
        if (!error) localStorage.setItem(CLAVE, String(Date.now()));
      } catch {
        // Sin red o sin localStorage: se reintenta en la próxima visita. No es un error para la persona.
      }
    }

    if (enApp()) void anotar();

    const alInstalar = () => void anotar(true);
    window.addEventListener('appinstalled', alInstalar);

    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' && enApp()) void anotar();
    });

    return () => {
      window.removeEventListener('appinstalled', alInstalar);
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  return null;
}

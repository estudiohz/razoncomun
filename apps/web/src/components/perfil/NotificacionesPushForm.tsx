'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  eliminarSuscripcionPushAction,
  guardarSuscripcionPushAction,
} from '@/app/perfil/actions';

type Estado = 'comprobando' | 'no-soportado' | 'denegado' | 'inactivo' | 'activo';

function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Activar/desactivar avisos push EN ESTE dispositivo (0046). Es deliberadamente
 * por dispositivo, no un interruptor global: alguien puede querer avisos en
 * el móvil pero no en el portátil del trabajo.
 */
export function NotificacionesPushForm() {
  const [estado, setEstado] = useState<Estado>('comprobando');
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEstado('no-soportado');
        return;
      }
      if (Notification.permission === 'denied') {
        setEstado('denegado');
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const sub = await registro.pushManager.getSubscription();
      setEstado(sub ? 'activo' : 'inactivo');
    })();
  }, []);

  function activar() {
    setError(null);
    iniciar(async () => {
      try {
        const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!clavePublica) throw new Error('Push no configurado todavía en este entorno.');

        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
          setEstado(permiso === 'denied' ? 'denegado' : 'inactivo');
          return;
        }

        const registro = await navigator.serviceWorker.ready;
        const sub = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlAUint8Array(clavePublica),
        });

        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await guardarSuscripcionPushAction(
          { endpoint: json.endpoint, keys: json.keys },
          navigator.userAgent,
        );
        if (!r.ok) throw new Error(r.error);
        setEstado('activo');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se ha podido activar.');
      }
    });
  }

  function desactivar() {
    setError(null);
    iniciar(async () => {
      try {
        const registro = await navigator.serviceWorker.ready;
        const sub = await registro.pushManager.getSubscription();
        if (sub) {
          await eliminarSuscripcionPushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setEstado('inactivo');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se ha podido desactivar.');
      }
    });
  }

  if (estado === 'comprobando') return null;

  if (estado === 'no-soportado') {
    return <p className="text-[13px] text-gris">Tu navegador no soporta notificaciones push.</p>;
  }

  if (estado === 'denegado') {
    return (
      <p className="text-[13px] text-gris">
        Bloqueaste los avisos para este sitio en el navegador. Actívalos desde los ajustes del
        sitio (icono de candado en la barra de direcciones) si quieres recibirlos aquí.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[13px] text-cuerpo">
        {estado === 'activo'
          ? 'Recibirás avisos en este dispositivo cuando comenten o respondan a una propuesta que sigues, o cambie de estado.'
          : 'Actívalos para recibir un aviso en este dispositivo, sin depender de abrir la web.'}
      </p>
      <button
        type="button"
        disabled={pendiente}
        onClick={estado === 'activo' ? desactivar : activar}
        className="mt-3 rounded-boton border border-linea bg-white px-4 py-2 text-[13.5px] font-bold text-titular disabled:opacity-60"
      >
        {estado === 'activo' ? 'Desactivar en este dispositivo' : 'Activar avisos en este dispositivo'}
      </button>
      {error && <p className="mt-2 text-[13px] font-semibold text-magenta">{error}</p>}
    </div>
  );
}

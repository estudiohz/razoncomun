'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

type Factor = { id: string; friendly_name?: string | null; status: string };

/**
 * Alta/baja de 2FA (TOTP) desde /perfil. Usa directamente supabase-js
 * (auth.mfa.enroll/challenge/verify/unenroll) — Supabase ya trae el QR
 * como SVG en `totp.qr_code`, no hace falta ninguna librería extra.
 */
export function Seguridad2FA() {
  const router = useRouter();
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [inscribiendo, setInscribiendo] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [factorPendienteId, setFactorPendienteId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarFactores() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactores(data?.totp ?? []);
  }

  useEffect(() => {
    cargarFactores();
  }, []);

  async function iniciarInscripcion() {
    setMensaje(null);
    setCargando(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `RC ${new Date().toISOString().slice(0, 10)}`,
    });
    setCargando(false);
    if (error || !data) {
      setMensaje({ tipo: 'error', texto: 'No hemos podido iniciar el alta de 2FA.' });
      return;
    }
    setFactorPendienteId(data.id);
    setQr(data.totp.qr_code);
    setSecreto(data.totp.secret);
    setInscribiendo(true);
  }

  async function confirmarInscripcion(e: React.FormEvent) {
    e.preventDefault();
    if (!factorPendienteId) return;
    setCargando(true);
    setMensaje(null);
    const supabase = createClient();
    const { data: reto, error: errorReto } = await supabase.auth.mfa.challenge({
      factorId: factorPendienteId,
    });
    if (errorReto || !reto) {
      setCargando(false);
      setMensaje({ tipo: 'error', texto: 'No hemos podido crear el reto de verificación.' });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: factorPendienteId,
      challengeId: reto.id,
      code: codigo,
    });
    setCargando(false);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Código incorrecto. Revisa la hora de tu móvil e inténtalo de nuevo.' });
      return;
    }
    setMensaje({ tipo: 'ok', texto: '2FA activado correctamente.' });
    setInscribiendo(false);
    setQr(null);
    setCodigo('');
    await cargarFactores();
    router.refresh();
  }

  async function darDeBaja(factorId: string) {
    setCargando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setCargando(false);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'No hemos podido desactivar ese factor.' });
      return;
    }
    setMensaje({ tipo: 'ok', texto: '2FA desactivado.' });
    await cargarFactores();
    router.refresh();
  }

  const tieneFactorVerificado = factores?.some((f) => f.status === 'verified');

  return (
    <div className="space-y-4">
      {mensaje && (
        <p
          className={cn(
            'rounded-boton px-3.5 py-2.5 text-[13px] font-medium',
            mensaje.tipo === 'ok' ? 'bg-teal/10 text-titular' : 'bg-magenta/10 text-magenta',
          )}
        >
          {mensaje.texto}
        </p>
      )}

      {factores === null ? (
        <p className="text-[13.5px] text-gris">Cargando…</p>
      ) : factores.length > 0 ? (
        <ul className="space-y-2">
          {factores.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-boton border border-linea bg-fondo px-4 py-3"
            >
              <div>
                <p className="text-[14px] font-semibold text-titular">{f.friendly_name || 'Autenticador TOTP'}</p>
                <p className="text-[12px] text-gris">
                  {f.status === 'verified' ? 'Activo y verificado' : 'Pendiente de verificar'}
                </p>
              </div>
              <button
                type="button"
                disabled={cargando}
                onClick={() => darDeBaja(f.id)}
                className="text-[13px] font-semibold text-magenta underline disabled:opacity-50"
              >
                Desactivar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-cuerpo">
          No tienes 2FA activo. Si tienes un cargo orgánico o rol de administración, te será exigido
          para entrar al panel.
        </p>
      )}

      {!inscribiendo && !tieneFactorVerificado && (
        <button
          type="button"
          onClick={iniciarInscripcion}
          disabled={cargando}
          className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-50"
        >
          Activar 2FA
        </button>
      )}

      {inscribiendo && qr && (
        <form onSubmit={confirmarInscripcion} className="space-y-3 rounded-boton border border-linea bg-fondo p-4">
          <p className="text-[13px] text-cuerpo">
            Escanea este código con Google Authenticator, Authy o similar:
          </p>
          {/* qr_code de Supabase es un DATA URI (data:image/svg+xml;utf-8,<svg…>),
              NO un <svg> suelto: hay que usarlo como src de <img>, no inyectarlo
              como HTML (si no, el prefijo "data:image/..." sale como texto y el
              SVG desborda solapandose con la clave manual). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Código QR para configurar la verificación en dos pasos"
            width={180}
            height={180}
            className="mx-auto block h-[180px] w-[180px] rounded bg-white p-2"
          />
          {secreto && (
            <p className="break-all text-center text-[11.5px] text-gris">
              Clave manual: <code>{secreto}</code>
            </p>
          )}
          <Input
            inputMode="numeric"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="Código de 6 dígitos"
            className="text-center text-[18px] tracking-[0.3em]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={codigo.length !== 6 || cargando}
              className="flex-1 rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setInscribiendo(false);
                setQr(null);
              }}
              className="rounded-boton border border-linea px-5 py-2.5 text-[13.5px] font-semibold text-cuerpo"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

-- 0071 · Auditoría — permiso de El Rastro del Dinero.
--
-- Sergio (01-11-2026): el autor de @elrastrodeldinero nos ha dado permiso.
-- Sus casos están documentados en elrastrodeldinero.com (código BDNS, NIF,
-- importe, enlace oficial) y el bot los usa para rellenar el caso cuando el
-- reel cita la web. La cuenta sigue INACTIVA para el sondeo automático
-- (fase F4): el permiso cubre usar sus datos, no activar la detección todavía.

begin;

update public.watchdog_accounts
set agreement = 'granted',
    agreement_notes = 'Permiso del autor comunicado a Sergio el 01-11-2026. Pendiente de dejarlo por escrito y '
      || 'documentarlo como donación en especie (D-A03, LO 8/2007).'
where platform = 'instagram' and handle = 'elrastrodeldinero';

commit;

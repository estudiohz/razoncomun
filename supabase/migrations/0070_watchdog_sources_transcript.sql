-- 0070 · Auditoría — transcripción del reel en la bandeja.
--
-- Sergio (01-11-2026): los datos del caso se rellenan a partir del reel y el
-- auditor solo supervisa. El bot de n8n transcribe el audio (Gemini) y extrae
-- los datos; la transcripción se guarda aquí para que el auditor pueda
-- comprobar de dónde sale cada dato. La extracción va en
-- `watchdog_alerts.ai_extraction` (0069).

begin;

alter table public.watchdog_sources
  add column transcript text,
  add column ai_model   text;

commit;

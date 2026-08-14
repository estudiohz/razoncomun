'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './LiquidTabBar.module.css';

/**
 * Barra de navegación inferior "líquida" para móvil.
 *
 * El borde superior de la barra se comporta como la superficie de un líquido:
 * la sección activa es una bola que lo hunde. Todo el contorno es UN path SVG
 * cuyo socket se calcula (hombro convexo → cuenco cóncavo que abraza la bola →
 * hombro de vuelta, resueltos por tangencia, no a ojo con Béziers), de modo que
 * puede inclinarse hacia la dirección del viaje y estirarse con la velocidad.
 * Eso es lo que una pila de pseudo-elementos con border-radius no sabe hacer.
 *
 * Cuatro piezas, una sola pasada por frame:
 *   1. medir()   deriva la geometría de la barra ya renderizada y la escribe de
 *                vuelta como custom properties, para que CSS y el path siempre
 *                estén de acuerdo sobre dónde está la bola.
 *   2. socket()  construye el contorno; los dos hombros son independientes y ahí
 *                es donde vive el efecto líquido.
 *   3. bucle()   un requestAnimationFrame y un muelle, que se detiene al asentar.
 *   4. rutas     el activo sale de usePathname(); navega con next/link.
 *
 * La bola también se arrastra: la superficie sigue al dedo y al soltar salta a
 * la sección más cercana.
 *
 * Es deliberadamente "tonta": recibe los items ya calculados (icono incluido),
 * no consulta roles ni sabe qué es un afiliado. Quien decide qué entra en la
 * lista es el layout, igual que en PanelNav.
 *
 * Pensada para 3–5 items: con más, los huecos se estrechan y el socket no cabe.
 */
export type ItemBarraLiquida = {
  href: string;
  label: string;
  /** SVG monocolor; hereda el color con stroke/fill="currentColor". */
  icono: ReactNode;
  /** Marca "activo" solo con coincidencia exacta (para raíces como /panel). */
  exacto?: boolean;
  /** Contador que se pinta sobre el icono. */
  badge?: number;
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const suavizar = (t: number) => t * t * (3 - 2 * t);

/**
 * Semiancho del socket construido con un hombro de radio s tangente al borde
 * superior y un cuenco de radio rb centrado en (·, by). Sale de la condición de
 * tangencia externa |C1C2| = s + rb.
 */
const alcance = (s: number, rb: number, by: number) =>
  Math.sqrt(Math.max((s + rb) ** 2 - (s - by) ** 2, 1));

/** Reposo vertical del icono, en tanto por uno de la altura. Debe coincidir con
 *  el `top` de .icono en LiquidTabBar.module.css. */
const ICONO_TOP = 0.35;

export function LiquidTabBar({
  items,
  indicePorDefecto = 0,
}: {
  items: ItemBarraLiquida[];
  /** Hueco donde descansa la bola cuando la ruta no cae en ningún item. */
  indicePorDefecto?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dockRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const bolaRef = useRef<HTMLDivElement>(null);
  const huecoRef = useRef(indicePorDefecto);
  const saltarRef = useRef<(hueco: number, animar: boolean) => void>(() => {});
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const esActivo = (item: ItemBarraLiquida) =>
    item.exacto
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Si la ruta no cae en ningún item, la bola se queda donde estaba.
  const indiceActivo = items.findIndex(esActivo);
  const huecoActivo = indiceActivo === -1 ? huecoRef.current : indiceActivo;

  useEffect(() => {
    const dock = dockRef.current, svg = svgRef.current, path = pathRef.current, bola = bolaRef.current;
    if (!dock || !svg || !path || !bola) return;
    const botones = Array.from(dock.querySelectorAll<HTMLElement>('[data-hueco]'));
    if (!botones.length) return;
    const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── 1. geometría ────────────────────────────────────────────────────────
    // La bola se dimensiona con lo que sea más estrecho: la altura de la barra,
    // el ancho de un hueco, o el sitio que queda hasta la esquina redondeada.
    const G = { W: 0, H: 0, R: 17, D: 44, RB: 28, S: 10, CY: 0, huecos: [] as number[], paso: 80 };

    function medir(): boolean {
      const r = dock!.getBoundingClientRect();
      const W = Math.round(r.width), H = Math.round(r.height);
      if (W < 40 || H < 30) return false;
      G.huecos = botones.map((el) => {
        const b = el.getBoundingClientRect();
        return b.left - r.left + b.width / 2;
      });
      G.paso = G.huecos.length > 1 ? G.huecos[1] - G.huecos[0] : W;
      G.W = W; G.H = H;
      G.R = clamp(H * 0.2, 13, 20);
      G.CY = 0;                          // la bola cabalga SOBRE la línea de superficie
      let D = Math.min(H * 0.68, G.paso * 0.78);
      const sitio = G.huecos[0] - G.R - 6;
      for (let i = 0; i < 3; i++) {
        const semi = alcance(D * 0.22, D / 2 + 6, G.CY);
        if (semi <= sitio) break;
        D *= sitio / semi;
      }
      G.D = Math.max(Math.round(D), 30) + 5;   // +5px de bola por decisión de diseño
      G.S = G.D * 0.22;
      G.RB = G.D / 2 + 6;
      svg!.setAttribute('viewBox', `0 0 ${W} ${H}`);
      dock!.style.setProperty('--ltb-bola', `${G.D}px`);
      // Recorrido del icono hasta el centro exacto de la bola, medido desde su
      // reposo: si se midiera desde el centro de la barra se pasaría de largo.
      dock!.style.setProperty('--ltb-subida', `${(H * ICONO_TOP - G.CY).toFixed(1)}px`);
      return true;
    }

    // ── 2. el contorno ──────────────────────────────────────────────────────
    function socket(bx: number, by: number, rb: number, sIzq: number, sDer: number): string {
      const { W, H, R } = G;
      // El centro del hombro está a (·, s) — radio s bajo el borde — para que el
      // arco salga tangente al tramo plano. Su x sale de la tangencia externa.
      const ala = (s: number, lado: number) => {
        const L = s + rb;
        const semi = alcance(s, rb, by);
        const sx = bx + lado * semi;
        return { sx, tx: sx + ((bx - sx) / L) * s, ty: s + ((by - s) / L) * s };
      };
      const A = ala(sIzq, -1), B = ala(sDer, +1);
      // El cuenco va del punto de tangencia de A al de B por el camino corto.
      const a0 = Math.atan2(A.ty - by, A.tx - bx);
      const a1 = Math.atan2(B.ty - by, B.tx - bx);
      let barrido = ((a0 - a1) * 180) / Math.PI;
      while (barrido < 0) barrido += 360;
      const grande = barrido > 180 ? 1 : 0;
      const n = (v: number) => v.toFixed(2);
      return (
        `M0 ${n(R)}` +
        `A${n(R)} ${n(R)} 0 0 1 ${n(R)} 0` +
        `L${n(clamp(A.sx, R, W - R))} 0` +
        `A${n(sIzq)} ${n(sIzq)} 0 0 1 ${n(A.tx)} ${n(A.ty)}` +
        `A${n(rb)} ${n(rb)} 0 ${grande} 0 ${n(B.tx)} ${n(B.ty)}` +
        `A${n(sDer)} ${n(sDer)} 0 0 1 ${n(clamp(B.sx, R, W - R))} 0` +
        `L${n(W - R)} 0` +
        `A${n(R)} ${n(R)} 0 0 1 ${n(W)} ${n(R)}` +
        `L${n(W)} ${n(H - R)}` +
        `A${n(R)} ${n(R)} 0 0 1 ${n(W - R)} ${n(H)}` +
        `L${n(R)} ${n(H)}` +
        `A${n(R)} ${n(R)} 0 0 1 0 ${n(H - R)}` +
        `Z`
      );
    }

    // ── 3. la superficie, movida por un muelle ──────────────────────────────
    let x = 0, v = 0, destino = 0, arrastrando = false, raf = 0, ultimo = 0;

    function pintar() {
      // q es el desplazamiento con signo, −1…1: todo lo líquido depende de él.
      const q = clamp(v / 1100, -1, 1) * (arrastrando ? 0.5 : 1);
      const mag = Math.abs(q);
      // El hombro de cola se estira y el de cabeza se aprieta, así que la
      // superficie se queda atrás respecto del peso que la hundió.
      const sIzq = clamp(G.S * (1 + 0.06 * mag + 0.4 * q), G.S * 0.55, G.S * 2.1);
      const sDer = clamp(G.S * (1 + 0.06 * mag - 0.4 * q), G.S * 0.55, G.S * 2.1);
      path!.setAttribute('d', socket(x, G.CY, G.RB, sIzq, sDer));
      // Aplastamiento que conserva el volumen en la dirección del viaje.
      const sx = 1 + 0.07 * mag;
      bola!.style.transform =
        `translate3d(${x.toFixed(2)}px,0,0) scale(${sx.toFixed(3)},${(1 / sx).toFixed(3)})`;
      // Cada icono sube según lo cerca que tenga la bola, así que arrastrar se
      // siente líquido en vez de escalonado.
      for (let i = 0; i < botones.length; i++) {
        const dx = Math.abs(x - G.huecos[i]);
        botones[i].style.setProperty('--t', suavizar(clamp(1 - dx / (G.paso * 0.55), 0, 1)).toFixed(3));
      }
    }

    function bucle(ahora: number) {
      raf = 0;
      const dt = Math.min((ahora - ultimo) / 1000, 1 / 30);
      ultimo = ahora;
      // Arrastrando va rígido para seguir al dedo; al soltar, ζ ≈ .81: rebota
      // lo justo para leerse como líquido y asienta rápido.
      const K = arrastrando ? 900 : 142;
      const C = arrastrando ? 52 : 19.3;
      let paso = dt;
      while (paso > 0) {                       // subpasos: estabilidad numérica
        const h = Math.min(paso, 1 / 240);
        v += (-K * (x - destino) - C * v) * h;
        x += v * h;
        paso -= h;
      }
      pintar();
      if (Math.abs(x - destino) > 0.05 || Math.abs(v) > 0.6 || arrastrando) correr();
      else { x = destino; v = 0; pintar(); }
    }

    function correr() {
      if (raf) return;
      ultimo = performance.now();
      raf = requestAnimationFrame(bucle);
    }

    function saltar(hueco: number, animar: boolean) {
      huecoRef.current = hueco;
      destino = G.huecos[hueco] ?? 0;
      if (!animar || reducido()) { x = destino; v = 0; pintar(); return; }
      correr();
    }
    saltarRef.current = saltar;

    function colocar() {
      if (!medir()) return;
      x = destino = G.huecos[huecoRef.current] ?? 0;
      v = 0;
      pintar();
      dock!.classList.add(styles.listo);
    }

    colocar();
    const ro = new ResizeObserver(() => colocar());
    ro.observe(dock);
    document.fonts?.ready.then(() => colocar());

    // ── 4. arrastre ─────────────────────────────────────────────────────────
    let inicioX = 0, pid: number | null = null, tragarClick = false;

    const alPulsar = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pid = e.pointerId;
      inicioX = e.clientX;
      tragarClick = false;
    };
    const alMover = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      if (!arrastrando && Math.abs(e.clientX - inicioX) < 7) return;
      if (!arrastrando) {
        arrastrando = true;
        tragarClick = true;
        dock!.classList.add(styles.arrastrando);
        dock!.setPointerCapture(pid);
      }
      e.preventDefault();
      const izq = dock!.getBoundingClientRect().left;
      destino = clamp(e.clientX - izq, G.huecos[0], G.huecos[G.huecos.length - 1]);
      correr();
    };
    const alSoltar = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (!arrastrando) return;
      arrastrando = false;
      dock!.classList.remove(styles.arrastrando);
      let cerca = 0, mejor = Infinity;
      G.huecos.forEach((h, i) => { const d = Math.abs(destino - h); if (d < mejor) { mejor = d; cerca = i; } });
      saltar(cerca, true);
      router.push(itemsRef.current[cerca].href);
      // Deja pasar el click que sigue al arrastre solo si fue un toque de verdad.
      setTimeout(() => { tragarClick = false; }, 0);
    };
    // Un arrastre no debe además abrir el enlace que quedó debajo del dedo.
    const alClicar = (e: MouseEvent) => {
      if (tragarClick) { e.stopPropagation(); e.preventDefault(); }
    };

    dock.addEventListener('pointerdown', alPulsar);
    dock.addEventListener('pointermove', alMover);
    dock.addEventListener('pointerup', alSoltar);
    dock.addEventListener('pointercancel', alSoltar);
    dock.addEventListener('click', alClicar, true);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      dock.removeEventListener('pointerdown', alPulsar);
      dock.removeEventListener('pointermove', alMover);
      dock.removeEventListener('pointerup', alSoltar);
      dock.removeEventListener('pointercancel', alSoltar);
      dock.removeEventListener('click', alClicar, true);
    };
    // Solo al montar: el resto se sincroniza por refs, para no rearmar el bucle
    // ni los listeners en cada navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambia la ruta (desde la barra o desde cualquier otro sitio), viaja.
  useEffect(() => {
    if (huecoRef.current !== huecoActivo) saltarRef.current(huecoActivo, true);
  }, [huecoActivo]);

  return (
    <div className={styles.barra}>
      <div className={styles.marco}>
        <nav ref={dockRef} className={styles.dock} aria-label="Navegación principal">
          <svg ref={svgRef} className={styles.piel} aria-hidden="true" focusable="false">
            <path ref={pathRef} className={styles.relleno} />
          </svg>
          <div ref={bolaRef} className={styles.bola} aria-hidden="true" />
          <div className={styles.items}>
            {items.map((item, i) => {
              const activo = i === indiceActivo;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-hueco={i}
                  aria-current={activo ? 'page' : undefined}
                  className={`${styles.item}${activo ? ` ${styles.activo}` : ''}`}
                >
                  <span className={styles.icono}>
                    {item.icono}
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className={styles.badge}>{item.badge > 9 ? '9+' : item.badge}</span>
                    )}
                  </span>
                  <span className={styles.label}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

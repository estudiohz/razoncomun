# Barra de navegación líquida (móvil)

Barra inferior en la que la sección activa es una bola que **hunde el borde
superior** de la barra, como un menisco. Todo el contorno es un único path SVG
recalculado en cada frame por un muelle, así que el hundimiento se inclina hacia
la dirección del viaje y se estira con la velocidad.

Portada desde Nextfactu (donde está en producción) al stack de Razón Común:
Next.js App Router, `next/link` + `usePathname`, CSS Modules y los tokens de
marca. Sin dependencias nuevas: SVG, Pointer Events, ResizeObserver y rAF.

## Archivos

| Archivo | Qué es |
|---|---|
| `LiquidTabBar.tsx` | El componente. Cliente (`'use client'`): mide el DOM y anima. |
| `LiquidTabBar.module.css` | Estilos y tokens locales. Nada global. |

## Cómo montarla

Se le pasan los items ya calculados, igual que a `PanelNav`. El activo sale de
la ruta, no de estado, así que funciona con navegación normal de Next.

```tsx
import { LiquidTabBar } from '@/components/nav/LiquidTabBar';

const items = [
  { href: '/panel', label: 'Inicio', exacto: true, icono: <IconoInicio /> },
  { href: '/panel/propuestas', label: 'Propuestas', icono: <IconoPropuestas />, badge: 3 },
  { href: '/panel/afiliacion', label: 'Afiliación', icono: <IconoAfiliacion /> },
  { href: '/panel/perfil', label: 'Perfil', icono: <IconoPerfil /> },
];

<LiquidTabBar items={items} />;
```

En un layout de servidor (como `app/panel/layout.tsx`) se monta directamente: el
componente ya declara `'use client'` por su cuenta. Va **fuera** del contenedor
con scroll, al final del layout, porque se posiciona `fixed`.

Conviene añadir al contenedor de contenido un colchón inferior en móvil para que
la barra no tape lo último de la página:

```
pb-24 md:pb-0
```

### Iconos

No trae iconos: se los pasas como `ReactNode`. Deben ser SVG monocolor con
`stroke="currentColor"` o `fill="currentColor"`, sin `width`/`height` propios o
con ellos (el CSS los fuerza a `--ltb-icono`). El color lo pone la barra: gris
apagado sobre la barra y blanco cuando el icono entra en la bola.

## Comportamiento

- **Activo por ruta.** `exacto: true` para las raíces (`/panel`), como en
  `lib/panel/nav.ts`. Si la ruta no casa con ningún item, la bola se queda donde
  está en vez de saltar al primero.
- **Arrastrable.** Se puede arrastrar la bola; al soltar salta a la sección más
  cercana y navega. El click que sigue al arrastre se traga para no abrir dos
  veces.
- **Accesibilidad.** Son enlaces reales (`next/link`), así que funcionan el
  teclado, el foco visible y abrir en pestaña nueva. El activo lleva
  `aria-current="page"`. Con `prefers-reduced-motion` la bola se coloca sin
  animar.

## Ajustes

Todo lo tuneable son custom properties en `.dock` dentro del módulo CSS:

| Propiedad | Por defecto | Qué controla |
|---|---|---|
| `--ltb-icono` | `18px` | Tamaño de los iconos |
| `--ltb-acento` | `#157F70` (`accion`) | Color de la bola |
| `--ltb-panel` | `#FFFFFF` (`panel`) | Fondo de la barra |
| `--ltb-linea` | `#E2E9F5` (`linea`) | Borde de 1px |
| `--ltb-apagado` | `#5A6780` (`cuerpo`) | Icono y etiqueta inactivos |
| `--ltb-encendido` | `#1B3D9C` (`tinta`) | Etiqueta activa |

Los colores están escritos como literales porque un módulo CSS no ve la paleta
de Tailwind. **Si cambian los tokens en `tailwind.config.ts`, hay que
actualizarlos aquí.**

Otros dos valores viven fuera de las custom properties:

- **Altura** (`height: 64px` en `.dock`) y **breakpoint** (`max-width: 820px`).
- **Reposo vertical del icono**: el `top: 40%` de `.icono` está duplicado como
  `ICONO_TOP` en el `.tsx` porque JS necesita el mismo número para calcular
  cuánto sube el icono. **Si cambias uno, cambia el otro**, o el icono dejará de
  quedar centrado dentro de la bola.

## Choque conocido: el botón del chatbot

El botón flotante del chat (`aria-label="Abrir chat de Razón Común"`) es
`fixed bottom-4 right-4 z-[70]`, así que **se sienta justo encima del último
item de la barra** y además gana en `z-index` (70 contra 60). Verificado a
390px: el botón ocupa el rectángulo x 318–374, y 628–684, y la barra llega
hasta y 697.

Hay que resolverlo antes de publicar la barra. Tres salidas, de menos a más
invasiva:

1. **Subir el chat en móvil**: cambiar `bottom-4` por `bottom-24 md:bottom-4`
   en el botón. Es una línea y conserva las dos cosas.
2. **Ocultarlo en móvil** (`hidden md:grid`) si la barra ya lleva un acceso al
   chat.
3. Bajar el `z-[70]` del chat, solo si se quiere que la barra lo tape.

## Límites

- **Pensada para 3–5 items.** Con más, los huecos se estrechan hasta que el
  socket no cabe y el efecto se pierde. La barra encoge la bola sola para librar
  la esquina redondeada, pero eso solo aguanta hasta cierto punto.
- **Solo móvil** (≤820px). En escritorio no se renderiza; ahí sigue mandando la
  navegación existente.

import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño de Razón Común — tokens extraídos fielmente del
 * boceto aprobado `bocetos-home/boceto-4-teal.html` y de
 * `docs/marca/identidad-visual.md`.
 *
 * Regla de marca inviolable: nunca web monocolor azul. `tinta` (#1B3D9C)
 * es color de texto, no de fondo dominante. El protagonismo cromático se
 * reparte por el espectro del aro (teal, morado, magenta, naranja, cian).
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Espectro del aro (colores de marca)
        tinta: '#1B3D9C', // azul profundo — SOLO tinta tipográfica
        morado: '#8B30D9',
        magenta: '#C3369E',
        naranja: '#E8792F',
        // Teal de marca. `DEFAULT` (#16B8A0) es DECORATIVO — banda del hero,
        // aros, tintes de fondo sin texto encima: no lleva texto, se conserva
        // claro para mantener el aire de marca. `texto` (#0F7F6E) es la variante
        // apta para texto: 4,52:1 sobre el fondo real #F2F6FC (WCAG AA).
        teal: { DEFAULT: '#16B8A0', texto: '#0F7F6E' },
        cian: '#2BC7E8',
        // Color de titulares (h1/h2/h3). Oscurecido de #24AF9A → #177F6F para
        // cumplir WCAG AA: 4,50:1 sobre el fondo real #F2F6FC (D-021).
        titular: '#177F6F',
        // Verde de botón sólido del boceto (.btn-grad). Oscurecido de #2BA79E →
        // #157F70: texto blanco encima 4,88:1 y como texto 4,50:1 (WCAG AA).
        accion: '#157F70',
        // Neutros. Gris de texto oscurecido de #777777 → #6F6F6F: 4,63:1 sobre
        // #F2F6FC (WCAG AA; #777777 daba 4,13:1 sobre el fondo real).
        gris: '#6F6F6F',
        cuerpo: '#5A6780',
        // Superficies (tema claro siempre)
        fondo: '#F2F6FC',
        panel: '#FFFFFF',
        linea: '#E2E9F5',
        // Registro tech ("Jarvis")
        noche: '#0A1633',
        // Colores por departamento (etiquetas de categoría)
        cat: {
          vivienda: '#E8792F',
          economia: '#16B8A0',
          sanidad: '#C3369E',
          justicia: '#8B30D9',
          agricultura: '#4CA637',
          autonomos: '#2BC7E8',
          transparencia: '#1B3D9C',
          educacion: '#E0A82E',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        celda: '20px',
        tarjeta: '18px',
        boton: '14px',
      },
      boxShadow: {
        nav: '0 8px 30px rgba(15,61,138,.08)',
        tarjeta: '0 18px 44px rgba(15,61,138,.14)',
        boton: '0 8px 22px rgba(43,167,158,.34)',
        caja: '0 24px 60px rgba(27,61,156,.08)',
      },
      backgroundImage: {
        // Degradado de marca completo (aro, palabras destacadas)
        'grad-full':
          'linear-gradient(120deg,#24AF9A 0%,#8B30D9 28%,#C3369E 50%,#E8792F 72%,#16B8A0 100%)',
        // Degradado de acción (botones, celdas — no satura)
        grad: 'linear-gradient(120deg,#24AF9A 0%,#8B30D9 60%,#C3369E 100%)',
        // Hero: azul → morado → magenta → rojo → naranja (espectro del aro)
        hero: 'linear-gradient(123deg, #0e57a5, #5158a7 30%, #a52b8ebf 50%, #ed1156b5 60%, #f05726bd 85%, #ed7547)',
      },
      maxWidth: {
        wrap: '1240px',
      },
      keyframes: {
        sube: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        sube: 'sube .8s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;

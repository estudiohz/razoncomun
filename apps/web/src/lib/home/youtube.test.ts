import { describe, it, expect } from 'vitest';
import { idYoutubeDesdeUrl } from './youtube';

describe('idYoutubeDesdeUrl', () => {
  it('reconoce las formas habituales de URL de YouTube', () => {
    expect(idYoutubeDesdeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(idYoutubeDesdeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(idYoutubeDesdeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(idYoutubeDesdeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('acepta parámetros extra en la URL (timestamp, playlist, utm...)', () => {
    expect(idYoutubeDesdeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
    expect(idYoutubeDesdeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc123')).toBe('dQw4w9WgXcQ');
  });

  it('quita espacios sueltos al pegar el enlace', () => {
    expect(idYoutubeDesdeUrl('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });

  it('devuelve null ante vacío, otra URL o texto sin sentido', () => {
    expect(idYoutubeDesdeUrl('')).toBeNull();
    expect(idYoutubeDesdeUrl('   ')).toBeNull();
    expect(idYoutubeDesdeUrl('https://vimeo.com/12345')).toBeNull();
    expect(idYoutubeDesdeUrl('https://www.instagram.com/reel/abc123/')).toBeNull();
    expect(idYoutubeDesdeUrl('esto no es una URL')).toBeNull();
  });

  it('no confunde una URL de canal o de búsqueda con un vídeo', () => {
    expect(idYoutubeDesdeUrl('https://www.youtube.com/@razoncomun')).toBeNull();
    expect(idYoutubeDesdeUrl('https://www.youtube.com/results?search_query=algo')).toBeNull();
  });
});

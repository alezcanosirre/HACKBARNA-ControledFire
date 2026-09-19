import { useEffect, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Latido 0 → 1 → 0. Ver spec.md §4.8. Es el único elemento de la pantalla que se mueve
 * sin que el operador lo provoque, y por eso funciona: lo que late es el dato.
 *
 * Si el sistema pide menos movimiento, devuelve un valor fijo y no arranca el rAF.
 */
export function usePulse(active: boolean, periodMs = 1400): number {
  const [t, setT] = useState(0.5);

  useEffect(() => {
    if (!active) return;
    if (typeof matchMedia === 'function' && matchMedia(REDUCED).matches) return;

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((Math.sin(((now - start) / periodMs) * Math.PI * 2) + 1) / 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, periodMs]);

  return t;
}

/**
 * Utilidades deterministas de números pseudoaleatorios para el grano
 * riguroso. Deterministas a propósito: la misma imagen + misma semilla
 * siempre debe dar el mismo grano (principio innegociable del proyecto).
 */

/** Hash entero de 32 bits (variante de "wang hash") → entero sin signo. */
export function hash32(x: number): number {
  x = (x ^ 61) ^ (x >>> 16);
  x = x + (x << 3);
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return x >>> 0;
}

/** Combina varias coordenadas enteras en una única semilla determinista. */
export function hashCoords(cx: number, cy: number, channel: number, seed: number): number {
  let h = hash32(cx | 0);
  h = hash32(h ^ hash32(cy | 0));
  h = hash32(h ^ hash32((channel | 0) * 0x9e3779b1));
  h = hash32(h ^ hash32(seed | 0));
  return h;
}

/** Generador mulberry32: rápido, determinista, suficiente para muestreo de grano. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número de sucesos de una Poisson(lambda) — algoritmo de Knuth, válido para lambda moderado. */
export function poissonSample(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

import { hashCoords, mulberry32, poissonSample } from "./prng";

/**
 * Modelo de grano booleano (Newson, Delon, Galerne — "A Stochastic Film
 * Grain Model for Resolution-Independent Rendering"): el grano no es
 * ruido pintado encima, es la propia forma en que la densidad se
 * representa a nivel de píxel — como una nube de discos opacos (granos)
 * distribuidos según un proceso de Poisson, cuya densidad espacial λ se
 * elige para que la probabilidad de que un punto quede cubierto por
 * algún grano coincida, en promedio, con la densidad "ideal" (la que
 * calculó la curva característica). El grano visible es la varianza
 * estadística natural de ese proceso — máxima cuando la probabilidad de
 * cobertura está cerca del 50% (medios tonos) y mínima cerca de 0% o
 * 100% (negros puros y luces quemadas). Esa propiedad no hay que
 * simularla aparte (como hace la aproximación en tiempo real con una
 * curva de visibilidad): sale sola de las matemáticas del proceso.
 *
 * Esta es una implementación PRÁCTICA inspirada en el paper, no una
 * reproducción exacta de todas sus optimizaciones (muestreo por
 * importancia, discretización eficiente...). Simplificación deliberada,
 * documentada: un número modesto de muestras Monte Carlo por píxel,
 * pensado para completarse en segundos/minutos en un Web Worker, no
 * para fotorrealismo de referencia.
 *
 * IMPORTANTE #1: cada célula de la rejilla espacial tiene su propio λ,
 * calculado UNA VEZ a partir de la densidad en el centro de esa célula
 * (no de la densidad del píxel que la consulta). Si no se hiciera así,
 * dos píxeles vecinos con densidades ligeramente distintas verían un
 * número de granos distinto en la MISMA célula compartida, rompiendo la
 * coherencia espacial del campo de grano y produciendo ruido de alta
 * frecuencia sin ninguna textura reconocible como grano real.
 *
 * IMPORTANTE #2: el radio de grano es, a propósito, mayor que un solo
 * píxel de salida (así se ve el grano). Eso significa que un único
 * grano puede cubrir un píxel entero. Si las N muestras Monte Carlo de
 * un píxel solo movieran el PUNTO de consulta dentro de ese píxel pero
 * consultaran siempre la MISMA colocación de granos (determinista), casi
 * todas caerían dentro o fuera del mismo grano cercano a la vez — la
 * media saldría casi binaria (0 o 1) en vez de una fracción de cobertura
 * suave. Por eso cada muestra usa su PROPIA realización independiente
 * del campo de granos (semilla distinta por muestra) y consulta siempre
 * el centro del píxel: el promedio de N realizaciones independientes sí
 * converge a la probabilidad de cobertura real, tenga el grano el tamaño
 * que tenga.
 */

export interface BooleanGrainParams {
  /** Radio de grano en píxeles, por canal. */
  radius: { r: number; g: number; b: number };
  /** Densidad mínima/máxima del canal (curva característica), para normalizar a probabilidad de cobertura. */
  dMin: { r: number; g: number; b: number };
  dMax: { r: number; g: number; b: number };
  /** Semilla determinista. */
  seed: number;
  /** Muestras Monte Carlo por píxel (más = menos ruido de muestreo, más lento). */
  samplesPerPixel: number;
}

const CHANNEL_INDEX = { r: 0, g: 1, b: 2 } as const;
type ChannelKey = keyof typeof CHANNEL_INDEX;

interface CellLambdaLookup {
  cellSize: number;
  channel: number;
  seed: number;
  /** Densidad (ya en [0,1] de probabilidad de cobertura) en un punto del plano, para fijar λ de cada célula. */
  uAt: (x: number, y: number) => number;
  radius: number;
}

function coverageAt(px: number, py: number, lookup: CellLambdaLookup): number {
  const { cellSize, channel, seed, radius } = lookup;
  const r2 = radius * radius;

  const cx0 = Math.floor((px - radius) / cellSize);
  const cx1 = Math.floor((px + radius) / cellSize);
  const cy0 = Math.floor((py - radius) / cellSize);
  const cy1 = Math.floor((py + radius) / cellSize);

  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      // λ de ESTA célula, fijo para cualquier consulta — no depende de
      // qué píxel esté preguntando (ver nota de coherencia espacial arriba).
      const cellCenterX = (cx + 0.5) * cellSize;
      const cellCenterY = (cy + 0.5) * cellSize;
      const u = lookup.uAt(cellCenterX, cellCenterY);
      const lambda = -Math.log(1 - u) / (Math.PI * r2);
      const expectedPerCell = lambda * cellSize * cellSize;

      const cellSeed = hashCoords(cx, cy, channel, seed);
      const rand = mulberry32(cellSeed);
      const n = poissonSample(expectedPerCell, rand);
      for (let i = 0; i < n; i++) {
        const gx = (cx + rand()) * cellSize;
        const gy = (cy + rand()) * cellSize;
        const dx = gx - px;
        const dy = gy - py;
        if (dx * dx + dy * dy <= r2) {
          return 1; // basta con un grano cubriendo el punto
        }
      }
    }
  }
  return 0;
}

/**
 * Renderiza el canal `channel` de una imagen de densidad (rgba, denso en
 * `[w*h*4]`) sustituyendo la densidad suave por la salida estocástica
 * del modelo booleano. `onProgress` se llama tras cada bloque de filas.
 */
export function renderBooleanGrainChannel(
  density: Float32Array,
  width: number,
  height: number,
  channel: ChannelKey,
  params: BooleanGrainParams,
  out: Float32Array,
  onProgress?: (fraction: number) => void
): void {
  const ci = CHANNEL_INDEX[channel];
  const radius = params.radius[channel];
  const dMin = params.dMin[channel];
  const dMax = params.dMax[channel];
  const span = dMax - dMin;
  const seed = params.seed + ci * 7919;
  const n = Math.max(1, params.samplesPerPixel);
  const cellSize = Math.max(radius, 0.75);

  const uAt = (x: number, y: number): number => {
    const xi = Math.min(width - 1, Math.max(0, Math.round(x)));
    const yi = Math.min(height - 1, Math.max(0, Math.round(y)));
    const d = density[(yi * width + xi) * 4 + ci];
    return Math.min(0.98, Math.max(0.001, (d - dMin) / span));
  };

  const progressEvery = Math.max(1, Math.floor(height / 20));

  // Un número primo grande para separar bien las semillas de cada
  // realización — no es más que un "salto" determinista distinto por
  // muestra, para que cada una viva en su propia región del espacio de
  // semillas de hashCoords.
  const SAMPLE_SEED_STRIDE = 104729;

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + ci;
      const px = x + 0.5;

      let covered = 0;
      for (let s = 0; s < n; s++) {
        const sampleSeed = seed + s * SAMPLE_SEED_STRIDE;
        const lookup: CellLambdaLookup = { cellSize, channel: ci, seed: sampleSeed, uAt, radius };
        covered += coverageAt(px, py, lookup);
      }
      const coverage = covered / n;

      out[idx] = dMin + coverage * span;
    }

    if (onProgress && y % progressEvery === 0) {
      onProgress(y / height);
    }
  }

  onProgress?.(1);
}

/**
 * Interpolación cúbica monótona (método Fritsch-Carlson).
 * Pasa exactamente por los puntos dados sin generar overshoot ni
 * oscilaciones — imprescindible para curvas de densidad, que en la
 * realidad física nunca bajan al aumentar la exposición.
 */
export interface MonotoneCubicSpline {
  evaluate(x: number): number;
  readonly xs: number[];
  readonly ys: number[];
  readonly startTangent: number;
  readonly endTangent: number;
}

export function fitMonotoneCubic(
  xs: number[],
  ys: number[],
  lowAsymptoteHeadroom = 0.15
): MonotoneCubicSpline {
  const n = xs.length;
  if (n < 2) throw new Error("Se necesitan al menos 2 puntos para interpolar.");

  const deltas: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    deltas.push(dx);
    slopes.push((ys[i + 1] - ys[i]) / dx);
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  // Restricción de Fritsch-Carlson: evita overshoot entre puntos consecutivos.
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  function evaluate(x: number): number {
    // Por debajo del rango medido (sombras extremas): extrapolación
    // ASINTÓTICA, no lineal. Una extrapolación lineal del toe se dispara
    // sin límite (hasta cruzar densidad 0, físicamente imposible) y, peor
    // aún, amplifica sin control el ruido de cuantización de 8 bits de
    // una imagen de entrada normal: cerca del negro, log10(escena) cambia
    // muchísimo entre niveles de 8 bits consecutivos. La curva real del
    // toe sigue aplanándose más allá de donde Kodak la midió — así que
    // aproximar ese aplanamiento con una asíntota suave es más fiel a la
    // física real que continuar la tangente en línea recta.
    // `lowAsymptoteHeadroom` es el margen de densidad por debajo del
    // punto medido más oscuro al que la curva se aproxima sin llegar
    // nunca — una estimación razonable, no un dato de datasheet.
    if (x <= xs[0]) {
      const slope0 = tangents[0];
      if (slope0 <= 0) return ys[0];
      const k = slope0 / lowAsymptoteHeadroom;
      return ys[0] - lowAsymptoteHeadroom + lowAsymptoteHeadroom * Math.exp(k * (x - xs[0]));
    }
    // Por encima del rango medido (luces muy altas): SÍ se mantiene la
    // extrapolación lineal — el gráfico de Kodak no muestra ningún
    // aplanamiento en luces (ver characteristicCurveData.ts) y, a
    // diferencia de las sombras, aquí no hay ningún problema de
    // amplificación logarítmica (log10 es suave cerca de 1, no cerca de 0).
    if (x >= xs[n - 1]) return ys[n - 1] + tangents[n - 1] * (x - xs[n - 1]);

    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;

    const h = deltas[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * ys[i] + h10 * h * tangents[i] + h01 * ys[i + 1] + h11 * h * tangents[i + 1];
  }

  return { evaluate, xs, ys, startTangent: tangents[0], endTangent: tangents[n - 1] };
}

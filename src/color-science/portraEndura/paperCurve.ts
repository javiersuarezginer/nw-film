import { fitMonotoneCubic, type MonotoneCubicSpline } from "../monotoneCubic";
import { portraEnduraPaperCurve, PORTRA_ENDURA_SOURCE } from "./paperCurveData";

const spline: MonotoneCubicSpline = fitMonotoneCubic(
  portraEnduraPaperCurve.map((p) => p.x),
  portraEnduraPaperCurve.map((p) => p.density),
  0.1 // headroom del toe — el papel real tampoco baja de su Dmin (base+fog)
);

export const PAPER_X_MIN = portraEnduraPaperCurve[0].x;
export const PAPER_X_MAX = portraEnduraPaperCurve[portraEnduraPaperCurve.length - 1].x;
export const PAPER_DENSITY_MIN = portraEnduraPaperCurve[0].density;
export const PAPER_DENSITY_MAX = portraEnduraPaperCurve[portraEnduraPaperCurve.length - 1].density;

/** Densidad del papel para un valor de entrada dado (ver paperCurveData.ts sobre qué es `x`). */
export function samplePaperDensity(x: number): number {
  return spline.evaluate(x);
}

export { PORTRA_ENDURA_SOURCE };

export interface PaperLUT {
  data: Float32Array;
  width: number;
  domainMin: number;
  domainMax: number;
}

export function buildPaperLUT(width = 512, extrapolationPad = 1.5): PaperLUT {
  const domainMin = PAPER_X_MIN - extrapolationPad;
  const domainMax = PAPER_X_MAX + extrapolationPad;

  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const x = domainMin + t * (domainMax - domainMin);
    const d = samplePaperDensity(x);
    data[i * 4 + 0] = d;
    data[i * 4 + 1] = d;
    data[i * 4 + 2] = d;
    data[i * 4 + 3] = 1.0;
  }

  return { data, width, domainMin, domainMax };
}

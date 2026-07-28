import { fitMonotoneCubic, type MonotoneCubicSpline } from "../monotoneCubic";
import { portra400CharacteristicCurve, PORTRA_400_SOURCE } from "./characteristicCurveData";

export type Channel = "r" | "g" | "b";

const splines: Record<Channel, MonotoneCubicSpline> = {
  r: fitMonotoneCubic(
    portra400CharacteristicCurve.map((p) => p.logE),
    portra400CharacteristicCurve.map((p) => p.r)
  ),
  g: fitMonotoneCubic(
    portra400CharacteristicCurve.map((p) => p.logE),
    portra400CharacteristicCurve.map((p) => p.g)
  ),
  b: fitMonotoneCubic(
    portra400CharacteristicCurve.map((p) => p.logE),
    portra400CharacteristicCurve.map((p) => p.b)
  ),
};

export const MEASURED_LOG_E_MIN = portra400CharacteristicCurve[0].logE;
export const MEASURED_LOG_E_MAX =
  portra400CharacteristicCurve[portra400CharacteristicCurve.length - 1].logE;

/** Densidad del canal dado a un log-exposure concreto (extrapola linealmente fuera del rango medido). */
export function sampleDensity(channel: Channel, logE: number): number {
  return splines[channel].evaluate(logE);
}

export { PORTRA_400_SOURCE };

export interface CurveLUT {
  /** RGBA32F, 4 floats por texel: r, g, b, (sin usar). Tamaño width x 1. */
  data: Float32Array;
  width: number;
  domainMin: number;
  domainMax: number;
  /** Densidad en los extremos del dominio, por canal — para la inversión de preview. */
  dMin: { r: number; g: number; b: number };
  dMax: { r: number; g: number; b: number };
}

/**
 * Genera la tabla que se sube a la GPU como textura 1D (width x 1, rgba32float).
 * El dominio se extiende más allá del rango medido por Kodak usando la
 * tangente de cada extremo, para dar margen al control de exposición sin
 * topar con un borde recortado.
 */
export function buildCurveLUT(width = 512, extrapolationPad = 3.0): CurveLUT {
  const domainMin = MEASURED_LOG_E_MIN - extrapolationPad;
  const domainMax = MEASURED_LOG_E_MAX + extrapolationPad;

  const data = new Float32Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const logE = domainMin + t * (domainMax - domainMin);
    data[i * 4 + 0] = sampleDensity("r", logE);
    data[i * 4 + 1] = sampleDensity("g", logE);
    data[i * 4 + 2] = sampleDensity("b", logE);
    data[i * 4 + 3] = 1.0;
  }

  return {
    data,
    width,
    domainMin,
    domainMax,
    dMin: {
      r: sampleDensity("r", MEASURED_LOG_E_MIN),
      g: sampleDensity("g", MEASURED_LOG_E_MIN),
      b: sampleDensity("b", MEASURED_LOG_E_MIN),
    },
    dMax: {
      r: sampleDensity("r", MEASURED_LOG_E_MAX),
      g: sampleDensity("g", MEASURED_LOG_E_MAX),
      b: sampleDensity("b", MEASURED_LOG_E_MAX),
    },
  };
}

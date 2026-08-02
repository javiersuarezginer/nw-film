import { fitMonotoneCubic, type MonotoneCubicSpline } from "./monotoneCubic";

export type Channel = "r" | "g" | "b";

export interface CharacteristicCurvePoint {
  logE: number;
  r: number;
  g: number;
  b: number;
}

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

export interface CurveModel {
  sampleDensity(channel: Channel, logE: number): number;
  buildCurveLUT(width?: number, extrapolationPad?: number): CurveLUT;
  readonly measuredLogEMin: number;
  readonly measuredLogEMax: number;
}

/**
 * Construye el modelo de curva característica (splines monótonos R/G/B +
 * generador de LUT) a partir de los puntos digitalizados de UNA película.
 * Compartido entre todas las emulsiones — cada carpeta en color-science/
 * (portra400, portra160, ektar100...) solo aporta sus propios puntos
 * digitalizados y llama a esto.
 */
export function createCurveModel(points: CharacteristicCurvePoint[]): CurveModel {
  const splines: Record<Channel, MonotoneCubicSpline> = {
    r: fitMonotoneCubic(
      points.map((p) => p.logE),
      points.map((p) => p.r)
    ),
    g: fitMonotoneCubic(
      points.map((p) => p.logE),
      points.map((p) => p.g)
    ),
    b: fitMonotoneCubic(
      points.map((p) => p.logE),
      points.map((p) => p.b)
    ),
  };

  const measuredLogEMin = points[0].logE;
  const measuredLogEMax = points[points.length - 1].logE;

  /** Densidad del canal dado a un log-exposure concreto (extrapola fuera del rango medido). */
  function sampleDensity(channel: Channel, logE: number): number {
    return splines[channel].evaluate(logE);
  }

  /**
   * Genera la tabla que se sube a la GPU como textura 1D (width x 1, rgba32float).
   * El dominio se extiende más allá del rango medido usando la tangente de
   * cada extremo, para dar margen al control de exposición sin topar con
   * un borde recortado.
   */
  function buildCurveLUT(width = 512, extrapolationPad = 3.0): CurveLUT {
    const domainMin = measuredLogEMin - extrapolationPad;
    const domainMax = measuredLogEMax + extrapolationPad;

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
        r: sampleDensity("r", measuredLogEMin),
        g: sampleDensity("g", measuredLogEMin),
        b: sampleDensity("b", measuredLogEMin),
      },
      dMax: {
        r: sampleDensity("r", measuredLogEMax),
        g: sampleDensity("g", measuredLogEMax),
        b: sampleDensity("b", measuredLogEMax),
      },
    };
  }

  return { sampleDensity, buildCurveLUT, measuredLogEMin, measuredLogEMax };
}

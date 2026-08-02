import { describe, expect, it } from "vitest";
import { ektar100CharacteristicCurve } from "./characteristicCurveData";
import { buildCurveLUT, sampleDensity } from "./characteristicCurve";

describe("curva característica Ektar 100 — contra datos reales de Kodak (E-4046)", () => {
  it("reproduce cada punto digitalizado del datasheet dentro de tolerancia", () => {
    for (const point of ektar100CharacteristicCurve) {
      expect(sampleDensity("r", point.logE)).toBeCloseTo(point.r, 2);
      expect(sampleDensity("g", point.logE)).toBeCloseTo(point.g, 2);
      expect(sampleDensity("b", point.logE)).toBeCloseTo(point.b, 2);
    }
  });

  it("es monótona creciente en todo el rango medido (más exposición = más densidad, nunca menos)", () => {
    const logEs = ektar100CharacteristicCurve.map((p) => p.logE);
    const min = logEs[0];
    const max = logEs[logEs.length - 1];
    const steps = 500;
    for (const channel of ["r", "g", "b"] as const) {
      let prev = sampleDensity(channel, min);
      for (let i = 1; i <= steps; i++) {
        const logE = min + (i / steps) * (max - min);
        const d = sampleDensity(channel, logE);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = d;
      }
    }
  });

  it("tiene un 'toe' real: la pendiente en sombras es menor que en la zona lineal", () => {
    const dLogE = 0.05;
    for (const channel of ["r", "g", "b"] as const) {
      const toeSlope =
        (sampleDensity(channel, -2.7 + dLogE) - sampleDensity(channel, -2.7 - dLogE)) / (2 * dLogE);
      const straightSlope =
        (sampleDensity(channel, -1.0 + dLogE) - sampleDensity(channel, -1.0 - dLogE)) / (2 * dLogE);
      expect(toeSlope).toBeLessThan(straightSlope);
    }
  });

  it("el orden de densidad B > G > R se mantiene en todo el rango (según el gráfico de Kodak)", () => {
    for (let logE = -2.8; logE <= 1.15; logE += 0.1) {
      const r = sampleDensity("r", logE);
      const g = sampleDensity("g", logE);
      const b = sampleDensity("b", logE);
      expect(b).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(r);
    }
  });

  it("la LUT generada coincide con sampleDensity en sus propios nodos", () => {
    const lut = buildCurveLUT(512, 3.0);
    for (let i = 0; i < lut.width; i += 37) {
      const t = i / (lut.width - 1);
      const logE = lut.domainMin + t * (lut.domainMax - lut.domainMin);
      expect(lut.data[i * 4 + 0]).toBeCloseTo(sampleDensity("r", logE), 5);
      expect(lut.data[i * 4 + 1]).toBeCloseTo(sampleDensity("g", logE), 5);
      expect(lut.data[i * 4 + 2]).toBeCloseTo(sampleDensity("b", logE), 5);
    }
  });

  it("fuera del rango medido, extrapola linealmente en vez de recortar en seco", () => {
    for (const channel of ["r", "g", "b"] as const) {
      const beyond = sampleDensity(channel, 2.0);
      const atEdge = sampleDensity(channel, 1.1734);
      expect(beyond).toBeGreaterThan(atEdge);
    }
  });

  it("en sombras muy por debajo del rango medido, la densidad se acerca a una asíntota (no baja de forma ilimitada ni se vuelve negativa)", () => {
    for (const channel of ["r", "g", "b"] as const) {
      const dMinMeasured = ektar100CharacteristicCurve[0][channel];
      const veryDark = sampleDensity(channel, -20);
      expect(veryDark).toBeGreaterThan(dMinMeasured - 0.2);
      expect(veryDark).toBeGreaterThan(0);
    }
  });

  it("sigue siendo monótona también en la zona extrapolada de sombras", () => {
    for (const channel of ["r", "g", "b"] as const) {
      let prev = sampleDensity(channel, -30);
      for (let logE = -29; logE <= ektar100CharacteristicCurve[0].logE; logE += 0.5) {
        const d = sampleDensity(channel, logE);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = d;
      }
    }
  });
});

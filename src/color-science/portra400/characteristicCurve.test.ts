import { describe, expect, it } from "vitest";
import { portra400CharacteristicCurve } from "./characteristicCurveData";
import { buildCurveLUT, sampleDensity } from "./characteristicCurve";

describe("curva característica Portra 400 — contra datos reales de Kodak (E-4050)", () => {
  it("reproduce cada punto digitalizado del datasheet dentro de tolerancia", () => {
    for (const point of portra400CharacteristicCurve) {
      expect(sampleDensity("r", point.logE)).toBeCloseTo(point.r, 2);
      expect(sampleDensity("g", point.logE)).toBeCloseTo(point.g, 2);
      expect(sampleDensity("b", point.logE)).toBeCloseTo(point.b, 2);
    }
  });

  it("es monótona creciente en todo el rango medido (más exposición = más densidad, nunca menos)", () => {
    const logEs = portra400CharacteristicCurve.map((p) => p.logE);
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
    // Pendiente cerca del extremo de sombras (toe) vs. pendiente en la zona recta media.
    const dLogE = 0.05;
    for (const channel of ["r", "g", "b"] as const) {
      const toeSlope =
        (sampleDensity(channel, -3.0 + dLogE) - sampleDensity(channel, -3.0 - dLogE)) / (2 * dLogE);
      const straightSlope =
        (sampleDensity(channel, -1.0 + dLogE) - sampleDensity(channel, -1.0 - dLogE)) / (2 * dLogE);
      expect(toeSlope).toBeLessThan(straightSlope);
    }
  });

  it("el orden de densidad B > G > R se mantiene en todo el rango (según el gráfico de Kodak)", () => {
    for (let logE = -3.4; logE <= 0.56; logE += 0.1) {
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
      const atEdge = sampleDensity(channel, 0.5644);
      expect(beyond).toBeGreaterThan(atEdge);
    }
  });

  it("en sombras muy por debajo del rango medido, la densidad se acerca a una asíntota (no baja de forma ilimitada ni se vuelve negativa)", () => {
    for (const channel of ["r", "g", "b"] as const) {
      const dMinMeasured = portra400CharacteristicCurve[0][channel];
      const veryDark = sampleDensity(channel, -20);
      expect(veryDark).toBeGreaterThan(dMinMeasured - 0.2); // headroom por defecto es 0.15
      expect(veryDark).toBeGreaterThan(0);
    }
  });

  it("cerca del negro, pequeñas variaciones de log-exposure ya no producen saltos grandes de densidad (fix del ruido de cuantización de 8 bits)", () => {
    // Antes del fix (extrapolación lineal), un salto de 0.3 en logE en esta
    // zona producía ~0.045 de densidad — visible como ruido en sombras casi
    // negras de una imagen de 8 bits normal. Con la asíntota debe quedar
    // muy por debajo de eso.
    for (const channel of ["r", "g", "b"] as const) {
      const a = sampleDensity(channel, -4.21);
      const b = sampleDensity(channel, -3.91);
      expect(Math.abs(b - a)).toBeLessThan(0.02);
    }
  });

  it("sigue siendo monótona también en la zona extrapolada de sombras", () => {
    for (const channel of ["r", "g", "b"] as const) {
      let prev = sampleDensity(channel, -30);
      for (let logE = -29; logE <= portra400CharacteristicCurve[0].logE; logE += 0.5) {
        const d = sampleDensity(channel, logE);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = d;
      }
    }
  });
});

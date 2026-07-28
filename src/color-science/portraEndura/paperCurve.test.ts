import { describe, expect, it } from "vitest";
import { portraEnduraPaperCurve } from "./paperCurveData";
import { buildPaperLUT, samplePaperDensity, PAPER_DENSITY_MIN, PAPER_DENSITY_MAX } from "./paperCurve";

describe("curva del papel Portra Endura — contra datos reales de Kodak (E-4021)", () => {
  it("reproduce cada punto digitalizado del datasheet dentro de tolerancia", () => {
    for (const point of portraEnduraPaperCurve) {
      expect(samplePaperDensity(point.x)).toBeCloseTo(point.density, 2);
    }
  });

  it("es monótona no decreciente en todo el rango medido", () => {
    const xs = portraEnduraPaperCurve.map((p) => p.x);
    const min = xs[0];
    const max = xs[xs.length - 1];
    const steps = 500;
    let prev = samplePaperDensity(min);
    for (let i = 1; i <= steps; i++) {
      const x = min + (i / steps) * (max - min);
      const d = samplePaperDensity(x);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
  });

  it("tiene un toe real (sombras del papel) Y un hombro real (luces del papel) — a diferencia de la película", () => {
    const dLogE = 0.05;
    const toeSlope = (samplePaperDensity(0.3 + dLogE) - samplePaperDensity(0.3 - dLogE)) / (2 * dLogE);
    const straightSlope = (samplePaperDensity(1.6 + dLogE) - samplePaperDensity(1.6 - dLogE)) / (2 * dLogE);
    const shoulderSlope = (samplePaperDensity(2.6 + dLogE) - samplePaperDensity(2.6 - dLogE)) / (2 * dLogE);

    expect(toeSlope).toBeLessThan(straightSlope);
    expect(shoulderSlope).toBeLessThan(straightSlope);
  });

  it("no baja de su densidad mínima ni por debajo del rango medido", () => {
    const veryLow = samplePaperDensity(-10);
    expect(veryLow).toBeGreaterThanOrEqual(PAPER_DENSITY_MIN - 1e-6);
    expect(veryLow).toBeGreaterThan(0);
  });

  it("PAPER_DENSITY_MIN/MAX coinciden con los extremos de los datos digitalizados", () => {
    expect(PAPER_DENSITY_MIN).toBeCloseTo(portraEnduraPaperCurve[0].density, 5);
    expect(PAPER_DENSITY_MAX).toBeCloseTo(portraEnduraPaperCurve[portraEnduraPaperCurve.length - 1].density, 5);
  });

  it("la LUT generada coincide con samplePaperDensity en sus propios nodos", () => {
    const lut = buildPaperLUT(512, 1.5);
    for (let i = 0; i < lut.width; i += 37) {
      const t = i / (lut.width - 1);
      const x = lut.domainMin + t * (lut.domainMax - lut.domainMin);
      expect(lut.data[i * 4 + 0]).toBeCloseTo(samplePaperDensity(x), 5);
    }
  });
});

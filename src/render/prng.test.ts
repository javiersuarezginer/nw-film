import { describe, expect, it } from "vitest";
import { hash32, hashCoords, mulberry32, poissonSample } from "./prng";

describe("prng — utilidades deterministas", () => {
  it("hash32 es determinista", () => {
    expect(hash32(42)).toBe(hash32(42));
    expect(hash32(1)).not.toBe(hash32(2));
  });

  it("hashCoords es determinista y sensible a cada coordenada", () => {
    const base = hashCoords(1, 2, 0, 99);
    expect(hashCoords(1, 2, 0, 99)).toBe(base);
    expect(hashCoords(2, 2, 0, 99)).not.toBe(base);
    expect(hashCoords(1, 3, 0, 99)).not.toBe(base);
    expect(hashCoords(1, 2, 1, 99)).not.toBe(base);
    expect(hashCoords(1, 2, 0, 100)).not.toBe(base);
  });

  it("mulberry32 produce siempre la misma secuencia para la misma semilla", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("poissonSample tiene media ≈ lambda para muestras grandes", () => {
    const rand = mulberry32(7);
    const lambda = 4.2;
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += poissonSample(lambda, rand);
    const mean = sum / n;
    expect(mean).toBeGreaterThan(lambda * 0.9);
    expect(mean).toBeLessThan(lambda * 1.1);
  });

  it("poissonSample(0, ...) siempre da 0", () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      expect(poissonSample(0, rand)).toBe(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { renderBooleanGrainChannel, type BooleanGrainParams } from "./booleanGrain";

function makeUniformDensity(width: number, height: number, value: number): Float32Array {
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 1;
  }
  return data;
}

describe("grano booleano (Newson/Delon/Galerne, aproximación práctica)", () => {
  it("converge, en promedio, hacia la densidad objetivo (probabilidad de cobertura correcta)", () => {
    const width = 80;
    const height = 80;
    const dMin = 0.2;
    const dMax = 2.0;
    const target = dMin + 0.5 * (dMax - dMin); // u=0.5, el punto de máxima varianza

    const density = makeUniformDensity(width, height, target);
    const out = new Float32Array(density.length);

    const params: BooleanGrainParams = {
      radius: { r: 1.2, g: 1.2, b: 1.2 },
      dMin: { r: dMin, g: dMin, b: dMin },
      dMax: { r: dMax, g: dMax, b: dMax },
      seed: 123,
      samplesPerPixel: 6,
    };

    renderBooleanGrainChannel(density, width, height, "r", params, out);

    let sum = 0;
    for (let i = 0; i < out.length; i += 4) sum += out[i];
    const mean = sum / (width * height);

    // Tolerancia generosa: es un proceso estocástico Monte Carlo, no un
    // resultado exacto — solo comprobamos que converge razonablemente
    // cerca del valor objetivo, no que lo iguale al dígito.
    expect(mean).toBeGreaterThan(target - 0.15);
    expect(mean).toBeLessThan(target + 0.15);
  });

  it("tiene más varianza en medios tonos que cerca de los extremos (negro puro / luces quemadas)", () => {
    const width = 60;
    const height = 60;
    const dMin = 0.2;
    const dMax = 2.0;

    function varianceFor(u: number): number {
      const target = dMin + u * (dMax - dMin);
      const density = makeUniformDensity(width, height, target);
      const out = new Float32Array(density.length);
      const params: BooleanGrainParams = {
        radius: { r: 1.2, g: 1.2, b: 1.2 },
        dMin: { r: dMin, g: dMin, b: dMin },
        dMax: { r: dMax, g: dMax, b: dMax },
        seed: 7,
        samplesPerPixel: 6,
      };
      renderBooleanGrainChannel(density, width, height, "r", params, out);
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let i = 0; i < out.length; i += 4) {
        sum += out[i];
        sumSq += out[i] * out[i];
        n++;
      }
      const mean = sum / n;
      return sumSq / n - mean * mean;
    }

    const varMid = varianceFor(0.5);
    const varDark = varianceFor(0.03);
    const varBright = varianceFor(0.97);

    expect(varMid).toBeGreaterThan(varDark);
    expect(varMid).toBeGreaterThan(varBright);
  });

  it("es determinista: misma entrada + misma semilla → mismo resultado exacto", () => {
    const width = 30;
    const height = 30;
    const density = makeUniformDensity(width, height, 1.0);
    const params: BooleanGrainParams = {
      radius: { r: 1.0, g: 1.0, b: 1.0 },
      dMin: { r: 0.2, g: 0.2, b: 0.2 },
      dMax: { r: 2.0, g: 2.0, b: 2.0 },
      seed: 42,
      samplesPerPixel: 4,
    };

    const outA = new Float32Array(density.length);
    const outB = new Float32Array(density.length);
    renderBooleanGrainChannel(density, width, height, "r", params, outA);
    renderBooleanGrainChannel(density, width, height, "r", params, outB);

    expect(Array.from(outA)).toEqual(Array.from(outB));
  });
});

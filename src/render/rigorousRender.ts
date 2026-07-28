import { renderBooleanGrainChannel, type BooleanGrainParams } from "./booleanGrain";
import { boxBlurChannel } from "./boxBlur";
import {
  buildPaperLUT,
  PAPER_DENSITY_MIN,
  PAPER_DENSITY_MAX,
  type PaperLUT,
} from "../color-science/portraEndura/paperCurve";

export interface RigorousRenderParams {
  grain: {
    radius: { r: number; g: number; b: number };
    seed: number;
    samplesPerPixel: number;
  };
  filmDMin: { r: number; g: number; b: number };
  filmDMax: { r: number; g: number; b: number };
  acutance: { radiusPx: number; amount: number };
  paper: {
    enabled: boolean;
    offsets: { r: number; g: number; b: number };
  };
}

function linearToSrgb(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  if (clamped <= 0.0031308) return clamped * 12.92;
  return 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function samplePaperLUT(lut: PaperLUT, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lut.domainMin) / (lut.domainMax - lut.domainMin)));
  const fx = t * (lut.width - 1);
  const x0 = Math.floor(fx);
  const x1 = Math.min(x0 + 1, lut.width - 1);
  const frac = fx - x0;
  const d0 = lut.data[x0 * 4];
  const d1 = lut.data[x1 * 4];
  return d0 + (d1 - d0) * frac;
}

/**
 * Pipeline completo del render riguroso, pensado para correr dentro de
 * un Web Worker: grano booleano real (Newson/Delon/Galerne) → acutancia
 * (unsharp mask en densidad) → conversión a imagen positiva (papel real
 * o vista previa plana, la misma matemática que los shaders WGSL) → sRGB.
 *
 * `onProgress` recibe una fracción 0–1 del trabajo total.
 */
export function renderRigorous(
  density: Float32Array,
  width: number,
  height: number,
  params: RigorousRenderParams,
  onProgress?: (fraction: number) => void
): Uint8ClampedArray {
  const grainParams: BooleanGrainParams = {
    radius: params.grain.radius,
    dMin: params.filmDMin,
    dMax: params.filmDMax,
    seed: params.grain.seed,
    samplesPerPixel: params.grain.samplesPerPixel,
  };

  const grained = new Float32Array(density.length);
  grained.set(density); // copia alpha (y placeholder inicial) de una vez

  const channels: Array<"r" | "g" | "b"> = ["r", "g", "b"];
  channels.forEach((channel, i) => {
    renderBooleanGrainChannel(density, width, height, channel, grainParams, grained, (f) => {
      onProgress?.((i + f) / channels.length / 1.3); // grano ≈ 77% del presupuesto de progreso
    });
  });

  // --- Acutancia (unsharp mask en densidad) ---
  const blurred = new Float32Array(grained.length);
  for (let c = 0; c < 3; c++) {
    boxBlurChannel(grained, width, height, c, params.acutance.radiusPx, blurred);
  }
  const sharpened = new Float32Array(grained.length);
  for (let i = 0; i < grained.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      sharpened[i + c] = grained[i + c] + (grained[i + c] - blurred[i + c]) * params.acutance.amount;
    }
    sharpened[i + 3] = grained[i + 3];
  }
  onProgress?.(0.85);

  // --- Conversión a imagen positiva ---
  const paperLut = params.paper.enabled ? buildPaperLUT(512, 1.5) : null;
  const out = new Uint8ClampedArray(width * height * 4);

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    let nr: number, ng: number, nb: number;

    if (paperLut) {
      const calibR = sharpened[i] + params.paper.offsets.r;
      const calibG = sharpened[i + 1] + params.paper.offsets.g;
      const calibB = sharpened[i + 2] + params.paper.offsets.b;

      const pr = samplePaperLUT(paperLut, 3.0 - calibR);
      const pg = samplePaperLUT(paperLut, 3.0 - calibG);
      const pb = samplePaperLUT(paperLut, 3.0 - calibB);

      // Mismos extremos que usa scannerPaper.wgsl (densidad mínima/máxima
      // medida del papel, no el dominio ampliado de la LUT).
      const span = PAPER_DENSITY_MAX - PAPER_DENSITY_MIN;

      nr = 1 - Math.min(1, Math.max(0, (pr - PAPER_DENSITY_MIN) / span));
      ng = 1 - Math.min(1, Math.max(0, (pg - PAPER_DENSITY_MIN) / span));
      nb = 1 - Math.min(1, Math.max(0, (pb - PAPER_DENSITY_MIN) / span));
    } else {
      nr = Math.min(1, Math.max(0, (sharpened[i] - params.filmDMin.r) / (params.filmDMax.r - params.filmDMin.r)));
      ng = Math.min(
        1,
        Math.max(0, (sharpened[i + 1] - params.filmDMin.g) / (params.filmDMax.g - params.filmDMin.g))
      );
      nb = Math.min(
        1,
        Math.max(0, (sharpened[i + 2] - params.filmDMin.b) / (params.filmDMax.b - params.filmDMin.b))
      );
    }

    out[i] = Math.round(linearToSrgb(nr) * 255);
    out[i + 1] = Math.round(linearToSrgb(ng) * 255);
    out[i + 2] = Math.round(linearToSrgb(nb) * 255);
    out[i + 3] = 255;

    if (p % (width * 8) === 0) {
      onProgress?.(0.85 + 0.15 * (p / (width * height)));
    }
  }

  onProgress?.(1);
  return out;
}

import { describe, expect, it } from "vitest";
import { createCurveModel } from "../curveModel";
import { recordToFilmProfile, validateAndClampFilmRecord, type FilmRecordContext } from "./customFilm";

const CONTEXT: FilmRecordContext = {
  id: "custom-test-id",
  createdAt: "2026-08-04T00:00:00.000Z",
  modelId: "claude-sonnet-5",
  sourceImageName: "foto.jpg",
};

const VALID_RAW = {
  label: "Ámbar de Tarde",
  analysisNote: "Sombras cálidas, grano visible, halation moderado en luces cálidas.",
  curvePoints: [
    { logE: -3.4, r: 0.25, g: 0.65, b: 0.9 },
    { logE: -2.5, r: 0.4, g: 0.9, b: 1.2 },
    { logE: -1.5, r: 0.9, g: 1.4, b: 1.9 },
    { logE: -0.5, r: 1.4, g: 1.9, b: 2.4 },
    { logE: 0.0, r: 1.7, g: 2.1, b: 2.7 },
    { logE: 0.5, r: 1.95, g: 2.35, b: 2.95 },
    { logE: 0.9, r: 2.05, g: 2.45, b: 3.05 },
  ],
  colorCharacter: { shadowWarmth: 12, shadowTint: -4, highlightWarmth: 8, highlightTint: 0, saturationBias: 5, vibranceBias: 10 },
  grainCharacter: { sizeMultiplier: 1.1, intensityMultiplier: 1.2 },
  halationMultiplier: 0.95,
};

describe("validateAndClampFilmRecord — rechazo estructural", () => {
  it("acepta un registro válido y lo devuelve con el contexto (no lo que venga en raw)", () => {
    const result = validateAndClampFilmRecord(VALID_RAW, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.id).toBe(CONTEXT.id);
    expect(result.record.createdAt).toBe(CONTEXT.createdAt);
    expect(result.record.modelId).toBe(CONTEXT.modelId);
    expect(result.record.label).toBe("Ámbar de Tarde");
    expect(result.record.points).toHaveLength(7);
  });

  it("rechaza si raw no es un objeto", () => {
    expect(validateAndClampFilmRecord(null, CONTEXT).ok).toBe(false);
    expect(validateAndClampFilmRecord("string", CONTEXT).ok).toBe(false);
    expect(validateAndClampFilmRecord([1, 2, 3], CONTEXT).ok).toBe(false);
  });

  it("rechaza con menos de 5 puntos", () => {
    const raw = { ...VALID_RAW, curvePoints: VALID_RAW.curvePoints.slice(0, 4) };
    expect(validateAndClampFilmRecord(raw, CONTEXT).ok).toBe(false);
  });

  it("rechaza con más de 10 puntos", () => {
    const raw = { ...VALID_RAW, curvePoints: Array.from({ length: 11 }, (_, i) => ({ logE: i * 0.1, r: 1, g: 1, b: 1 })) };
    expect(validateAndClampFilmRecord(raw, CONTEXT).ok).toBe(false);
  });

  it("rechaza si un punto tiene un campo no numérico o no finito", () => {
    const withNaN = { ...VALID_RAW, curvePoints: [...VALID_RAW.curvePoints.slice(0, 6), { logE: 0.9, r: NaN, g: 2.45, b: 3.05 }] };
    expect(validateAndClampFilmRecord(withNaN, CONTEXT).ok).toBe(false);

    const withMissing = { ...VALID_RAW, curvePoints: [...VALID_RAW.curvePoints.slice(0, 6), { logE: 0.9, g: 2.45, b: 3.05 }] };
    expect(validateAndClampFilmRecord(withMissing, CONTEXT).ok).toBe(false);
  });

  it("rechaza con logE duplicado o casi duplicado", () => {
    const raw = {
      ...VALID_RAW,
      curvePoints: [...VALID_RAW.curvePoints.slice(0, 6), { logE: VALID_RAW.curvePoints[5].logE, r: 2.0, g: 2.4, b: 3.0 }],
    };
    expect(validateAndClampFilmRecord(raw, CONTEXT).ok).toBe(false);
  });

  it("reordena puntos que llegan desordenados por logE, sin rechazarlos", () => {
    const shuffled = { ...VALID_RAW, curvePoints: [...VALID_RAW.curvePoints].reverse() };
    const result = validateAndClampFilmRecord(shuffled, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (let i = 1; i < result.record.points.length; i++) {
      expect(result.record.points[i].logE).toBeGreaterThan(result.record.points[i - 1].logE);
    }
  });

  it("rechaza si falta colorCharacter, grainCharacter o label", () => {
    expect(validateAndClampFilmRecord({ ...VALID_RAW, colorCharacter: undefined }, CONTEXT).ok).toBe(false);
    expect(validateAndClampFilmRecord({ ...VALID_RAW, grainCharacter: undefined }, CONTEXT).ok).toBe(false);
    expect(validateAndClampFilmRecord({ ...VALID_RAW, label: "" }, CONTEXT).ok).toBe(false);
    expect(validateAndClampFilmRecord({ ...VALID_RAW, label: undefined }, CONTEXT).ok).toBe(false);
  });
});

describe("validateAndClampFilmRecord — clamping semántico", () => {
  it("fuerza monotonía de densidad por canal con máximo acumulado, en vez de rechazar", () => {
    const wobbly = {
      ...VALID_RAW,
      curvePoints: [
        { logE: -3.4, r: 0.25, g: 0.65, b: 0.9 },
        { logE: -2.5, r: 0.4, g: 0.9, b: 1.2 },
        { logE: -1.5, r: 0.3, g: 0.85, b: 1.1 }, // baja respecto al anterior — ruido
        { logE: -0.5, r: 1.4, g: 1.9, b: 2.4 },
        { logE: 0.0, r: 1.7, g: 2.1, b: 2.7 },
        { logE: 0.5, r: 1.95, g: 2.35, b: 2.95 },
        { logE: 0.9, r: 2.05, g: 2.45, b: 3.05 },
      ],
    };
    const result = validateAndClampFilmRecord(wobbly, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const channel of ["r", "g", "b"] as const) {
      let prev = -Infinity;
      for (const point of result.record.points) {
        expect(point[channel]).toBeGreaterThanOrEqual(prev);
        prev = point[channel];
      }
    }
  });

  it("clampa densidad fuera de rango físico plausible en vez de rechazar", () => {
    const extreme = {
      ...VALID_RAW,
      curvePoints: [
        { logE: -3.4, r: -50, g: 0.65, b: 0.9 },
        ...VALID_RAW.curvePoints.slice(1, 6),
        { logE: 0.9, r: 2.05, g: 2.45, b: 999 },
      ],
    };
    const result = validateAndClampFilmRecord(extreme, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.points[0].r).toBeGreaterThanOrEqual(-0.2);
    expect(result.record.points[result.record.points.length - 1].b).toBeLessThanOrEqual(3.6);
  });

  it("clampa colorCharacter a -100..100", () => {
    const raw = { ...VALID_RAW, colorCharacter: { ...VALID_RAW.colorCharacter, shadowWarmth: 500, shadowTint: -500 } };
    const result = validateAndClampFilmRecord(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.colorCharacter.shadowWarmth).toBe(100);
    expect(result.record.colorCharacter.shadowTint).toBe(-100);
  });

  it("clampa grainCharacter y halationMultiplier a 0.2..3.0", () => {
    const raw = {
      ...VALID_RAW,
      grainCharacter: { sizeMultiplier: 50, intensityMultiplier: -10 },
      halationMultiplier: 0.001,
    };
    const result = validateAndClampFilmRecord(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.grainCharacter.sizeMultiplier).toBe(3.0);
    expect(result.record.grainCharacter.intensityMultiplier).toBe(0.2);
    expect(result.record.halationMultiplier).toBe(0.2);
  });

  it("recorta label y analysisNote demasiado largos", () => {
    const raw = { ...VALID_RAW, label: "x".repeat(100), analysisNote: "y".repeat(1000) };
    const result = validateAndClampFilmRecord(raw, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.label.length).toBeLessThanOrEqual(40);
    expect(result.record.analysisNote.length).toBeLessThanOrEqual(400);
  });
});

describe("recordToFilmProfile", () => {
  it("construye un FilmProfile marcado como isCustom, con logHRef en el punto medio del rango", () => {
    const result = validateAndClampFilmRecord(VALID_RAW, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const profile = recordToFilmProfile(result.record);
    expect(profile.isCustom).toBe(true);
    expect(profile.id).toBe(CONTEXT.id);
    expect(profile.curveModel.measuredLogEMin).toBe(result.record.points[0].logE);
    expect(profile.curveModel.measuredLogEMax).toBe(result.record.points[result.record.points.length - 1].logE);
    const expectedMid = (profile.curveModel.measuredLogEMin + profile.curveModel.measuredLogEMax) / 2;
    expect(profile.source.logHRef).toBeCloseTo(expectedMid, 10);
  });
});

describe("createCurveModel con un array corto de puntos (6-9), sin asumir su comportamiento", () => {
  it("buildCurveLUT no produce NaN/Infinity y la densidad es monótona en el rango medido", () => {
    const points = [
      { logE: -3.2, r: 0.25, g: 0.7, b: 0.95 },
      { logE: -2.0, r: 0.5, g: 1.0, b: 1.3 },
      { logE: -0.8, r: 1.1, g: 1.6, b: 2.0 },
      { logE: 0.0, r: 1.6, g: 2.0, b: 2.5 },
      { logE: 0.6, r: 1.9, g: 2.3, b: 2.9 },
      { logE: 1.2, r: 2.1, g: 2.5, b: 3.1 },
    ];
    const model = createCurveModel(points);
    const lut = model.buildCurveLUT(512, 3.0);

    for (let i = 0; i < lut.data.length; i++) {
      expect(Number.isFinite(lut.data[i])).toBe(true);
    }

    for (const channel of ["r", "g", "b"] as const) {
      let prev = model.sampleDensity(channel, points[0].logE);
      for (let logE = points[0].logE; logE <= points[points.length - 1].logE; logE += 0.05) {
        const d = model.sampleDensity(channel, logE);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = d;
      }
    }
  });
});

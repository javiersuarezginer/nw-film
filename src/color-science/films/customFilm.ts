/**
 * Películas creadas por el usuario (IA a partir de una foto de referencia,
 * o importadas desde un JSON exportado antes) — a diferencia de las 5 de
 * `registry.ts`, digitalizadas de datasheets reales de Kodak/Fuji, la curva
 * de una película "custom" es una emulación estilizada de UNA foto en
 * concreto: no hay datos de sensitómetro detrás, así que nunca se presenta
 * como equivalente a una digitalización real (ver CLAUDE.md, sección
 * "Capa de IA"). `isCustom: true` en el `FilmProfile` resultante es la
 * marca que la UI usa para no confundir ambas categorías.
 *
 * Este módulo NUNCA confía en los datos de entrada (respuesta de la API de
 * IA, o JSON re-importado por el usuario) — mismo criterio que ya usa el
 * proyecto para presets (`coercePresetNumber`/`parsePresetValues` en
 * main.ts): validar de verdad antes de que nada llegue a un buffer de GPU.
 */

import { createCurveModel, type CharacteristicCurvePoint } from "../curveModel";
import type { FilmColorCharacter, FilmGrainCharacter, FilmProfile } from "./registry";

export interface CustomFilmRecord {
  id: string;
  /** Texto del desplegable "Película". */
  label: string;
  /** ISO 8601. */
  createdAt: string;
  points: CharacteristicCurvePoint[];
  colorCharacter: FilmColorCharacter;
  grainCharacter: FilmGrainCharacter;
  halationMultiplier: number;
  /** 1-2 frases honestas de la IA describiendo lo que vio en la foto. */
  analysisNote: string;
  /** p.ej. "claude-sonnet-5" — procedencia, útil para depurar. */
  modelId: string;
  /** Nombre del archivo de la foto de referencia, solo informativo local. */
  sourceImageName?: string;
}

export type FilmRecordValidationResult =
  | { ok: true; record: CustomFilmRecord }
  | { ok: false; reason: string };

/** Contexto que el propio código (no la IA ni el JSON externo) decide siempre. */
export interface FilmRecordContext {
  id: string;
  createdAt: string;
  modelId: string;
  sourceImageName?: string;
}

const MIN_POINTS = 5;
const MAX_POINTS = 10;
/** Rango de logE plausible con margen generoso (las 5 películas reales van de -3.4 a 0.9). */
const LOG_E_MIN = -10;
const LOG_E_MAX = 10;
/** Rango de densidad plausible con margen (las 5 películas reales van de 0.2 a 3.1). */
const DENSITY_MIN = -0.2;
const DENSITY_MAX = 3.6;
const CHARACTER_MIN = -100;
const CHARACTER_MAX = 100;
/** Cubre el rango ya usado por las 5 películas reales (0.55-1.35 grano, 0.8-1.15 halation) con margen. */
const MULTIPLIER_MIN = 0.2;
const MULTIPLIER_MAX = 3.0;
const LABEL_MAX_LEN = 40;
const ANALYSIS_NOTE_MAX_LEN = 400;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampCharacterNumber(raw: unknown, fallback: number): number {
  return isFiniteNumber(raw) ? clamp(raw, CHARACTER_MIN, CHARACTER_MAX) : fallback;
}

function clampMultiplierNumber(raw: unknown, fallback: number): number {
  return isFiniteNumber(raw) ? clamp(raw, MULTIPLIER_MIN, MULTIPLIER_MAX) : fallback;
}

/**
 * Valida estructuralmente los puntos de curva (rechaza si el array no es
 * de fiar) y luego los normaliza: ordena por logE, fuerza monotonía de
 * densidad por canal con máximo acumulado (mismo mecanismo que ya se usó
 * para limpiar ruido de digitalización de Fuji, ver decisions.md) y
 * clampa la densidad a un rango físicamente plausible.
 */
function validatePoints(raw: unknown): CharacteristicCurvePoint[] | null {
  if (!Array.isArray(raw) || raw.length < MIN_POINTS || raw.length > MAX_POINTS) return null;

  const points: CharacteristicCurvePoint[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return null;
    const { logE, r, g, b } = item;
    if (!isFiniteNumber(logE) || !isFiniteNumber(r) || !isFiniteNumber(g) || !isFiniteNumber(b)) return null;
    if (logE < LOG_E_MIN || logE > LOG_E_MAX) return null;
    points.push({ logE, r, g, b });
  }

  points.sort((a, b) => a.logE - b.logE);
  for (let i = 1; i < points.length; i++) {
    if (points[i].logE - points[i - 1].logE < 1e-6) return null; // logE duplicado o casi
  }

  let prevR = -Infinity;
  let prevG = -Infinity;
  let prevB = -Infinity;
  for (const point of points) {
    prevR = Math.max(prevR, clamp(point.r, DENSITY_MIN, DENSITY_MAX));
    prevG = Math.max(prevG, clamp(point.g, DENSITY_MIN, DENSITY_MAX));
    prevB = Math.max(prevB, clamp(point.b, DENSITY_MIN, DENSITY_MAX));
    point.r = prevR;
    point.g = prevG;
    point.b = prevB;
  }

  return points;
}

function validateColorCharacter(raw: unknown): FilmColorCharacter | null {
  if (!isPlainObject(raw)) return null;
  return {
    shadowWarmth: clampCharacterNumber(raw.shadowWarmth, 0),
    shadowTint: clampCharacterNumber(raw.shadowTint, 0),
    highlightWarmth: clampCharacterNumber(raw.highlightWarmth, 0),
    highlightTint: clampCharacterNumber(raw.highlightTint, 0),
    saturationBias: clampCharacterNumber(raw.saturationBias, 0),
    vibranceBias: clampCharacterNumber(raw.vibranceBias, 0),
  };
}

function validateGrainCharacter(raw: unknown): FilmGrainCharacter | null {
  if (!isPlainObject(raw)) return null;
  return {
    sizeMultiplier: clampMultiplierNumber(raw.sizeMultiplier, 1),
    intensityMultiplier: clampMultiplierNumber(raw.intensityMultiplier, 1),
  };
}

/**
 * Valida y clampa datos externos (respuesta de la IA, o JSON re-importado)
 * en dos niveles: rechazo estructural (forma no fiable → se descarta todo
 * el registro, `ok: false`) y clamping semántico (valores fuera de rango
 * físico plausible → se ajustan, no se rechazan). `id`/`createdAt`/
 * `modelId`/`sourceImageName` SIEMPRE vienen de `context`, nunca de `raw`
 * — evita, por ejemplo, colisiones de id al reimportar el mismo archivo.
 */
export function validateAndClampFilmRecord(raw: unknown, context: FilmRecordContext): FilmRecordValidationResult {
  if (!isPlainObject(raw)) return { ok: false, reason: "Formato inválido." };

  const points = validatePoints(raw.curvePoints ?? raw.points);
  if (!points) return { ok: false, reason: "Curva inválida o con un número de puntos fuera de rango." };

  const colorCharacter = validateColorCharacter(raw.colorCharacter);
  if (!colorCharacter) return { ok: false, reason: "Carácter de color inválido." };

  const grainCharacter = validateGrainCharacter(raw.grainCharacter);
  if (!grainCharacter) return { ok: false, reason: "Carácter de grano inválido." };

  if (typeof raw.label !== "string" || raw.label.trim().length === 0) {
    return { ok: false, reason: "Falta el nombre de la película." };
  }

  const halationMultiplier = clampMultiplierNumber(raw.halationMultiplier, 1);
  const label = raw.label.trim().slice(0, LABEL_MAX_LEN);
  const analysisNote = typeof raw.analysisNote === "string" ? raw.analysisNote.trim().slice(0, ANALYSIS_NOTE_MAX_LEN) : "";

  return {
    ok: true,
    record: {
      id: context.id,
      label,
      createdAt: context.createdAt,
      points,
      colorCharacter,
      grainCharacter,
      halationMultiplier,
      analysisNote,
      modelId: context.modelId,
      sourceImageName: context.sourceImageName,
    },
  };
}

/** Construye el `FilmProfile` en memoria (con `CurveModel` real) a partir de un registro serializable. */
export function recordToFilmProfile(record: CustomFilmRecord): FilmProfile {
  const curveModel = createCurveModel(record.points);
  // Mismo criterio que Fuji Pro 400H (que tampoco publica un Log H Ref real):
  // punto medio del rango de logE de la propia curva, documentado como tal.
  const logHRef = (curveModel.measuredLogEMin + curveModel.measuredLogEMax) / 2;

  return {
    id: record.id,
    label: record.label,
    curveModel,
    source: {
      manufacturer: "Generado por IA",
      film: record.label,
      publication: `Análisis de foto de referencia (${record.modelId})`,
      revision: record.createdAt,
      chart: "Curva estilizada a partir de 1 foto — emulación artística, no digitalización de datasheet",
      exposure: "Desconocida (foto de referencia, no exposición de laboratorio controlada)",
      densitometry: "N/D",
      logHRef,
    },
    colorCharacter: record.colorCharacter,
    grainCharacter: record.grainCharacter,
    halationMultiplier: record.halationMultiplier,
    isCustom: true,
  };
}

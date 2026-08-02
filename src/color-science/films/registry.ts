/**
 * Registro de películas disponibles. Cada entrada empareja el modelo de
 * curva de una emulsión (curveModel.ts + su carpeta de datos digitalizados)
 * con el `logHRef` de su propio datasheet, que es lo único específico de
 * película que el motor necesita para renderizar con ella (ver
 * `loadFilmIntoState` en main.ts). El grano, el halation y la exposición
 * por defecto siguen siendo constantes compartidas entre películas — no
 * hay foto de referencia real todavía para calibrarlas por separado (ver
 * decisions.md).
 */

import type { CurveModel } from "../curveModel";
import * as portra400 from "../portra400/characteristicCurve";
import * as portra160 from "../portra160/characteristicCurve";
import * as ektar100 from "../ektar100/characteristicCurve";
import * as fujiPro400h from "../fujiPro400h/characteristicCurve";
import * as gold200 from "../gold200/characteristicCurve";

/** Cada módulo de película exporta sampleDensity/buildCurveLUT + MEASURED_LOG_E_MIN/MAX sueltos (no un objeto CurveModel) — se envuelven aquí. */
function toCurveModel(mod: {
  sampleDensity: CurveModel["sampleDensity"];
  buildCurveLUT: CurveModel["buildCurveLUT"];
  MEASURED_LOG_E_MIN: number;
  MEASURED_LOG_E_MAX: number;
}): CurveModel {
  return {
    sampleDensity: mod.sampleDensity,
    buildCurveLUT: mod.buildCurveLUT,
    measuredLogEMin: mod.MEASURED_LOG_E_MIN,
    measuredLogEMax: mod.MEASURED_LOG_E_MAX,
  };
}

export interface FilmSource {
  manufacturer: string;
  film: string;
  publication: string;
  revision: string;
  chart: string;
  exposure: string;
  densitometry: string;
  logHRef: number;
}

export interface FilmProfile {
  id: string;
  /** Texto del desplegable "Película". */
  label: string;
  curveModel: CurveModel;
  source: FilmSource;
}

export const FILMS: FilmProfile[] = [
  {
    id: "portra400",
    label: "Kodak Portra 400",
    curveModel: toCurveModel(portra400),
    source: portra400.PORTRA_400_SOURCE,
  },
  {
    id: "portra160",
    label: "Kodak Portra 160",
    curveModel: toCurveModel(portra160),
    source: portra160.PORTRA_160_SOURCE,
  },
  {
    id: "ektar100",
    label: "Kodak Ektar 100",
    curveModel: toCurveModel(ektar100),
    source: ektar100.EKTAR_100_SOURCE,
  },
  {
    id: "fujiPro400h",
    label: "Fujicolor Pro 400H",
    curveModel: toCurveModel(fujiPro400h),
    source: fujiPro400h.FUJI_PRO_400H_SOURCE,
  },
  {
    id: "gold200",
    label: "Kodak Gold 200",
    curveModel: toCurveModel(gold200),
    source: gold200.GOLD_200_SOURCE,
  },
];

export const DEFAULT_FILM_ID = "portra400";

export function getFilm(id: string): FilmProfile {
  const film = FILMS.find((f) => f.id === id);
  if (!film) throw new Error(`Película desconocida: "${id}"`);
  return film;
}

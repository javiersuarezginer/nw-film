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

/**
 * Carácter de color propio de cada película, más allá de lo que ya
 * cambia la curva característica (esa solo mueve tonalidad/contraste,
 * canal por canal, de forma independiente — ver characteristicCurve.wgsl).
 * Kodak/Fuji no publican esto como un número de datasheet (no existe un
 * "gráfico de carácter de color" digitalizable, igual que con el halation
 * o el grano): son valores aproximados, inspirados en la descripción real
 * del fabricante y el consenso fotográfico establecido sobre cada
 * emulsión, no medidos de un gráfico. Unidades: mismas que los sliders de
 * usuario (-100..100 para warmth/tint/saturación/viveza) — se SUMAN al
 * valor que el usuario ponga en sus sliders, no lo sustituyen.
 */
export interface FilmColorCharacter {
  /** Sesgo cálido/frío en sombras. + = más cálido. */
  shadowWarmth: number;
  /** Sesgo verde/magenta en sombras. + = más magenta, - = más verde. */
  shadowTint: number;
  /** Sesgo cálido/frío en luces. */
  highlightWarmth: number;
  /** Sesgo verde/magenta en luces. */
  highlightTint: number;
  /** Saturación base de la película. */
  saturationBias: number;
  /** Viveza base de la película. */
  vibranceBias: number;
}

const NEUTRAL_COLOR_CHARACTER: FilmColorCharacter = {
  shadowWarmth: 0,
  shadowTint: 0,
  highlightWarmth: 0,
  highlightTint: 0,
  saturationBias: 0,
  vibranceBias: 0,
};

export interface FilmProfile {
  id: string;
  /** Texto del desplegable "Película". */
  label: string;
  curveModel: CurveModel;
  source: FilmSource;
  colorCharacter: FilmColorCharacter;
}

export const FILMS: FilmProfile[] = [
  {
    id: "portra400",
    label: "Kodak Portra 400",
    curveModel: toCurveModel(portra400),
    source: portra400.PORTRA_400_SOURCE,
    // Referencia neutra: toda la calibración de exposición/papel del
    // proyecto se afinó contra esta película — el resto se describe en
    // relación a ella, no al revés.
    colorCharacter: NEUTRAL_COLOR_CHARACTER,
  },
  {
    id: "portra160",
    label: "Kodak Portra 160",
    curveModel: toCurveModel(portra160),
    source: portra160.PORTRA_160_SOURCE,
    // Misma familia que Portra 400 ("smoothly natural skin tone
    // reproduction" en su propio datasheet) — carácter casi idéntico,
    // solo ligeramente más limpia/menos saturada por su grano más fino.
    colorCharacter: { shadowWarmth: 0, shadowTint: 0, highlightWarmth: 0, highlightTint: 0, saturationBias: -3, vibranceBias: -2 },
  },
  {
    id: "ektar100",
    label: "Kodak Ektar 100",
    curveModel: toCurveModel(ektar100),
    source: ektar100.EKTAR_100_SOURCE,
    // Kodak la vende explícitamente como la más saturada y contrastada
    // de su catálogo ("vivid color... ultra-vivid, saturated color").
    // Rojos/naranjas cálidos y punchy en luces; sombras algo más frías
    // por contraste, característico de los negativos "vívidos".
    colorCharacter: { shadowWarmth: -5, shadowTint: 0, highlightWarmth: 8, highlightTint: 0, saturationBias: 25, vibranceBias: 15 },
  },
  {
    id: "fujiPro400h",
    label: "Fujicolor Pro 400H",
    curveModel: toCurveModel(fujiPro400h),
    source: fujiPro400h.FUJI_PRO_400H_SOURCE,
    // La característica más citada de esta película descatalogada: verdes
    // pastel en sombras/medios tonos y una reproducción más fría y
    // desaturada que las Kodak — de ahí su fama en boda/moda para un
    // look suave, no el salado de Ektar.
    colorCharacter: { shadowWarmth: -3, shadowTint: -12, highlightWarmth: -5, highlightTint: -3, saturationBias: -20, vibranceBias: -10 },
  },
  {
    id: "gold200",
    label: "Kodak Gold 200",
    curveModel: toCurveModel(gold200),
    source: gold200.GOLD_200_SOURCE,
    // Stock de consumo, cálido y "nostálgico" — el look dorado/vintage
    // que le da nombre. Más punchy que las películas profesionales pero
    // sin la sofisticación de Ektar.
    colorCharacter: { shadowWarmth: 5, shadowTint: -5, highlightWarmth: 10, highlightTint: 0, saturationBias: 10, vibranceBias: 5 },
  },
];

export const DEFAULT_FILM_ID = "portra400";

export function getFilm(id: string): FilmProfile {
  const film = FILMS.find((f) => f.id === id);
  if (!film) throw new Error(`Película desconocida: "${id}"`);
  return film;
}

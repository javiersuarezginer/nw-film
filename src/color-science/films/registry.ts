/**
 * Registro de películas disponibles. Cada entrada empareja el modelo de
 * curva de una emulsión (curveModel.ts + su carpeta de datos digitalizados)
 * con el `logHRef` de su propio datasheet, que es lo único específico de
 * película que el motor necesita para renderizar con ella (ver
 * `loadFilmIntoState` en main.ts). La exposición por defecto sigue siendo
 * una constante compartida entre películas (ver decisions.md). El grano y
 * el halation SÍ tienen ahora un multiplicador propio por película (ver
 * `FilmGrainCharacter`/`halationMultiplier` más abajo).
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

/**
 * Grano y halation propios de cada película, como multiplicador sobre las
 * constantes base compartidas (`GRAIN_SIZE_FRACTION`/`GRAIN_BASE_INTENSITY`/
 * `HALATION_BASE_INTENSITY` en main.ts, calibradas contra Portra 400 — su
 * multiplicador es 1.0 en las tres, la referencia del resto). Igual que
 * `FilmColorCharacter`, son aproximaciones por consenso fotográfico y
 * descripción del propio fabricante (Kodak vende Ektar 100 explícitamente
 * como "the world's finest grain color negative film", Portra 160 como la
 * más fina de su familia, Gold 200 es un stock de consumo con fama de grano
 * más visible), NO datos medidos — se intentó medir el tamaño real de
 * grano en fotos de referencia reales de cada película
 * (docs/reference/{Portra160,Portra400,Ektar100,Gold200,Fujicolor400h}.*)
 * con el mismo método FFT/autocorrelación que ya sirvió para calibrar
 * Portra 400, pero al ser fotos encontradas (compresión JPEG/WebP y
 * redimensionados desconocidos, no un escaneo controlado) el resultado no
 * discriminaba entre películas — dominaba el ruido de compresión, no el
 * grano real. Se descartó ese dato por no ser fiable; estos multiplicadores
 * quedan en el mismo nivel de honestidad que el resto de constantes
 * artísticas del proyecto.
 */
export interface FilmGrainCharacter {
  /** Tamaño de grano relativo a Portra 400 (1.0 = igual). */
  sizeMultiplier: number;
  /** Intensidad/visibilidad de grano relativa a Portra 400. */
  intensityMultiplier: number;
}

const NEUTRAL_GRAIN_CHARACTER: FilmGrainCharacter = { sizeMultiplier: 1, intensityMultiplier: 1 };

export interface FilmProfile {
  id: string;
  /** Texto del desplegable "Película". */
  label: string;
  curveModel: CurveModel;
  source: FilmSource;
  colorCharacter: FilmColorCharacter;
  grainCharacter: FilmGrainCharacter;
  /** Intensidad de halation relativa a Portra 400 (1.0 = igual). */
  halationMultiplier: number;
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
    grainCharacter: NEUTRAL_GRAIN_CHARACTER,
    halationMultiplier: 1,
  },
  {
    id: "portra160",
    label: "Kodak Portra 160",
    curveModel: toCurveModel(portra160),
    source: portra160.PORTRA_160_SOURCE,
    // Misma familia que Portra 400 ("smoothly natural skin tone
    // reproduction" en su propio datasheet) — carácter casi idéntico,
    // solo ligeramente más limpia/menos saturada por su grano más fino.
    // Confirmado con foto de referencia real (docs/reference/Portra160.jpg,
    // torre de socorrista): el cielo sale el más neutro/cálido de las 4
    // películas con cielo comparadas, ninguna desviación de color extra —
    // se deja igual de neutra que antes.
    colorCharacter: { shadowWarmth: 0, shadowTint: 0, highlightWarmth: 0, highlightTint: 0, saturationBias: -3, vibranceBias: -2 },
    // Kodak la vende explícitamente como la de grano más fino de la
    // familia Portra — más fina y algo menos visible que la propia
    // Portra 400.
    grainCharacter: { sizeMultiplier: 0.75, intensityMultiplier: 0.85 },
    halationMultiplier: 0.9,
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
    // Confirmado con foto de referencia real (docs/reference/Ektar100.webp,
    // árbol rojo): el cielo sale el más azul/vívido de las 4 películas con
    // cielo comparadas (saturación, no un cambio de matiz) — refuerza el
    // saturationBias ya alto; se sube ligeramente junto al resto.
    colorCharacter: { shadowWarmth: -10, shadowTint: 0, highlightWarmth: 14, highlightTint: 0, saturationBias: 32, vibranceBias: 20 },
    // "The world's finest grain color negative film" según el propio
    // marketing de Kodak — el grano más fino y menos visible de las 5.
    grainCharacter: { sizeMultiplier: 0.55, intensityMultiplier: 0.6 },
    halationMultiplier: 0.85,
  },
  {
    id: "fujiPro400h",
    label: "Fujicolor Pro 400H",
    curveModel: toCurveModel(fujiPro400h),
    source: fujiPro400h.FUJI_PRO_400H_SOURCE,
    // La característica más citada de esta película descatalogada: verdes
    // pastel en sombras/medios tonos y una reproducción más fría y
    // desaturada que las Kodak — de ahí su fama en boda/moda para un
    // look suave, no el salado de Ektar. Confirmado y AMPLIFICADO con foto
    // de referencia real (docs/reference/Fujicolor400h.jpg, mujer junto al
    // mar): piel notablemente menos cálida que Portra 400/Gold 200 en la
    // misma comparación (R/G≈1.24 frente a 1.42-1.52) y sombra claramente
    // fría/verdosa (R/G≈0.76, B/G≈1.10) — la única de las 5 con sombra
    // fría medida; los valores anteriores se quedaban cortos frente a esto.
    colorCharacter: { shadowWarmth: -9, shadowTint: -28, highlightWarmth: -11, highlightTint: -8, saturationBias: -26, vibranceBias: -14 },
    // Grano algo más suelto/visible que Portra 400 para el mismo ISO 400,
    // percepción habitual en la comunidad fotográfica sobre este stock.
    grainCharacter: { sizeMultiplier: 1.05, intensityMultiplier: 1.1 },
    // Reproducción de luces más fría/contenida que las Kodak — halation
    // algo más discreto.
    halationMultiplier: 0.8,
  },
  {
    id: "gold200",
    label: "Kodak Gold 200",
    curveModel: toCurveModel(gold200),
    source: gold200.GOLD_200_SOURCE,
    // Stock de consumo, cálido y "nostálgico" — el look dorado/vintage
    // que le da nombre. Más punchy que las películas profesionales pero
    // sin la sofisticación de Ektar. (La foto de referencia real de este
    // stock, docs/reference/Gold200.jpg, tiene un cielo brumoso/luz muy
    // distinta a las otras 3 comparables — no sirvió para confirmar o
    // contradecir el sesgo cálido con fiabilidad, así que se mantiene el
    // criterio original de descripción de fabricante/consenso fotográfico,
    // solo algo amplificado junto al resto.)
    colorCharacter: { shadowWarmth: 10, shadowTint: -8, highlightWarmth: 18, highlightTint: 0, saturationBias: 14, vibranceBias: 8 },
    // Stock de consumo de gama media — grano notablemente más visible que
    // los profesionales (Portra/Ektar), fama establecida del stock.
    grainCharacter: { sizeMultiplier: 1.3, intensityMultiplier: 1.35 },
    halationMultiplier: 1.15,
  },
];

export const DEFAULT_FILM_ID = "portra400";

export function getFilm(id: string): FilmProfile {
  const film = FILMS.find((f) => f.id === id);
  if (!film) throw new Error(`Película desconocida: "${id}"`);
  return film;
}

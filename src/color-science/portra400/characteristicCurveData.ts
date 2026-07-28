/**
 * Curva característica (H&D) de Kodak Professional Portra 400.
 *
 * Fuente: datasheet oficial Kodak Alaris, publicación E-4050 (rev. febrero 2016),
 * gráfico "Characteristic Curves" (E4040C). Condiciones: exposición a luz de día,
 * densitometría Status M, Log H Ref = -1.44.
 *
 * Estos puntos se digitalizaron por análisis de píxeles del PDF oficial
 * (no estimados a ojo): se localizó el marco del gráfico para calibrar los
 * ejes y se rastreó cada una de las tres curvas (R, G, B) por continuidad.
 * Sirven como referencia real para ajustar el modelo de la curva y para los
 * tests numéricos de color science.
 *
 * IMPORTANTE: el gráfico de Kodak no muestra ningún "hombro" en las luces
 * altas — las tres curvas suben casi en línea recta hasta donde llega el
 * gráfico (logE ≈ 0.56). El único tramo no lineal real es el "toe" en las
 * sombras (logE < ≈ -2.5). El redondeo de luces altas que se asocia
 * visualmente a Portra no está en estos datos: viene de la simulación de
 * papel/escáner (fase posterior del pipeline), no de la curva del negativo.
 */

export interface CharacteristicCurvePoint {
  logE: number;
  r: number;
  g: number;
  b: number;
}

export const PORTRA_400_SOURCE = {
  manufacturer: "Kodak Alaris",
  film: "Kodak Professional Portra 400",
  publication: "E-4050",
  revision: "February 2016",
  chart: "E4040C — Characteristic Curves",
  exposure: "Daylight",
  densitometry: "Status M",
  logHRef: -1.44,
} as const;

export const portra400CharacteristicCurve: CharacteristicCurvePoint[] = [
  { logE: -3.4148, r: 0.2161, g: 0.6432, b: 0.862 },
  { logE: -3.3368, r: 0.2161, g: 0.6432, b: 0.8672 },
  { logE: -3.2588, r: 0.2214, g: 0.6432, b: 0.8672 },
  { logE: -3.1808, r: 0.2214, g: 0.6484, b: 0.8724 },
  { logE: -3.1027, r: 0.2266, g: 0.6536, b: 0.8724 },
  { logE: -3.0247, r: 0.2266, g: 0.6536, b: 0.8828 },
  { logE: -2.9467, r: 0.2318, g: 0.6589, b: 0.8932 },
  { logE: -2.8687, r: 0.237, g: 0.6641, b: 0.9141 },
  { logE: -2.7906, r: 0.2474, g: 0.6771, b: 0.9401 },
  { logE: -2.7126, r: 0.263, g: 0.6953, b: 0.974 },
  { logE: -2.6346, r: 0.2812, g: 0.7188, b: 1.0156 },
  { logE: -2.5566, r: 0.3125, g: 0.75, b: 1.0573 },
  { logE: -2.4785, r: 0.3438, g: 0.7812, b: 1.1042 },
  { logE: -2.4005, r: 0.3802, g: 0.8229, b: 1.1536 },
  { logE: -2.3225, r: 0.4219, g: 0.8646, b: 1.2031 },
  { logE: -2.2445, r: 0.4635, g: 0.9115, b: 1.25 },
  { logE: -2.1664, r: 0.5052, g: 0.9531, b: 1.2995 },
  { logE: -2.0884, r: 0.5417, g: 1.0, b: 1.349 },
  { logE: -2.0104, r: 0.5833, g: 1.0417, b: 1.3984 },
  { logE: -1.9324, r: 0.625, g: 1.0833, b: 1.4479 },
  { logE: -1.8544, r: 0.6667, g: 1.1302, b: 1.4948 },
  { logE: -1.7763, r: 0.7031, g: 1.1719, b: 1.5469 },
  { logE: -1.6983, r: 0.7448, g: 1.2188, b: 1.5938 },
  { logE: -1.6203, r: 0.7865, g: 1.2604, b: 1.6458 },
  { logE: -1.5423, r: 0.8281, g: 1.3021, b: 1.6927 },
  { logE: -1.4642, r: 0.8698, g: 1.3438, b: 1.7422 },
  { logE: -1.3862, r: 0.9115, g: 1.3906, b: 1.7917 },
  { logE: -1.3082, r: 0.9531, g: 1.4323, b: 1.8411 },
  { logE: -1.2302, r: 0.9974, g: 1.474, b: 1.8906 },
  { logE: -1.1521, r: 1.0417, g: 1.5208, b: 1.9427 },
  { logE: -1.0741, r: 1.0833, g: 1.5625, b: 1.9922 },
  { logE: -0.9961, r: 1.125, g: 1.6042, b: 2.0417 },
  { logE: -0.9181, r: 1.1667, g: 1.6484, b: 2.0911 },
  { logE: -0.8401, r: 1.2083, g: 1.6927, b: 2.1406 },
  { logE: -0.762, r: 1.2552, g: 1.7344, b: 2.1927 },
  { logE: -0.684, r: 1.2969, g: 1.776, b: 2.2422 },
  { logE: -0.606, r: 1.3438, g: 1.8177, b: 2.2917 },
  { logE: -0.528, r: 1.3854, g: 1.8646, b: 2.3411 },
  { logE: -0.4499, r: 1.4271, g: 1.9062, b: 2.3906 },
  { logE: -0.3719, r: 1.474, g: 1.9479, b: 2.4427 },
  { logE: -0.2939, r: 1.5182, g: 1.9896, b: 2.4922 },
  { logE: -0.2159, r: 1.5625, g: 2.0312, b: 2.5417 },
  { logE: -0.1378, r: 1.6068, g: 2.0781, b: 2.5938 },
  { logE: -0.0598, r: 1.651, g: 2.1198, b: 2.6432 },
  { logE: 0.0182, r: 1.6979, g: 2.1615, b: 2.6927 },
  { logE: 0.0962, r: 1.7396, g: 2.2031, b: 2.7448 },
  { logE: 0.1743, r: 1.7865, g: 2.2448, b: 2.7943 },
  { logE: 0.2523, r: 1.8307, g: 2.2865, b: 2.8464 },
  { logE: 0.3303, r: 1.875, g: 2.3333, b: 2.8958 },
  { logE: 0.4083, r: 1.9219, g: 2.375, b: 2.9479 },
  { logE: 0.4863, r: 1.9688, g: 2.4167, b: 2.9974 },
  { logE: 0.5644, r: 2.013, g: 2.4557, b: 3.0469 },
];

/**
 * Curva característica (H&D) de Kodak Professional Portra 160.
 *
 * Fuente: datasheet oficial Kodak Alaris, publicación E-4051 (rev. febrero 2016),
 * gráfico "Characteristic Curves". Condiciones: exposición a luz de día,
 * densitometría Status M, Log H Ref = -1.051.
 *
 * Digitalizado con el mismo método que Portra 400 (ver
 * ../portra400/characteristicCurveData.ts): render del PDF oficial a 600dpi,
 * calibración de ejes por detección de las marcas de escala, y trazado de
 * las tres curvas (R, G, B — sin colorear en el PDF, solo distinguibles por
 * su posición y las etiquetas del gráfico) por componentes conexos.
 *
 * IMPORTANTE: igual que Portra 400, el gráfico no muestra ningún "hombro"
 * en las luces altas — las tres curvas suben casi en línea recta hasta
 * donde llega el gráfico (logE ≈ 0.96). El redondeo de luces altas que se
 * asocia visualmente a Portra viene de la simulación de papel/escáner
 * (fase posterior del pipeline), no de la curva del negativo.
 */

import type { CharacteristicCurvePoint } from "../curveModel";

export const PORTRA_160_SOURCE = {
  manufacturer: "Kodak Alaris",
  film: "Kodak Professional Portra 160",
  publication: "E-4051",
  revision: "February 2016",
  chart: "Characteristic Curves",
  exposure: "Daylight",
  densitometry: "Status M",
  logHRef: -1.051,
} as const;

export const portra160CharacteristicCurve: CharacteristicCurvePoint[] = [
  { logE: -3.0251, r: 0.2093, g: 0.6239, b: 0.8435 },
  { logE: -2.947, r: 0.2093, g: 0.6239, b: 0.8488 },
  { logE: -2.8689, r: 0.2093, g: 0.6239, b: 0.8565 },
  { logE: -2.7909, r: 0.2119, g: 0.6252, b: 0.8591 },
  { logE: -2.7128, r: 0.2145, g: 0.6278, b: 0.8591 },
  { logE: -2.6347, r: 0.2197, g: 0.6317, b: 0.8591 },
  { logE: -2.5566, r: 0.2223, g: 0.633, b: 0.8643 },
  { logE: -2.4785, r: 0.2275, g: 0.6382, b: 0.8721 },
  { logE: -2.4005, r: 0.2353, g: 0.6475, b: 0.8892 },
  { logE: -2.3224, r: 0.2457, g: 0.6631, b: 0.9166 },
  { logE: -2.2443, r: 0.2626, g: 0.6842, b: 0.9493 },
  { logE: -2.1662, r: 0.286, g: 0.7128, b: 0.9897 },
  { logE: -2.0881, r: 0.3149, g: 0.748, b: 1.0365 },
  { logE: -2.0101, r: 0.3487, g: 0.787, b: 1.0833 },
  { logE: -1.932, r: 0.3868, g: 0.8313, b: 1.1302 },
  { logE: -1.8539, r: 0.4267, g: 0.8755, b: 1.1779 },
  { logE: -1.7758, r: 0.4631, g: 0.9193, b: 1.2239 },
  { logE: -1.6977, r: 0.5, g: 0.9614, b: 1.2707 },
  { logE: -1.6197, r: 0.5386, g: 1.003, b: 1.3149 },
  { logE: -1.5416, r: 0.5776, g: 1.0447, b: 1.36 },
  { logE: -1.4635, r: 0.6184, g: 1.0863, b: 1.4042 },
  { logE: -1.3854, r: 0.6595, g: 1.1279, b: 1.4484 },
  { logE: -1.3073, r: 0.7017, g: 1.1703, b: 1.4926 },
  { logE: -1.2293, r: 0.7433, g: 1.2119, b: 1.5361 },
  { logE: -1.1512, r: 0.7831, g: 1.2529, b: 1.5804 },
  { logE: -1.0731, r: 0.824, g: 1.2945, b: 1.6246 },
  { logE: -0.995, r: 0.8657, g: 1.3361, b: 1.6701 },
  { logE: -0.917, r: 0.9073, g: 1.3797, b: 1.7183 },
  { logE: -0.8389, r: 0.9489, g: 1.4226, b: 1.7657 },
  { logE: -0.7608, r: 0.9906, g: 1.4655, b: 1.8151 },
  { logE: -0.6827, r: 1.0315, g: 1.5084, b: 1.8646 },
  { logE: -0.6046, r: 1.0739, g: 1.5522, b: 1.9148 },
  { logE: -0.5266, r: 1.1155, g: 1.5956, b: 1.9647 },
  { logE: -0.4485, r: 1.1581, g: 1.6385, b: 2.0149 },
  { logE: -0.3704, r: 1.2014, g: 1.6823, b: 2.0657 },
  { logE: -0.2923, r: 1.2456, g: 1.7256, b: 2.1168 },
  { logE: -0.2142, r: 1.289, g: 1.7698, b: 2.1685 },
  { logE: -0.1362, r: 1.3341, g: 1.815, b: 2.2218 },
  { logE: -0.0581, r: 1.3758, g: 1.8583, b: 2.2725 },
  { logE: 0.02, r: 1.4151, g: 1.8989, b: 2.322 },
  { logE: 0.0981, r: 1.4502, g: 1.9379, b: 2.3688 },
  { logE: 0.1762, r: 1.4864, g: 1.9779, b: 2.4156 },
  { logE: 0.2542, r: 1.5207, g: 2.0182, b: 2.4627 },
  { logE: 0.3323, r: 1.5545, g: 2.0596, b: 2.5108 },
  { logE: 0.4104, r: 1.5868, g: 2.099, b: 2.5588 },
  { logE: 0.4885, r: 1.6169, g: 2.1403, b: 2.6056 },
  { logE: 0.5666, r: 1.6478, g: 2.1794, b: 2.6524 },
  { logE: 0.6446, r: 1.6765, g: 2.2186, b: 2.7007 },
  { logE: 0.7227, r: 1.7052, g: 2.2576, b: 2.7487 },
  { logE: 0.8008, r: 1.7338, g: 2.2966, b: 2.7982 },
  { logE: 0.8789, r: 1.7624, g: 2.3355, b: 2.8463 },
  { logE: 0.957, r: 1.7884, g: 2.3642, b: 2.8918 },
];

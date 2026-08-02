/**
 * Curva característica (H&D) de Fujicolor Pro 400H.
 *
 * Fuente: Fujifilm Product Information Bulletin oficial, publicación
 * AF3-176E, sección 18 "Characteristic Curves". Condiciones: exposición a
 * luz de día 1/125s, proceso C-41, densitometría Status M.
 *
 * Digitalizado con el mismo método que las emulsiones Kodak (ver
 * ../portra400/characteristicCurveData.ts), adaptado a que este gráfico SÍ
 * tiene rejilla completa (no solo marco+marcas): se enmascaran las líneas
 * de rejilla y las etiquetas de texto ("Blue"/"Green"/"Red" sobre las
 * propias curvas) antes de trazar cada columna, en vez de aislar cada
 * curva por componentes conexos.
 *
 * Pro 400H se dejó de fabricar en 2021, pero sigue siendo la referencia
 * más citada de "look de moda/boda" por sus verdes pastel y su gradación
 * suave en piel — de ahí que se incluya pese a estar descatalogada.
 *
 * A diferencia de las fichas de Kodak, esta ficha de Fujifilm NO publica
 * un "Log H Ref" explícito en el gráfico. `logHRef` de abajo es el punto
 * medio del rango de log-exposición medido (una elección razonable para
 * alinear los tres canales en un gris neutro de referencia), no un dato
 * publicado — documentado así para no aparentar una precisión que no
 * existe, mismo criterio que halation/grano en el resto del proyecto.
 */

import type { CharacteristicCurvePoint } from "../curveModel";

export const FUJI_PRO_400H_SOURCE = {
  manufacturer: "Fujifilm",
  film: "Fujicolor PRO 400H",
  publication: "AF3-176E",
  revision: "2020",
  chart: "Characteristic Curves (section 18)",
  exposure: "Daylight, 1/125 sec.",
  densitometry: "Status M",
  logHRef: -1.462, // punto medio del rango medido — ver nota arriba, no es un dato publicado
} as const;

export const fujiPro400hCharacteristicCurve: CharacteristicCurvePoint[] = [
  { logE: -3.5897, r: 0.1739, g: 0.6877, b: 0.9475 },
  { logE: -3.5062, r: 0.1739, g: 0.6877, b: 0.9489 },
  { logE: -3.4228, r: 0.1739, g: 0.6877, b: 0.9489 },
  { logE: -3.3394, r: 0.1739, g: 0.6877, b: 0.9489 },
  { logE: -3.2559, r: 0.1739, g: 0.6877, b: 0.9489 },
  { logE: -3.1725, r: 0.1739, g: 0.6877, b: 0.9489 },
  { logE: -3.089, r: 0.1754, g: 0.6877, b: 0.9489 },
  { logE: -3.0056, r: 0.1773, g: 0.6877, b: 0.9509 },
  { logE: -2.9221, r: 0.1812, g: 0.6877, b: 0.9533 },
  { logE: -2.8387, r: 0.1841, g: 0.6877, b: 0.9591 },
  { logE: -2.7552, r: 0.1899, g: 0.692, b: 0.9649 },
  { logE: -2.6718, r: 0.1957, g: 0.6978, b: 0.9736 },
  { logE: -2.5883, r: 0.203, g: 0.7065, b: 0.9794 },
  { logE: -2.5049, r: 0.213, g: 0.7217, b: 1.0042 },
  { logE: -2.4215, r: 0.2276, g: 0.7428, b: 1.0258 },
  { logE: -2.338, r: 0.2505, g: 0.7712, b: 1.0534 },
  { logE: -2.2546, r: 0.28, g: 0.8054, b: 1.0882 },
  { logE: -2.1711, r: 0.3142, g: 0.8415, b: 1.124 },
  { logE: -2.0877, r: 0.3602, g: 0.8876, b: 1.168 },
  { logE: -2.0042, r: 0.4069, g: 0.9334, b: 1.2126 },
  { logE: -1.9208, r: 0.4536, g: 0.9792, b: 1.2573 },
  { logE: -1.8373, r: 0.5003, g: 1.025, b: 1.3019 },
  { logE: -1.7539, r: 0.547, g: 1.0708, b: 1.3466 },
  { logE: -1.6704, r: 0.5938, g: 1.1166, b: 1.3912 },
  { logE: -1.587, r: 0.6405, g: 1.1624, b: 1.4358 },
  { logE: -1.5036, r: 0.6872, g: 1.2082, b: 1.4805 },
  { logE: -1.4201, r: 0.7339, g: 1.254, b: 1.5251 },
  { logE: -1.3367, r: 0.7806, g: 1.2998, b: 1.5697 },
  { logE: -1.2532, r: 0.8274, g: 1.3456, b: 1.6144 },
  { logE: -1.1698, r: 0.8771, g: 1.3926, b: 1.6593 },
  { logE: -1.0863, r: 0.9287, g: 1.4416, b: 1.7029 },
  { logE: -1.0029, r: 0.9821, g: 1.4883, b: 1.7479 },
  { logE: -0.9194, r: 1.0319, g: 1.5368, b: 1.7909 },
  { logE: -0.836, r: 1.0837, g: 1.5844, b: 1.8355 },
  { logE: -0.7525, r: 1.1351, g: 1.6305, b: 1.8796 },
  { logE: -0.6691, r: 1.1861, g: 1.6781, b: 1.9234 },
  { logE: -0.5857, r: 1.238, g: 1.7242, b: 1.9666 },
  { logE: -0.5022, r: 1.2881, g: 1.7697, b: 2.0105 },
  { logE: -0.4188, r: 1.3387, g: 1.8162, b: 2.0542 },
  { logE: -0.3353, r: 1.388, g: 1.8611, b: 2.0971 },
  { logE: -0.2519, r: 1.4376, g: 1.9058, b: 2.14 },
  { logE: -0.1684, r: 1.4817, g: 1.9507, b: 2.1829 },
  { logE: -0.085, r: 1.5351, g: 1.9866, b: 2.226 },
  { logE: -0.0015, r: 1.5825, g: 2.0407, b: 2.2698 },
  { logE: 0.0819, r: 1.6296, g: 2.0831, b: 2.3124 },
  { logE: 0.1654, r: 1.6754, g: 2.1263, b: 2.3546 },
  { logE: 0.2488, r: 1.7211, g: 2.1682, b: 2.3974 },
  { logE: 0.3323, r: 1.7658, g: 2.2111, b: 2.4391 },
  { logE: 0.4157, r: 1.8099, g: 2.2521, b: 2.4737 },
  { logE: 0.4991, r: 1.8522, g: 2.2934, b: 2.5247 },
  { logE: 0.5826, r: 1.894, g: 2.3334, b: 2.5633 },
  { logE: 0.666, r: 1.9343, g: 2.3682, b: 2.6033 },
];

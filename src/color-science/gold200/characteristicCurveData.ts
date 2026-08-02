/**
 * Curva característica (H&D) de Kodak Gold 200.
 *
 * Fuente: datasheet oficial Kodak Alaris, publicación E-7022 (rev. febrero
 * 2016), gráfico "Characteristic Curves" (E7022B). Condiciones: exposición
 * a luz de día, densitometría Status M, Log H Ref = -1.14.
 *
 * Digitalizado con el mismo método que las demás emulsiones Kodak (ver
 * ../portra400/characteristicCurveData.ts): render del PDF oficial a
 * 600dpi, calibración de ejes por detección de las marcas de escala, y
 * trazado de las tres curvas (R, G, B) por componentes conexos.
 *
 * Gold 200 es el stock de consumo que sirve de base para la simulación de
 * "cámara desechable" del proyecto — el look "desechable" real viene sobre
 * todo de la óptica de plástico barata y el flash incorporado, no de la
 * química del negativo en sí, pero la curva de Gold 200 es la base física
 * correcta sobre la que montar esos efectos ópticos (fase posterior, no
 * cubierta por este dataset).
 */

import type { CharacteristicCurvePoint } from "../curveModel";

export const GOLD_200_SOURCE = {
  manufacturer: "Kodak Alaris",
  film: "Kodak Gold 200",
  publication: "E-7022",
  revision: "February 2016",
  chart: "Characteristic Curves (E7022B)",
  exposure: "Daylight",
  densitometry: "Status M",
  logHRef: -1.14,
} as const;

export const gold200CharacteristicCurve: CharacteristicCurvePoint[] = [
  { logE: -2.9688, r: 0.2549, g: 0.6602, b: 0.9966 },
  { logE: -2.8937, r: 0.2575, g: 0.6628, b: 0.9966 },
  { logE: -2.8186, r: 0.261, g: 0.668, b: 0.9966 },
  { logE: -2.7435, r: 0.2653, g: 0.6706, b: 0.9966 },
  { logE: -2.6684, r: 0.2705, g: 0.6784, b: 0.9966 },
  { logE: -2.5933, r: 0.2783, g: 0.6888, b: 0.9966 },
  { logE: -2.5181, r: 0.2886, g: 0.7043, b: 0.9966 },
  { logE: -2.443, r: 0.3042, g: 0.7226, b: 0.998 },
  { logE: -2.3679, r: 0.3222, g: 0.7459, b: 1.0199 },
  { logE: -2.2928, r: 0.3432, g: 0.7719, b: 1.0457 },
  { logE: -2.2177, r: 0.3692, g: 0.8026, b: 1.0754 },
  { logE: -2.1426, r: 0.3984, g: 0.8349, b: 1.1096 },
  { logE: -2.0675, r: 0.4307, g: 0.8698, b: 1.1482 },
  { logE: -1.9924, r: 0.4669, g: 0.9063, b: 1.1915 },
  { logE: -1.9173, r: 0.5056, g: 0.9448, b: 1.237 },
  { logE: -1.8422, r: 0.5445, g: 0.9861, b: 1.2823 },
  { logE: -1.7671, r: 0.5856, g: 1.0278, b: 1.3266 },
  { logE: -1.692, r: 0.6251, g: 1.0711, b: 1.3725 },
  { logE: -1.6169, r: 0.6654, g: 1.1135, b: 1.4189 },
  { logE: -1.5418, r: 0.7056, g: 1.1561, b: 1.4653 },
  { logE: -1.4667, r: 0.7453, g: 1.1993, b: 1.5136 },
  { logE: -1.3916, r: 0.7862, g: 1.2411, b: 1.5632 },
  { logE: -1.3165, r: 0.8252, g: 1.285, b: 1.6149 },
  { logE: -1.2414, r: 0.8663, g: 1.3288, b: 1.6706 },
  { logE: -1.1663, r: 0.9066, g: 1.3704, b: 1.7259 },
  { logE: -1.0912, r: 0.9473, g: 1.4131, b: 1.7677 },
  { logE: -1.0161, r: 0.9888, g: 1.4557, b: 1.8046 },
  { logE: -0.9409, r: 1.0286, g: 1.4988, b: 1.844 },
  { logE: -0.8658, r: 1.0698, g: 1.5422, b: 1.8856 },
  { logE: -0.7907, r: 1.111, g: 1.5838, b: 1.9294 },
  { logE: -0.7156, r: 1.1525, g: 1.6265, b: 1.9758 },
  { logE: -0.6405, r: 1.1941, g: 1.6689, b: 2.0222 },
  { logE: -0.5654, r: 1.2364, g: 1.7111, b: 2.0686 },
  { logE: -0.4903, r: 1.2784, g: 1.7539, b: 2.117 },
  { logE: -0.4152, r: 1.3197, g: 1.7951, b: 2.164 },
  { logE: -0.3401, r: 1.363, g: 1.8374, b: 2.2125 },
  { logE: -0.265, r: 1.4046, g: 1.88, b: 2.2593 },
  { logE: -0.1899, r: 1.446, g: 1.9213, b: 2.3058 },
  { logE: -0.1148, r: 1.4887, g: 1.9615, b: 2.3523 },
  { logE: -0.0397, r: 1.5275, g: 2.0012, b: 2.3961 },
  { logE: 0.0354, r: 1.5624, g: 2.0372, b: 2.4366 },
  { logE: 0.1105, r: 1.5947, g: 2.0701, b: 2.4741 },
  { logE: 0.1856, r: 1.6231, g: 2.0995, b: 2.5074 },
  { logE: 0.2607, r: 1.65, g: 2.1255, b: 2.5361 },
  { logE: 0.3358, r: 1.6734, g: 2.1488, b: 2.5632 },
  { logE: 0.4109, r: 1.6968, g: 2.1697, b: 2.5879 },
  { logE: 0.486, r: 1.7194, g: 2.1913, b: 2.6139 },
  { logE: 0.5611, r: 1.741, g: 2.2132, b: 2.6387 },
  { logE: 0.6363, r: 1.7636, g: 2.2351, b: 2.6644 },
  { logE: 0.7114, r: 1.7855, g: 2.258, b: 2.6909 },
  { logE: 0.7865, r: 1.8087, g: 2.2803, b: 2.7167 },
  { logE: 0.8616, r: 1.8319, g: 2.3022, b: 2.7412 },
];

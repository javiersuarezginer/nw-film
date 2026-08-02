/**
 * Curva característica (H&D) de Kodak Professional Ektar 100.
 *
 * Fuente: datasheet oficial Kodak Alaris, publicación E-4046, gráfico
 * "Characteristic Curves". Condiciones: exposición a luz de día,
 * densitometría Status M, Log H Ref = -0.84.
 *
 * Digitalizado con el mismo método que Portra 400/160 (ver
 * ../portra400/characteristicCurveData.ts): render del PDF oficial a
 * 600dpi, calibración de ejes por detección de las marcas de escala, y
 * trazado de las tres curvas (R, G, B) por componentes conexos.
 *
 * Ektar 100 es la emulsión más saturada y contrastada de las de Kodak
 * (marketing oficial: "world's finest grain") — se nota en este dataset
 * frente a Portra: mismo rango de log-exposición medido, pero pendiente
 * claramente mayor (más densidad ganada por paso de exposición).
 */

import type { CharacteristicCurvePoint } from "../curveModel";

export const EKTAR_100_SOURCE = {
  manufacturer: "Kodak Alaris",
  film: "Kodak Professional Ektar 100",
  publication: "E-4046",
  revision: "2010",
  chart: "Characteristic Curves (E4046A)",
  exposure: "Daylight",
  densitometry: "Status M",
  logHRef: -0.84,
} as const;

export const ektar100CharacteristicCurve: CharacteristicCurvePoint[] = [
  { logE: -2.8499, r: 0.2086, g: 0.6351, b: 0.8445 },
  { logE: -2.771, r: 0.2125, g: 0.6364, b: 0.8539 },
  { logE: -2.6921, r: 0.2151, g: 0.6364, b: 0.8627 },
  { logE: -2.6133, r: 0.2151, g: 0.639, b: 0.8705 },
  { logE: -2.5344, r: 0.2177, g: 0.639, b: 0.8705 },
  { logE: -2.4555, r: 0.2203, g: 0.6416, b: 0.8731 },
  { logE: -2.3766, r: 0.2255, g: 0.6468, b: 0.8809 },
  { logE: -2.2977, r: 0.2333, g: 0.653, b: 0.8939 },
  { logE: -2.2188, r: 0.2437, g: 0.665, b: 0.9147 },
  { logE: -2.1399, r: 0.2567, g: 0.6797, b: 0.9454 },
  { logE: -2.061, r: 0.2756, g: 0.7001, b: 0.983 },
  { logE: -1.9821, r: 0.3017, g: 0.7261, b: 1.0276 },
  { logE: -1.9033, r: 0.3334, g: 0.76, b: 1.0774 },
  { logE: -1.8244, r: 0.3689, g: 0.7985, b: 1.1262 },
  { logE: -1.7455, r: 0.407, g: 0.8408, b: 1.171 },
  { logE: -1.6666, r: 0.4463, g: 0.8861, b: 1.2159 },
  { logE: -1.5877, r: 0.487, g: 0.9331, b: 1.2699 },
  { logE: -1.5088, r: 0.5289, g: 0.9806, b: 1.333 },
  { logE: -1.4299, r: 0.5714, g: 1.0273, b: 1.3922 },
  { logE: -1.351, r: 0.6152, g: 1.0755, b: 1.4437 },
  { logE: -1.2721, r: 0.6601, g: 1.1204, b: 1.4949 },
  { logE: -1.1933, r: 0.7066, g: 1.1679, b: 1.545 },
  { logE: -1.1144, r: 0.755, g: 1.2128, b: 1.5964 },
  { logE: -1.0355, r: 0.8053, g: 1.2576, b: 1.6478 },
  { logE: -0.9566, r: 0.8552, g: 1.3048, b: 1.6978 },
  { logE: -0.8777, r: 0.9053, g: 1.35, b: 1.75 },
  { logE: -0.7988, r: 0.9527, g: 1.3967, b: 1.8019 },
  { logE: -0.7199, r: 0.9991, g: 1.4425, b: 1.8534 },
  { logE: -0.641, r: 1.0425, g: 1.4898, b: 1.9071 },
  { logE: -0.5621, r: 1.0869, g: 1.5363, b: 1.9599 },
  { logE: -0.4833, r: 1.1296, g: 1.5822, b: 2.0152 },
  { logE: -0.4044, r: 1.1719, g: 1.6297, b: 2.0692 },
  { logE: -0.3255, r: 1.2142, g: 1.6743, b: 2.1219 },
  { logE: -0.2466, r: 1.258, g: 1.7168, b: 2.1753 },
  { logE: -0.1677, r: 1.3022, g: 1.7591, b: 2.2272 },
  { logE: -0.0888, r: 1.3488, g: 1.8014, b: 2.2799 },
  { logE: -0.0099, r: 1.3896, g: 1.8434, b: 2.33 },
  { logE: 0.069, r: 1.4302, g: 1.884, b: 2.3801 },
  { logE: 0.1479, r: 1.4709, g: 1.9247, b: 2.4275 },
  { logE: 0.2267, r: 1.5127, g: 1.9653, b: 2.475 },
  { logE: 0.3056, r: 1.5534, g: 2.0047, b: 2.5199 },
  { logE: 0.3845, r: 1.5941, g: 2.044, b: 2.5674 },
  { logE: 0.4634, r: 1.6343, g: 2.083, b: 2.6122 },
  { logE: 0.5423, r: 1.6728, g: 2.1214, b: 2.6572 },
  { logE: 0.6212, r: 1.7098, g: 2.1594, b: 2.7046 },
  { logE: 0.7001, r: 1.7463, g: 2.1962, b: 2.7521 },
  { logE: 0.779, r: 1.7795, g: 2.2342, b: 2.7999 },
  { logE: 0.8578, r: 1.8107, g: 2.271, b: 2.8496 },
  { logE: 0.9367, r: 1.8425, g: 2.308, b: 2.902 },
  { logE: 1.0156, r: 1.8744, g: 2.3451, b: 2.9569 },
  { logE: 1.0945, r: 1.9062, g: 2.3812, b: 3.0142 },
  { logE: 1.1734, r: 1.9329, g: 2.4114, b: 3.0655 },
];

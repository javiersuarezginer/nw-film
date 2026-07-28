/**
 * Curva característica del papel Kodak Professional Portra Endura
 * (el papel RA-4 que Kodak diseñó específicamente para imprimir Portra).
 *
 * Fuente: datasheet oficial Kodak, publicación E-4021 (rev. septiembre
 * 2008), gráfico "Characteristic Curves: KODAK PROFESSIONAL PORTRA
 * ENDURA Paper" (F002_1274AC). Condiciones: exposición 0.5 s, proceso
 * RA-4 (95°F/35°C, 45 s), densitometría Status A.
 *
 * Digitalizado por análisis de píxeles del PDF oficial, igual que la
 * curva de la película (ver characteristicCurveData.ts).
 *
 * DOS cosas a tener en cuenta, a diferencia de la curva de la película:
 *
 * 1. En el gráfico de Kodak, las tres curvas R/G/B del papel están casi
 *    superpuestas — solo se separan un poco en el hombro (~0.1 de
 *    densidad de diferencia). No hay señal suficiente para separarlas de
 *    forma fiable a partir de los píxeles del PDF, así que aquí se usa
 *    UNA sola curva compartida para los tres canales. Es una
 *    simplificación razonable dado lo poco que difieren en el dato real.
 *
 * 2. El eje X del gráfico de Kodak va de 3.0 a 0.0 (invertido) y
 *    corresponde a exposición a través de una cuña de pasos calibrada —
 *    en la práctica, equivale directamente a densidad del negativo que
 *    atenúa la luz de impresión. Aquí se ha transformado a `x = 3.0 -
 *    (valor del eje de Kodak)` para que crezca junto con la densidad
 *    resultante (mismo criterio que characteristicCurveData.ts), de modo
 *    que `x` se pueda alimentar directamente con la densidad del
 *    negativo (ver paperCurve.ts).
 */

export interface PaperCurvePoint {
  x: number;
  density: number;
}

export const PORTRA_ENDURA_SOURCE = {
  manufacturer: "Kodak",
  paper: "Kodak Professional Portra Endura",
  publication: "E-4021",
  revision: "September 2008",
  chart: "F002_1274AC — Characteristic Curves",
  exposure: "0.5 second",
  process: "RA-4, 95°F (35°C), 45 sec",
  densitometry: "Status A",
} as const;

export const portraEnduraPaperCurve: PaperCurvePoint[] = [
  { x: 0.0156, density: 0.0897 },
  { x: 0.0351, density: 0.0897 },
  { x: 0.0585, density: 0.0897 },
  { x: 0.0819, density: 0.0897 },
  { x: 0.1053, density: 0.0897 },
  { x: 0.1287, density: 0.0897 },
  { x: 0.1521, density: 0.0897 },
  { x: 0.1756, density: 0.0897 },
  { x: 0.199, density: 0.0897 },
  { x: 0.2224, density: 0.0897 },
  { x: 0.2458, density: 0.0897 },
  { x: 0.2692, density: 0.0897 },
  { x: 0.2926, density: 0.0897 },
  { x: 0.316, density: 0.0897 },
  { x: 0.3394, density: 0.0897 },
  { x: 0.3628, density: 0.0897 },
  { x: 0.3862, density: 0.0917 },
  { x: 0.4096, density: 0.0917 },
  { x: 0.433, density: 0.0917 },
  { x: 0.4564, density: 0.0917 },
  { x: 0.4798, density: 0.0917 },
  { x: 0.5033, density: 0.0917 },
  { x: 0.5267, density: 0.0917 },
  { x: 0.5501, density: 0.0936 },
  { x: 0.5735, density: 0.0936 },
  { x: 0.5969, density: 0.0936 },
  { x: 0.6203, density: 0.0956 },
  { x: 0.6437, density: 0.0975 },
  { x: 0.6671, density: 0.0975 },
  { x: 0.6905, density: 0.1014 },
  { x: 0.7139, density: 0.1014 },
  { x: 0.7373, density: 0.1053 },
  { x: 0.7607, density: 0.1092 },
  { x: 0.7841, density: 0.1131 },
  { x: 0.8075, density: 0.117 },
  { x: 0.8309, density: 0.1209 },
  { x: 0.8544, density: 0.1268 },
  { x: 0.8778, density: 0.1326 },
  { x: 0.9012, density: 0.1385 },
  { x: 0.9246, density: 0.1502 },
  { x: 0.948, density: 0.1599 },
  { x: 0.9714, density: 0.1697 },
  { x: 0.9948, density: 0.1834 },
  { x: 1.0182, density: 0.197 },
  { x: 1.0416, density: 0.2146 },
  { x: 1.065, density: 0.2321 },
  { x: 1.0884, density: 0.2497 },
  { x: 1.1118, density: 0.2711 },
  { x: 1.1352, density: 0.2945 },
  { x: 1.1586, density: 0.3199 },
  { x: 1.1821, density: 0.3472 },
  { x: 1.2055, density: 0.3765 },
  { x: 1.2289, density: 0.4116 },
  { x: 1.2523, density: 0.4486 },
  { x: 1.2757, density: 0.4896 },
  { x: 1.2991, density: 0.5325 },
  { x: 1.3225, density: 0.5793 },
  { x: 1.3459, density: 0.6281 },
  { x: 1.3693, density: 0.6788 },
  { x: 1.3927, density: 0.7334 },
  { x: 1.4161, density: 0.7939 },
  { x: 1.4395, density: 0.8544 },
  { x: 1.4629, density: 0.9187 },
  { x: 1.4863, density: 0.985 },
  { x: 1.5098, density: 1.0514 },
  { x: 1.5332, density: 1.1235 },
  { x: 1.5566, density: 1.1977 },
  { x: 1.58, density: 1.2737 },
  { x: 1.6034, density: 1.3498 },
  { x: 1.6268, density: 1.4259 },
  { x: 1.6502, density: 1.5059 },
  { x: 1.6736, density: 1.578 },
  { x: 1.697, density: 1.6502 },
  { x: 1.7204, density: 1.7243 },
  { x: 1.7438, density: 1.7965 },
  { x: 1.7672, density: 1.8667 },
  { x: 1.7906, density: 1.9286 },
  { x: 1.814, density: 1.9925 },
  { x: 1.8375, density: 2.0462 },
  { x: 1.8609, density: 2.0959 },
  { x: 1.8843, density: 2.1422 },
  { x: 1.9077, density: 2.1849 },
  { x: 1.9311, density: 2.2207 },
  { x: 1.9545, density: 2.2568 },
  { x: 1.9779, density: 2.2871 },
  { x: 2.0013, density: 2.3153 },
  { x: 2.0247, density: 2.3397 },
  { x: 2.0481, density: 2.3594 },
  { x: 2.0715, density: 2.3615 },
  { x: 2.0949, density: 2.3784 },
  { x: 2.1183, density: 2.394 },
  { x: 2.1417, density: 2.409 },
  { x: 2.1651, density: 2.42 },
  { x: 2.1886, density: 2.4317 },
  { x: 2.212, density: 2.4408 },
  { x: 2.2354, density: 2.4499 },
  { x: 2.2588, density: 2.4584 },
  { x: 2.2822, density: 2.4668 },
  { x: 2.3056, density: 2.4746 },
  { x: 2.329, density: 2.4798 },
  { x: 2.3524, density: 2.487 },
  { x: 2.3758, density: 2.487 },
  { x: 2.3992, density: 2.487 },
  { x: 2.4226, density: 2.487 },
  { x: 2.446, density: 2.487 },
  { x: 2.4694, density: 2.487 },
  { x: 2.4928, density: 2.4919 },
  { x: 2.5163, density: 2.4967 },
  { x: 2.5397, density: 2.5007 },
  { x: 2.5631, density: 2.5055 },
  { x: 2.5865, density: 2.5075 },
  { x: 2.6099, density: 2.5104 },
  { x: 2.6333, density: 2.5133 },
  { x: 2.6567, density: 2.5133 },
  { x: 2.6801, density: 2.5153 },
  { x: 2.7035, density: 2.5172 },
  { x: 2.7269, density: 2.5211 },
  { x: 2.7503, density: 2.5231 },
  { x: 2.7737, density: 2.525 },
  { x: 2.7971, density: 2.5289 },
  { x: 2.8205, density: 2.5309 },
  { x: 2.844, density: 2.5328 },
];

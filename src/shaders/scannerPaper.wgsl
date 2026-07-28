// Pass — Simulación de papel (Kodak Portra Endura, proceso RA-4).
//
// Esta es la etapa que por fin convierte densidad de negativo en imagen
// positiva de verdad, usando la curva característica REAL del papel
// (datasheet Kodak E-4021) en vez del placeholder de normalización
// lineal de las fases anteriores. Aquí es donde aparece el redondeo
// suave de las luces altas: el papel sí tiene un "hombro" real (a
// diferencia del negativo, que no lo tenía — ver characteristicCurveData.ts).
//
// Cómo se relacionan negativo y papel: en una ampliadora real, la luz de
// impresión atraviesa el negativo y su densidad la atenúa — así que la
// densidad del negativo hace exactamente el mismo papel que un escalón
// de una cuña de densidades calibrada (que es como Kodak mide esta curva
// de papel). Por eso la densidad del negativo se puede alimentar
// directamente como entrada de la curva del papel.
//
// Calibración de canal: cada capa de tinte del negativo tiene un rango
// de densidad distinto (ver dMin/dMax de characteristicCurve.ts), así
// que sin corrección un gris neutro de la escena saldría con dominante
// de color en el papel. `offsetR/G/B` alinean los tres canales en el
// punto de exposición de referencia (Log H Ref), igual que el filtro de
// la ampliadora real en un laboratorio.

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var out: VertexOut;
  let pos = positions[vertexIndex];
  out.position = vec4<f32>(pos, 0.0, 1.0);
  out.uv = vec2<f32>(pos.x * 0.5 + 0.5, 1.0 - (pos.y * 0.5 + 0.5));
  return out;
}

struct ScannerPaperParams {
  offsetR: f32,
  offsetG: f32,
  offsetB: f32,
  paperDomainMin: f32,
  paperDomainMax: f32,
  paperLutWidth: f32,
  paperDMin: f32,
  paperDMax: f32,
  saturation: f32,
  vibrance: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var densityTexture: texture_2d<f32>;
@group(0) @binding(1) var densitySampler: sampler;
@group(0) @binding(2) var paperLUT: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: ScannerPaperParams;

// Span del eje del gráfico de Kodak del papel (0.0 a 3.0) — ver
// paperCurveData.ts para por qué la densidad del negativo se resta de
// este valor antes de consultar la curva.
const PAPER_AXIS_SPAN: f32 = 3.0;

fn samplePaperCurve1D(x: f32) -> f32 {
  let t = clamp((x - params.paperDomainMin) / (params.paperDomainMax - params.paperDomainMin), 0.0, 1.0);
  let fx = t * (params.paperLutWidth - 1.0);
  let x0 = floor(fx);
  let x1 = min(x0 + 1.0, params.paperLutWidth - 1.0);
  let frac = fx - x0;
  let d0 = textureLoad(paperLUT, vec2<i32>(i32(x0), 0), 0).r;
  let d1 = textureLoad(paperLUT, vec2<i32>(i32(x1), 0), 0).r;
  return mix(d0, d1, frac);
}

fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let cutoff = c <= vec3<f32>(0.0031308);
  let higher = vec3<f32>(1.055) * pow(c, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  let lower = c * 12.92;
  return select(higher, lower, cutoff);
}

// Saturación/viveza — ajuste digital de la salida (como el retoque
// tradicional de un escáner o de la impresión, ya no física del propio
// negativo), aplicado en lineal sobre la imagen positiva ya revelada,
// justo antes de codificar a sRGB. La viveza refuerza más los colores
// que ya están poco saturados (protege pieles/tonos ya intensos) — misma
// idea que "Vibrance" en editores conocidos. No hay dato de datasheet
// para esto, es puro ajuste de herramienta de edición.
fn applySaturationVibrance(color: vec3<f32>, saturation: f32, vibrance: f32) -> vec3<f32> {
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let maxC = max(color.r, max(color.g, color.b));
  let minC = min(color.r, min(color.g, color.b));
  let currentSat = (maxC - minC) / max(maxC, 1e-4);
  let boost = saturation + vibrance * (1.0 - currentSat);
  return mix(vec3<f32>(luma), color, 1.0 + boost);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let negDensity = textureSample(densityTexture, densitySampler, in.uv);

  let calibR = negDensity.r + params.offsetR;
  let calibG = negDensity.g + params.offsetG;
  let calibB = negDensity.b + params.offsetB;

  let paperDr = samplePaperCurve1D(PAPER_AXIS_SPAN - calibR);
  let paperDg = samplePaperCurve1D(PAPER_AXIS_SPAN - calibG);
  let paperDb = samplePaperCurve1D(PAPER_AXIS_SPAN - calibB);

  // Única inversión real de todo el pipeline: más densidad de papel =
  // más tinta = zona más oscura del positivo. El negativo, por sí solo,
  // no necesitaba invertirse (ver characteristicCurve.wgsl).
  let span = params.paperDMax - params.paperDMin;
  let normR = 1.0 - clamp((paperDr - params.paperDMin) / span, 0.0, 1.0);
  let normG = 1.0 - clamp((paperDg - params.paperDMin) / span, 0.0, 1.0);
  let normB = 1.0 - clamp((paperDb - params.paperDMin) / span, 0.0, 1.0);

  let graded = applySaturationVibrance(vec3<f32>(normR, normG, normB), params.saturation, params.vibrance);

  return vec4<f32>(linearToSrgb(clamp(graded, vec3<f32>(0.0), vec3<f32>(1.0))), negDensity.a);
}

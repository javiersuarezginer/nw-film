// Pass — Grano dependiente de la densidad local (aproximación en tiempo
// real para preview).
//
// Esta es la aproximación GPU rápida, no el modelo rigoroso. El modelo
// riguroso de verdad (booleano de partículas, Newson/Delon/Galerne —
// ver CLAUDE.md) queda para una fase de exportación aparte, más costosa
// computacionalmente. Aun así, esta versión respeta las tres propiedades
// físicas que pide el proyecto:
//
//  (a) intensidad dependiente de la exposición local: máxima en medios
//      tonos, mínima en negros puros y blancos quemados — aquí con una
//      curva de visibilidad en forma de campana sobre la densidad real
//      que calculó la curva característica (no sobre luminancia
//      aproximada).
//  (b) tamaño distinto por capa de color — cada canal usa su propia
//      frecuencia de ruido.
//  (c) el ruido perturba la DENSIDAD (antes de convertirla en imagen
//      visible), no se pinta encima de la imagen final ya revelada —
//      así el grano queda sujeto al resto del pipeline (curva, halo...)
//      en vez de ser un filtro cosmético superpuesto al final.
//
// El tamaño de grano por canal y la amplitud son aproximaciones
// razonables (Kodak no publica un tamaño de grano por capa ni una curva
// de visibilidad exacta) — igual que con el halation, están marcadas
// como tal en vez de aparentar una precisión que no existe.

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

struct GrainParams {
  dMinR: f32,
  dMinG: f32,
  dMinB: f32,
  dMaxR: f32,
  dMaxG: f32,
  dMaxB: f32,
  sizeR: f32,
  sizeG: f32,
  sizeB: f32,
  intensity: f32,
  seed: f32,
  pad0: f32,
};

@group(0) @binding(0) var densityTexture: texture_2d<f32>;
@group(0) @binding(1) var densitySampler: sampler;
@group(0) @binding(2) var<uniform> params: GrainParams;

fn hash21(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = hash21(i);
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Campana que vale 0 en dMin y dMax, y máximo (1) en la densidad media.
fn grainVisibility(density: f32, dMin: f32, dMax: f32) -> f32 {
  let t = clamp((density - dMin) / (dMax - dMin), 0.0, 1.0);
  return 4.0 * t * (1.0 - t);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let density = textureSample(densityTexture, densitySampler, in.uv);
  let px = in.position.xy;

  let nR = valueNoise(px / params.sizeR + vec2<f32>(params.seed, 0.0)) * 2.0 - 1.0;
  let nG = valueNoise(px / params.sizeG + vec2<f32>(0.0, params.seed)) * 2.0 - 1.0;
  let nB = valueNoise(px / params.sizeB + vec2<f32>(params.seed, params.seed * 0.5)) * 2.0 - 1.0;

  let vR = grainVisibility(density.r, params.dMinR, params.dMaxR);
  let vG = grainVisibility(density.g, params.dMinG, params.dMaxG);
  let vB = grainVisibility(density.b, params.dMinB, params.dMaxB);

  let perturbation = vec3<f32>(nR * vR, nG * vG, nB * vB) * params.intensity;

  return vec4<f32>(density.rgb + perturbation, density.a);
}

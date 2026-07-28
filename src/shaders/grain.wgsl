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
//
// `densityRef` (segunda textura de entrada) es una versión de la
// densidad calculada ANTES del suavizado óptico (opticalSoftening.wgsl),
// solo para decidir CUÁNTO grano mostrar en cada zona (la campana de
// visibilidad). Sin esto, subir el suavizado óptico también apagaba el
// grano en las zonas con textura fina de la escena — el suavizado y el
// grano deben ser controles independientes para quien edita, aunque en
// la física real un objetivo más blando sí reduciría algo el grano
// visible. La perturbación de grano en sí se sigue sumando sobre la
// densidad real (`density`, ya suavizada) para que el resultado final
// respete el suavizado.

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
@group(0) @binding(2) var densityRefTexture: texture_2d<f32>;
@group(0) @binding(3) var densityRefSampler: sampler;
@group(0) @binding(4) var<uniform> params: GrainParams;

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

// El grano real no es una sola escala suave: hay agrupamiento de grano
// (clumping, varios granos de plata juntos) MÁS una textura fina a nivel
// de píxel — de ahí el aspecto "arenoso", no de nube difusa. `valueNoise`
// por sí solo (interpolado, suave) da el clumping pero se ve demasiado
// "blobby"; se le suma una capa de ruido crudo sin interpolar para la
// textura fina, con un tamaño proporcional al del agrupamiento (no fijo)
// para que el slider "Tamaño de grano" escale las dos capas juntas y el
// grano no pierda su textura interna al agrandarlo. Proporción ajustada a
// ojo comparando contra un crop real de Portra 400 (ver
// docs/reference/portra400-grain-reference.jpg) — no es un dato de
// datasheet, igual que el resto de constantes de grano.
const GRIT_SIZE_RATIO: f32 = 0.16;
const GRIT_SIZE_MIN_PX: f32 = 1.0;
const FINE_GRIT_WEIGHT: f32 = 0.35;
const CLUMP_WEIGHT: f32 = 0.65;

fn grainNoise(px: vec2<f32>, clumpSize: f32, offset: vec2<f32>) -> f32 {
  let gritSize = max(GRIT_SIZE_MIN_PX, clumpSize * GRIT_SIZE_RATIO);
  let clump = valueNoise(px / clumpSize + offset) * 2.0 - 1.0;
  let grit = hash21(floor(px / gritSize) + offset * 7.0) * 2.0 - 1.0;
  return clump * CLUMP_WEIGHT + grit * FINE_GRIT_WEIGHT;
}

// Campana que vale 0 en dMin y dMax, y máximo (1) en la densidad media.
fn grainVisibility(density: f32, dMin: f32, dMax: f32) -> f32 {
  let t = clamp((density - dMin) / (dMax - dMin), 0.0, 1.0);
  return 4.0 * t * (1.0 - t);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let density = textureSample(densityTexture, densitySampler, in.uv);
  let densityRef = textureSample(densityRefTexture, densityRefSampler, in.uv);
  let px = in.position.xy;

  let nR = grainNoise(px, params.sizeR, vec2<f32>(params.seed, 0.0));
  let nG = grainNoise(px, params.sizeG, vec2<f32>(0.0, params.seed));
  let nB = grainNoise(px, params.sizeB, vec2<f32>(params.seed, params.seed * 0.5));

  let vR = grainVisibility(densityRef.r, params.dMinR, params.dMaxR);
  let vG = grainVisibility(densityRef.g, params.dMinG, params.dMaxG);
  let vB = grainVisibility(densityRef.b, params.dMinB, params.dMaxB);

  let perturbation = vec3<f32>(nR * vR, nG * vG, nB * vB) * params.intensity;

  return vec4<f32>(density.rgb + perturbation, density.a);
}

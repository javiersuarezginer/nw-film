// Pass — Balance de blanco y zonas tonales (temperatura, matiz, luces,
// sombras, blancos, negros).
//
// A diferencia de la curva característica (química fija del negativo),
// esto representa decisiones que un fotógrafo tomaría ANTES de que la
// luz llegue a la película: un filtro de color delante del objetivo, o
// la iluminación de la escena. Por eso vive en lineal, justo después de
// decodeLinear y antes del halation — nada de lo que viene después dejó
// de ser física real de la película.
//
// Las constantes de fuerza (TEMP/TINT/ZONE) son aproximaciones
// razonables de herramienta de edición, no datos de datasheet — igual
// que ya se documenta honestamente en halationSource.wgsl y grain.wgsl.

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

struct SceneGradeParams {
  middleGray: f32,
  temperature: f32, // -1..1, +cálido (más rojo/menos azul)
  tint: f32,        // -1..1, +magenta (menos verde)
  highlights: f32,  // -1..1
  shadows: f32,     // -1..1
  whites: f32,      // -1..1
  blacks: f32,      // -1..1
  reserved: f32,
};

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: SceneGradeParams;

const TEMP_STRENGTH: f32 = 0.3;
const TINT_STRENGTH: f32 = 0.3;

// Luces/sombras: máscara ancha centrada por encima/debajo del gris medio.
const BROAD_ZONE_STOPS: f32 = 1.0;
// Blancos/negros: máscara estrecha, solo la punta de la curva.
const EXTREME_ZONE_LOW: f32 = 1.5;
const EXTREME_ZONE_HIGH: f32 = 3.0;

const BROAD_SCALE: f32 = 1.2;
const EXTREME_SCALE: f32 = 1.5;

fn applyZones(stops: f32) -> f32 {
  let shadowMask = 1.0 - smoothstep(-BROAD_ZONE_STOPS, BROAD_ZONE_STOPS, stops);
  let highlightMask = smoothstep(-BROAD_ZONE_STOPS, BROAD_ZONE_STOPS, stops);
  let blackMask = 1.0 - smoothstep(-EXTREME_ZONE_HIGH, -EXTREME_ZONE_LOW, stops);
  let whiteMask = smoothstep(EXTREME_ZONE_LOW, EXTREME_ZONE_HIGH, stops);

  let offset =
    params.shadows * shadowMask * BROAD_SCALE +
    params.highlights * highlightMask * BROAD_SCALE +
    params.blacks * blackMask * EXTREME_SCALE +
    params.whites * whiteMask * EXTREME_SCALE;

  return stops + offset;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let scene = textureSample(inputTexture, inputSampler, in.uv);

  let wbGain = vec3<f32>(
    1.0 + params.temperature * TEMP_STRENGTH,
    1.0 - params.tint * TINT_STRENGTH,
    1.0 - params.temperature * TEMP_STRENGTH
  );
  let balanced = scene.rgb * wbGain;

  let eps = 1e-6;
  let mg = params.middleGray;
  let stopsR = log2(max(balanced.r, eps) / mg);
  let stopsG = log2(max(balanced.g, eps) / mg);
  let stopsB = log2(max(balanced.b, eps) / mg);

  let outR = mg * exp2(applyZones(stopsR));
  let outG = mg * exp2(applyZones(stopsG));
  let outB = mg * exp2(applyZones(stopsB));

  return vec4<f32>(outR, outG, outB, scene.a);
}

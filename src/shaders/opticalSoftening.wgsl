// Pass — Suavizado óptico (límite de resolución del sistema objetivo +
// película).
//
// Ningún sistema fotográfico real resuelve detalle infinitamente fino: el
// objetivo y la propia emulsión tienen una frecuencia de corte (MTF) por
// encima de la cual el detalle simplemente no se registra. Las imágenes
// de IA, en cambio, no vienen de una óptica real y a menudo traen
// microtextura sintética más nítida que cualquier captura física — el
// aspecto "plástico"/"crispy" que se nota al compararlas con una foto de
// verdad. Esta etapa aplica una mezcla suave entre la imagen y una
// versión ligeramente difuminada de sí misma, ANTES del halation y de
// cualquier química de la película, representando ese límite óptico.
//
// No confundir con la acutancia (acutance.wgsl): aquella es un realce de
// borde químico que ocurre DESPUÉS de la curva característica; esto es
// justo lo contrario, un límite de resolución que ocurre ANTES, en la luz
// que entra al sistema. El radio y la fuerza son una aproximación
// razonable de herramienta de edición — no hay una cifra de MTF real de
// ninguna combinación concreta de objetivo+Portra 400 que digitalizar,
// igual que con el halation.

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

struct SofteningParams {
  amount: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var baseTexture: texture_2d<f32>;
@group(0) @binding(1) var baseSampler: sampler;
@group(0) @binding(2) var blurredTexture: texture_2d<f32>;
@group(0) @binding(3) var blurredSampler: sampler;
@group(0) @binding(4) var<uniform> params: SofteningParams;

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let base = textureSample(baseTexture, baseSampler, in.uv);
  let blurred = textureSample(blurredTexture, blurredSampler, in.uv);

  let softened = mix(base.rgb, blurred.rgb, clamp(params.amount, 0.0, 1.0));

  return vec4<f32>(softened, base.a);
}

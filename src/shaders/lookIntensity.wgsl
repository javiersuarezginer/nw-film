// Pass — Intensidad del look: mezcla el resultado ya revelado (curva,
// halation, grano, papel...) con la foto original tal cual se cargó, como
// un fundido de opacidad clásico de editor (0% = foto original sin tocar,
// 100% = el look completo). Es el último paso antes de mostrar en
// pantalla — mezcla en el mismo espacio ya codificado para display en el
// que están las dos entradas, no reintroduce ninguna física de la
// película (eso ya ocurrió en las etapas anteriores).

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

struct LookIntensityParams {
  amount: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var originalSampler: sampler;
@group(0) @binding(2) var processedTexture: texture_2d<f32>;
@group(0) @binding(3) var processedSampler: sampler;
@group(0) @binding(4) var<uniform> params: LookIntensityParams;

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let original = textureSample(originalTexture, originalSampler, in.uv);
  let processed = textureSample(processedTexture, processedSampler, in.uv);

  let blended = mix(original.rgb, processed.rgb, clamp(params.amount, 0.0, 1.0));

  return vec4<f32>(blended, processed.a);
}

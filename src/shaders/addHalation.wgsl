// Pass — Combina la escena lineal base con el halo de halation ya
// difuminado (suma aditiva, como la luz extra que reexpone la película).
// Se hace ANTES de la curva característica: así el halo también queda
// sujeto a la respuesta de la película, en vez de pintarse encima como
// un efecto cosmético.

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

@group(0) @binding(0) var baseTexture: texture_2d<f32>;
@group(0) @binding(1) var baseSampler: sampler;
@group(0) @binding(2) var glowTexture: texture_2d<f32>;
@group(0) @binding(3) var glowSampler: sampler;

struct HalationParams {
  intensity: f32,
};

// Intensidad artística del halo — no viene de un datasheet (ver
// halationSource.wgsl). Controlada por el slider de la interfaz.
@group(0) @binding(4) var<uniform> params: HalationParams;

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let base = textureSample(baseTexture, baseSampler, in.uv);
  let glow = textureSample(glowTexture, glowSampler, in.uv);
  return vec4<f32>(base.rgb + glow.rgb * params.intensity, base.a);
}

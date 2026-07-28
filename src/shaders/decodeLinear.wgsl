// Pass 1 — sRGB (display-referred) → lineal (scene-referred).
// Punto de entrada del pipeline físico: todo lo que viene después
// (curva característica, halation, grano...) opera sobre esta salida.

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

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

fn srgbToLinear(c: vec3<f32>) -> vec3<f32> {
  let cutoff = c <= vec3<f32>(0.04045);
  let higher = pow((c + vec3<f32>(0.055)) / vec3<f32>(1.055), vec3<f32>(2.4));
  let lower = c / vec3<f32>(12.92);
  return select(higher, lower, cutoff);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let display = textureSample(inputTexture, inputSampler, in.uv);
  let scene = srgbToLinear(display.rgb);
  return vec4<f32>(scene, display.a);
}

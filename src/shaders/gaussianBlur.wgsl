// Pass — Blur gaussiano separable de un único eje (horizontal o vertical,
// según los parámetros). El halation usa dos instancias de este mismo
// shader encadenadas (horizontal → vertical) para conseguir un blur 2D
// grande sin el coste de un kernel 2D completo.

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

struct BlurParams {
  dirX: f32,
  dirY: f32,
  texelW: f32,
  texelH: f32,
  radiusPx: f32,
  sigma: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: BlurParams;

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let dir = vec2<f32>(params.dirX, params.dirY);
  let texel = vec2<f32>(params.texelW, params.texelH);
  let radius = i32(params.radiusPx);

  var sum = vec3<f32>(0.0);
  var weightSum = 0.0;

  for (var i = -radius; i <= radius; i = i + 1) {
    let fi = f32(i);
    let w = exp(-(fi * fi) / (2.0 * params.sigma * params.sigma));
    let sampleUv = in.uv + dir * texel * fi;
    sum = sum + textureSample(inputTexture, inputSampler, sampleUv).rgb * w;
    weightSum = weightSum + w;
  }

  return vec4<f32>(sum / weightSum, 1.0);
}

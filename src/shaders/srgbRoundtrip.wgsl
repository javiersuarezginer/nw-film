// Pass 1 — sRGB (display-referred) → lineal (scene-referred) → sRGB
//
// Fase 1 solo valida el viaje de ida y vuelta: decodificar a lineal y
// volver a codificar sin tocar nada en medio. El resultado debe ser
// visualmente idéntico al original. Las fases siguientes insertarán
// aquí las operaciones físicas (halation, curva característica, grano...)
// que sí necesitan operar en espacio lineal.

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  // Triángulo a pantalla completa, sin buffer de vértices.
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var out: VertexOut;
  let pos = positions[vertexIndex];
  out.position = vec4<f32>(pos, 0.0, 1.0);
  // UV con origen arriba-izquierda, acorde al espacio de textura.
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

fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let cutoff = c <= vec3<f32>(0.0031308);
  let higher = vec3<f32>(1.055) * pow(c, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  let lower = c * 12.92;
  return select(higher, lower, cutoff);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let display = textureSample(inputTexture, inputSampler, in.uv);
  let scene = srgbToLinear(display.rgb);

  // --- aquí se insertarán los passes físicos en fases futuras ---

  let out = linearToSrgb(scene);
  return vec4<f32>(out, display.a);
}

// Pass — Extracción de altas luces para halation.
//
// El halation ocurre cuando la luz de las zonas muy brillantes atraviesa
// la emulsión, rebota en la base de la película (o en la placa de
// presión) y vuelve a exponer la película desde atrás, formando un halo
// rojo-anaranjado alrededor de esas luces. Aquí se aísla esa luz: solo
// las zonas por encima de un umbral contribuyen, con una transición
// suave (sin recorte duro) para que el halo no tenga un borde artificial.
//
// El umbral y el tinte son una aproximación razonable, no vienen de un
// datasheet — Kodak no publica una curva espectral de la base
// anti-halo. Se documenta así de honesto en vez de aparentar precisión
// que no existe.

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

const THRESHOLD: f32 = 0.7;
const TINT = vec3<f32>(1.0, 0.35, 0.12);

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let scene = textureSample(inputTexture, inputSampler, in.uv).rgb;
  let luminance = dot(scene, vec3<f32>(0.2126, 0.7152, 0.0722));
  let strength = smoothstep(THRESHOLD, 1.0, luminance);
  return vec4<f32>(TINT * strength, 1.0);
}

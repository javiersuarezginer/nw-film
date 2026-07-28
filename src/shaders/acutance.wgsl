// Pass — Difusión inter-capa / acutancia (efecto de borde).
//
// Durante el revelado químico real, el revelador se agota localmente
// donde hay más densidad (más plata/tinte formándose). En el límite
// entre una zona clara y una oscura, esto crea una fina franja de MENOS
// densidad justo dentro de la zona oscura y otra de MÁS densidad justo
// dentro de la clara — un realce de borde que ocurre por química, no por
// óptica (efecto Eberhard/Kostinsky, bien documentado en fotografía
// analógica). Es justo lo que hace que el grano en cristal parezca más
// "nítido" que el grano digital, incluso a la misma resolución.
//
// Se modela restando de la densidad una versión suavizada de sí misma
// (igual matemática que un unsharp mask, pero aplicada en el dominio de
// densidad, canal a canal, sobre un radio muy pequeño — el que
// correspondería a la distancia de difusión del revelador entre capas,
// no a un radio de "nitidez" arbitrario). El radio y la cantidad son una
// aproximación razonable — Kodak no publica una cifra de difusión
// interlayer exacta, igual que con el halation y el grano.

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

struct AcutanceParams {
  amount: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var baseTexture: texture_2d<f32>;
@group(0) @binding(1) var baseSampler: sampler;
@group(0) @binding(2) var blurredTexture: texture_2d<f32>;
@group(0) @binding(3) var blurredSampler: sampler;
@group(0) @binding(4) var<uniform> params: AcutanceParams;

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let base = textureSample(baseTexture, baseSampler, in.uv);
  let blurred = textureSample(blurredTexture, blurredSampler, in.uv);

  let edge = base.rgb - blurred.rgb;
  let sharpened = base.rgb + edge * params.amount;

  return vec4<f32>(sharpened, base.a);
}

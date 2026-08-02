// Pass — Curva característica H&D de la película activa, por canal.
//
// Convierte la luz de la escena (lineal) en densidad de cada capa de
// emulsión, usando la curva real digitalizada del datasheet del
// fabricante (Kodak o Fujifilm — ver color-science/films/registry.ts). La
// LUT (`curveLUT`) se recarga al cambiar de película en el desplegable;
// este shader no sabe ni le importa cuál está activa. El control de
// exposición desplaza el log-exposure antes de consultar la curva, tal y
// como sub/sobreexponer desplaza el punto de trabajo sobre la curva
// característica real.
//
// Este pass SOLO produce densidad — no la convierte todavía en imagen
// visible. Eso es a propósito: el grano (pass siguiente) necesita la
// densidad real para saber cuánto grano mostrar en cada zona, y tiene
// que perturbarla ANTES de que se convierta en una vista previa. La
// conversión a imagen visible pasa a `scannerPaper.wgsl`.

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

struct CurveParams {
  domainMin: f32,
  domainMax: f32,
  lutWidth: f32,
  logHRef: f32,
  middleGray: f32,
  exposureStops: f32,
  dMinR: f32,
  dMinG: f32,
  dMinB: f32,
  dMaxR: f32,
  dMaxG: f32,
  dMaxB: f32,
};

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var curveLUT: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: CurveParams;

const LOG10_E: f32 = 0.4342944819; // 1 / ln(10)
const LOG10_2: f32 = 0.3010299957;

fn log10_(x: f32) -> f32 {
  return log(x) * LOG10_E;
}

fn sampleCurve1D(logE: f32) -> vec3<f32> {
  let t = clamp((logE - params.domainMin) / (params.domainMax - params.domainMin), 0.0, 1.0);
  let fx = t * (params.lutWidth - 1.0);
  let x0 = floor(fx);
  let x1 = min(x0 + 1.0, params.lutWidth - 1.0);
  let frac = fx - x0;
  let c0 = textureLoad(curveLUT, vec2<i32>(i32(x0), 0), 0).rgb;
  let c1 = textureLoad(curveLUT, vec2<i32>(i32(x1), 0), 0).rgb;
  return mix(c0, c1, frac);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let scene = textureSample(inputTexture, inputSampler, in.uv);

  let exposureShift = params.exposureStops * LOG10_2;

  let logE_r = log10_(max(scene.r, 1e-6) / params.middleGray) + params.logHRef + exposureShift;
  let logE_g = log10_(max(scene.g, 1e-6) / params.middleGray) + params.logHRef + exposureShift;
  let logE_b = log10_(max(scene.b, 1e-6) / params.middleGray) + params.logHRef + exposureShift;

  let dR = sampleCurve1D(logE_r).r;
  let dG = sampleCurve1D(logE_g).g;
  let dB = sampleCurve1D(logE_b).b;

  return vec4<f32>(dR, dG, dB, scene.a);
}

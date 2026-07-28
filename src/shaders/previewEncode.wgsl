// Pass — Convierte densidad (negativo) en una vista previa positiva.
//
// Placeholder temporal (igual que en la Fase 2): normaliza linealmente
// la densidad entre el mínimo y el máximo medidos, y codifica a sRGB
// para mostrarlo en pantalla. NO es la simulación real de papel/escáner
// (esa llega en una fase posterior) — por eso las luces altas no
// redondean todavía aquí. Ver characteristicCurveData.ts.

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

struct PreviewParams {
  dMinR: f32,
  dMinG: f32,
  dMinB: f32,
  dMaxR: f32,
  dMaxG: f32,
  dMaxB: f32,
  saturation: f32,
  vibrance: f32,
};

@group(0) @binding(0) var densityTexture: texture_2d<f32>;
@group(0) @binding(1) var densitySampler: sampler;
@group(0) @binding(2) var<uniform> params: PreviewParams;

fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let cutoff = c <= vec3<f32>(0.0031308);
  let higher = vec3<f32>(1.055) * pow(c, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
  let lower = c * 12.92;
  return select(higher, lower, cutoff);
}

// Ver scannerPaper.wgsl — misma lógica de saturación/viveza, duplicada
// porque cada etapa final codifica su propio sRGB por separado.
fn applySaturationVibrance(color: vec3<f32>, saturation: f32, vibrance: f32) -> vec3<f32> {
  let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let maxC = max(color.r, max(color.g, color.b));
  let minC = min(color.r, min(color.g, color.b));
  let currentSat = (maxC - minC) / max(maxC, 1e-4);
  let boost = saturation + vibrance * (1.0 - currentSat);
  return mix(vec3<f32>(luma), color, 1.0 + boost);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let density = textureSample(densityTexture, densitySampler, in.uv);

  let previewR = (density.r - params.dMinR) / (params.dMaxR - params.dMinR);
  let previewG = (density.g - params.dMinG) / (params.dMaxG - params.dMinG);
  let previewB = (density.b - params.dMinB) / (params.dMaxB - params.dMinB);
  let preview = clamp(vec3<f32>(previewR, previewG, previewB), vec3<f32>(0.0), vec3<f32>(1.0));

  let graded = applySaturationVibrance(preview, params.saturation, params.vibrance);

  return vec4<f32>(linearToSrgb(clamp(graded, vec3<f32>(0.0), vec3<f32>(1.0))), density.a);
}

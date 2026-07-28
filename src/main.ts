import "./style.css";
import { initWebGPU } from "./webgpu/context";
import { createLUTTexture, createTextureFromBitmap } from "./webgpu/texture";
import { Pipeline } from "./webgpu/pipeline";
import { FullscreenPass } from "./webgpu/passes/FullscreenPass";
import { CompositePass } from "./webgpu/passes/CompositePass";
import type { Pass } from "./webgpu/passes/Pass";
import decodeLinearShader from "./shaders/decodeLinear.wgsl?raw";
import sceneGradeShader from "./shaders/sceneGrade.wgsl?raw";
import halationSourceShader from "./shaders/halationSource.wgsl?raw";
import gaussianBlurShader from "./shaders/gaussianBlur.wgsl?raw";
import addHalationShader from "./shaders/addHalation.wgsl?raw";
import characteristicCurveShader from "./shaders/characteristicCurve.wgsl?raw";
import grainShader from "./shaders/grain.wgsl?raw";
import acutanceShader from "./shaders/acutance.wgsl?raw";
import previewEncodeShader from "./shaders/previewEncode.wgsl?raw";
import scannerPaperShader from "./shaders/scannerPaper.wgsl?raw";
import { buildCurveLUT, sampleDensity, PORTRA_400_SOURCE, type CurveLUT } from "./color-science/portra400/characteristicCurve";
import { buildPaperLUT, PAPER_DENSITY_MIN, PAPER_DENSITY_MAX } from "./color-science/portraEndura/paperCurve";
import type { RigorousRenderParams } from "./render/rigorousRender";
import type { WorkerResponse } from "./render/rigorousRender.worker";

const MIDDLE_GRAY = 0.18;
const CURVE_PARAMS_FLOATS = 12; // debe coincidir con el struct CurveParams del shader
const BLUR_PARAMS_FLOATS = 8; // debe coincidir con el struct BlurParams del shader
const PREVIEW_PARAMS_FLOATS = 8; // debe coincidir con el struct PreviewParams del shader
const GRAIN_PARAMS_FLOATS = 12; // debe coincidir con el struct GrainParams del shader
const SCANNER_PAPER_PARAMS_FLOATS = 8; // debe coincidir con el struct ScannerPaperParams del shader
const ACUTANCE_PARAMS_FLOATS = 4; // debe coincidir con el struct AcutanceParams del shader
const SCENE_GRADE_PARAMS_FLOATS = 8; // debe coincidir con el struct SceneGradeParams del shader

const ZOOM_MIN_PERCENT = 10;
const ZOOM_MAX_PERCENT = 500;

// El halo de halation se dimensiona como fracción del ancho de la imagen
// (no hay un valor "real" de datasheet para esto — ver halationSource.wgsl).
const HALATION_RADIUS_FRACTION = 0.035;
const HALATION_RADIUS_MIN_PX = 6;
const HALATION_RADIUS_MAX_PX = 200;

// Tamaño de grano por canal, como fracción del ancho de imagen —
// aproximación razonable, no dato de datasheet (ver grain.wgsl).
const GRAIN_SIZE_FRACTION = { r: 0.0022, g: 0.0018, b: 0.0028 };
const GRAIN_SIZE_MIN_PX = 1.2;
const GRAIN_BASE_INTENSITY = 0.045; // amplitud en unidades de densidad, a intensidad ×1
const GRAIN_SEED = 17.0; // fijo: mismo grano siempre para la misma imagen (determinismo)

// Radio de difusión inter-capa, mucho más pequeño que el del halation —
// aproximación razonable, no dato de datasheet (ver acutance.wgsl).
const ACUTANCE_RADIUS_FRACTION = 0.0018;
const ACUTANCE_RADIUS_MIN_PX = 1.5;
const ACUTANCE_RADIUS_MAX_PX = 6;
const ACUTANCE_BASE_AMOUNT = 0.5; // a intensidad ×1

// Muestras Monte Carlo por píxel del render riguroso — compromiso entre
// ruido de muestreo y tiempo de cálculo en un solo Web Worker. Con pocas
// muestras el resultado se ve "a bloques" (solo hay N+1 niveles de gris
// posibles); hacen falta bastantes para que la textura de grano sea
// suave en vez de un mosaico de parches saturados.
const RIGOROUS_SAMPLES_PER_PIXEL = 32;

const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const editor = document.querySelector<HTMLDivElement>("#editor")!;
const statusEl = document.querySelector<HTMLSpanElement>("#status")!;
const originalCanvas = document.querySelector<HTMLCanvasElement>("#canvas-original")!;
const processedCanvas = document.querySelector<HTMLCanvasElement>("#canvas-processed")!;
const renderedCanvas = document.querySelector<HTMLCanvasElement>("#canvas-rendered")!;
const canvasStack = document.querySelector<HTMLDivElement>(".canvas-stack")!;
const viewportFrame = document.querySelector<HTMLDivElement>("#viewport-frame")!;

const temperatureSlider = document.querySelector<HTMLInputElement>("#temperature-slider")!;
const temperatureValueLabel = document.querySelector<HTMLSpanElement>("#temperature-value")!;
const tintSlider = document.querySelector<HTMLInputElement>("#tint-slider")!;
const tintValueLabel = document.querySelector<HTMLSpanElement>("#tint-value")!;
const exposureSlider = document.querySelector<HTMLInputElement>("#exposure-slider")!;
const exposureValueLabel = document.querySelector<HTMLSpanElement>("#exposure-value")!;
const highlightsSlider = document.querySelector<HTMLInputElement>("#highlights-slider")!;
const highlightsValueLabel = document.querySelector<HTMLSpanElement>("#highlights-value")!;
const shadowsSlider = document.querySelector<HTMLInputElement>("#shadows-slider")!;
const shadowsValueLabel = document.querySelector<HTMLSpanElement>("#shadows-value")!;
const whitesSlider = document.querySelector<HTMLInputElement>("#whites-slider")!;
const whitesValueLabel = document.querySelector<HTMLSpanElement>("#whites-value")!;
const blacksSlider = document.querySelector<HTMLInputElement>("#blacks-slider")!;
const blacksValueLabel = document.querySelector<HTMLSpanElement>("#blacks-value")!;
const grainSlider = document.querySelector<HTMLInputElement>("#grain-slider")!;
const grainValueLabel = document.querySelector<HTMLSpanElement>("#grain-value")!;
const acutanceSlider = document.querySelector<HTMLInputElement>("#acutance-slider")!;
const acutanceValueLabel = document.querySelector<HTMLSpanElement>("#acutance-value")!;
const paperToggle = document.querySelector<HTMLInputElement>("#paper-toggle")!;

const renderButton = document.querySelector<HTMLButtonElement>("#render-button")!;
const renderProgress = document.querySelector<HTMLDivElement>("#render-progress")!;
const renderProgressFill = document.querySelector<HTMLDivElement>("#render-progress-fill")!;
const renderProgressText = document.querySelector<HTMLSpanElement>("#render-progress-text")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download-button")!;

const abToggleButton = document.querySelector<HTMLButtonElement>("#ab-toggle")!;
const zoomSlider = document.querySelector<HTMLInputElement>("#zoom-slider")!;
const zoomValueLabel = document.querySelector<HTMLSpanElement>("#zoom-value")!;
const fitButton = document.querySelector<HTMLButtonElement>("#fit-button")!;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function computeGrainSizePx(width: number): { r: number; g: number; b: number } {
  return {
    r: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.r),
    g: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.g),
    b: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.b),
  };
}

function computeAcutanceRadiusPx(width: number): number {
  return Math.min(ACUTANCE_RADIUS_MAX_PX, Math.max(ACUTANCE_RADIUS_MIN_PX, width * ACUTANCE_RADIUS_FRACTION));
}

interface AppState {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: Pipeline;
  lut: CurveLUT;
  sceneGradeParamsBuffer: GPUBuffer;
  exposureUniformBuffer: GPUBuffer;
  blurHBuffer: GPUBuffer;
  blurVBuffer: GPUBuffer;
  grainUniformBuffer: GPUBuffer;
  acutanceBlurHBuffer: GPUBuffer;
  acutanceBlurVBuffer: GPUBuffer;
  acutanceParamsBuffer: GPUBuffer;
  previewEncodePass: Pass;
  scannerPaperPass: Pass;
  paperOffsets: { r: number; g: number; b: number };
  sourceTexture: GPUTexture | null;
  imageWidth: number;
  imageHeight: number;
  renderWorker: Worker | null;
  renderGeneration: number;
  mode: "preview" | "rendering" | "rendered";
}

let app: AppState | null = null;

// --- Estado de zoom/arrastre/comparación A-B (solo interfaz, no motor) ---
let zoomPercent = 100;
let panX = 0;
let panY = 0;
let showOriginal = false;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

function applyCanvasTransform(): void {
  canvasStack.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomPercent / 100})`;
}

function setZoomPercent(percent: number): void {
  zoomPercent = Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, percent));
  zoomSlider.value = String(Math.round(zoomPercent));
  zoomValueLabel.textContent = String(Math.round(zoomPercent));
  applyCanvasTransform();
}

function fitToViewport(): void {
  if (!app || app.imageWidth === 0) return;
  const frameRect = viewportFrame.getBoundingClientRect();
  const fitScale = Math.min(frameRect.width / app.imageWidth, frameRect.height / app.imageHeight);
  panX = 0;
  panY = 0;
  setZoomPercent(fitScale * 100);
}

function updateVisibleLayer(): void {
  const showRendered = !showOriginal && app?.mode === "rendered";
  originalCanvas.hidden = !showOriginal;
  renderedCanvas.hidden = !showRendered;
  processedCanvas.hidden = showOriginal || showRendered;
  abToggleButton.textContent = showOriginal ? "Ver editada" : "Ver original";
  abToggleButton.classList.toggle("active", showOriginal);
}

async function ensureApp(): Promise<AppState> {
  if (app) return app;

  const { device, context, format } = await initWebGPU(processedCanvas);

  const lut = buildCurveLUT(512, 3.0);
  const lutTexture = createLUTTexture(device, lut.data, lut.width);

  const curveParams = new Float32Array(CURVE_PARAMS_FLOATS);
  curveParams.set([
    lut.domainMin,
    lut.domainMax,
    lut.width,
    PORTRA_400_SOURCE.logHRef,
    MIDDLE_GRAY,
    0.0, // exposureStops, se actualiza con el slider
    lut.dMin.r,
    lut.dMin.g,
    lut.dMin.b,
    lut.dMax.r,
    lut.dMax.g,
    lut.dMax.b,
  ]);

  const exposureUniformBuffer = device.createBuffer({
    label: "curve-params",
    size: curveParams.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(exposureUniformBuffer, 0, curveParams);

  const sceneGradeParamsBuffer = device.createBuffer({
    label: "scene-grade-params",
    size: SCENE_GRADE_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // middleGray no cambia; el resto (temperatura, matiz, luces, sombras,
  // blancos, negros) arrancan a 0 y se actualizan con los sliders.
  device.queue.writeBuffer(sceneGradeParamsBuffer, 0, new Float32Array([MIDDLE_GRAY, 0, 0, 0, 0, 0, 0, 0]));

  const blurHBuffer = device.createBuffer({
    label: "blur-h-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const blurVBuffer = device.createBuffer({
    label: "blur-v-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const previewParams = new Float32Array(PREVIEW_PARAMS_FLOATS);
  previewParams.set([lut.dMin.r, lut.dMin.g, lut.dMin.b, lut.dMax.r, lut.dMax.g, lut.dMax.b, 0, 0]);
  const previewUniformBuffer = device.createBuffer({
    label: "preview-params",
    size: previewParams.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(previewUniformBuffer, 0, previewParams);

  const grainUniformBuffer = device.createBuffer({
    label: "grain-params",
    size: GRAIN_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // dMin/dMax no cambian con el tamaño de imagen: se escriben una vez aquí.
  device.queue.writeBuffer(
    grainUniformBuffer,
    0,
    new Float32Array([lut.dMin.r, lut.dMin.g, lut.dMin.b, lut.dMax.r, lut.dMax.g, lut.dMax.b])
  );

  const acutanceBlurHBuffer = device.createBuffer({
    label: "acutance-blur-h-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const acutanceBlurVBuffer = device.createBuffer({
    label: "acutance-blur-v-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const acutanceParamsBuffer = device.createBuffer({
    label: "acutance-params",
    size: ACUTANCE_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // --- Simulación de papel (Kodak Portra Endura) ---
  const paperLut = buildPaperLUT(512, 1.5);
  const paperLutTexture = createLUTTexture(device, paperLut.data, paperLut.width);

  // Alinea los tres canales en el punto de exposición de referencia,
  // igual que el filtro de la ampliadora en un laboratorio real (ver
  // scannerPaper.wgsl).
  const refDensity = {
    r: sampleDensity("r", PORTRA_400_SOURCE.logHRef),
    g: sampleDensity("g", PORTRA_400_SOURCE.logHRef),
    b: sampleDensity("b", PORTRA_400_SOURCE.logHRef),
  };
  const commonTarget = (refDensity.r + refDensity.g + refDensity.b) / 3;
  const paperOffsets = {
    r: commonTarget - refDensity.r,
    g: commonTarget - refDensity.g,
    b: commonTarget - refDensity.b,
  };

  const scannerPaperParams = new Float32Array(SCANNER_PAPER_PARAMS_FLOATS);
  scannerPaperParams.set([
    paperOffsets.r,
    paperOffsets.g,
    paperOffsets.b,
    paperLut.domainMin,
    paperLut.domainMax,
    paperLut.width,
    PAPER_DENSITY_MIN,
    PAPER_DENSITY_MAX,
  ]);
  const scannerPaperUniformBuffer = device.createBuffer({
    label: "scanner-paper-params",
    size: scannerPaperParams.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(scannerPaperUniformBuffer, 0, scannerPaperParams);

  const pipeline = new Pipeline(device, "rgba16float");

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", decodeLinearShader, "decode-linear"),
    ["source"],
    "decoded"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", sceneGradeShader, "scene-grade", [
      { binding: 2, resource: { buffer: sceneGradeParamsBuffer } },
    ]),
    ["decoded"],
    "graded"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", halationSourceShader, "halation-source"),
    ["graded"],
    "halationSource"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "halation-blur-h", [
      { binding: 2, resource: { buffer: blurHBuffer } },
    ]),
    ["halationSource"],
    "halationBlurH"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "halation-blur-v", [
      { binding: 2, resource: { buffer: blurVBuffer } },
    ]),
    ["halationBlurH"],
    "halationGlow"
  );

  pipeline.addStep(
    new CompositePass(device, "rgba16float", addHalationShader, "add-halation"),
    ["graded", "halationGlow"],
    "sceneWithHalation"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", characteristicCurveShader, "characteristic-curve", [
      { binding: 2, resource: lutTexture.createView() },
      { binding: 3, resource: { buffer: exposureUniformBuffer } },
    ]),
    ["sceneWithHalation"],
    "density"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", grainShader, "grain", [
      { binding: 2, resource: { buffer: grainUniformBuffer } },
    ]),
    ["density"],
    "grainedDensity"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "acutance-blur-h", [
      { binding: 2, resource: { buffer: acutanceBlurHBuffer } },
    ]),
    ["grainedDensity"],
    "acutanceBlurH"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "acutance-blur-v", [
      { binding: 2, resource: { buffer: acutanceBlurVBuffer } },
    ]),
    ["acutanceBlurH"],
    "acutanceBlurV"
  );

  pipeline.addStep(
    new CompositePass(device, "rgba16float", acutanceShader, "acutance", [
      { binding: 4, resource: { buffer: acutanceParamsBuffer } },
    ]),
    ["grainedDensity", "acutanceBlurV"],
    "sharpened"
  );

  // Las dos etapas finales (papel real vs. preview plana) NO se añaden a
  // la cadena fija — se ejecutan sueltas con `pipeline.displayFinal`,
  // para poder conmutar entre ellas sin recalcular todo lo anterior.
  const previewEncodePass = new FullscreenPass(device, format, previewEncodeShader, "preview-encode", [
    { binding: 2, resource: { buffer: previewUniformBuffer } },
  ]);
  const scannerPaperPass = new FullscreenPass(device, format, scannerPaperShader, "scanner-paper", [
    { binding: 2, resource: paperLutTexture.createView() },
    { binding: 3, resource: { buffer: scannerPaperUniformBuffer } },
  ]);

  app = {
    device,
    context,
    pipeline,
    lut,
    sceneGradeParamsBuffer,
    exposureUniformBuffer,
    blurHBuffer,
    blurVBuffer,
    grainUniformBuffer,
    acutanceBlurHBuffer,
    acutanceBlurVBuffer,
    acutanceParamsBuffer,
    previewEncodePass,
    scannerPaperPass,
    paperOffsets,
    sourceTexture: null,
    imageWidth: 0,
    imageHeight: 0,
    renderWorker: null,
    renderGeneration: 0,
    mode: "preview",
  };
  return app;
}

function updateSceneGrade(state: AppState): void {
  // Sliders en -100..100; el shader trabaja en -1..1.
  const temperature = parseFloat(temperatureSlider.value) / 100;
  const tint = parseFloat(tintSlider.value) / 100;
  const highlights = parseFloat(highlightsSlider.value) / 100;
  const shadows = parseFloat(shadowsSlider.value) / 100;
  const whites = parseFloat(whitesSlider.value) / 100;
  const blacks = parseFloat(blacksSlider.value) / 100;
  // offset 4 bytes = índice 1 (temperature) en SceneGradeParams; índice 0 es middleGray.
  state.device.queue.writeBuffer(
    state.sceneGradeParamsBuffer,
    1 * 4,
    new Float32Array([temperature, tint, highlights, shadows, whites, blacks])
  );
}

function updateBlurParams(state: AppState, width: number, height: number): void {
  const radiusPx = Math.min(
    HALATION_RADIUS_MAX_PX,
    Math.max(HALATION_RADIUS_MIN_PX, Math.round(width * HALATION_RADIUS_FRACTION))
  );
  const sigma = radiusPx / 3;
  const texelW = 1 / width;
  const texelH = 1 / height;

  state.device.queue.writeBuffer(
    state.blurHBuffer,
    0,
    new Float32Array([1, 0, texelW, texelH, radiusPx, sigma, 0, 0])
  );
  state.device.queue.writeBuffer(
    state.blurVBuffer,
    0,
    new Float32Array([0, 1, texelW, texelH, radiusPx, sigma, 0, 0])
  );
}

function updateGrainSize(state: AppState, width: number): void {
  const size = computeGrainSizePx(width);
  // offset 24 bytes = índice 6 (sizeR) en GrainParams; sigue sizeG, sizeB.
  state.device.queue.writeBuffer(state.grainUniformBuffer, 6 * 4, new Float32Array([size.r, size.g, size.b]));
}

function updateGrainIntensity(state: AppState, multiplier: number): void {
  // offset 36 bytes = índice 9 (intensity); índice 10 (seed) justo después.
  state.device.queue.writeBuffer(
    state.grainUniformBuffer,
    9 * 4,
    new Float32Array([GRAIN_BASE_INTENSITY * multiplier, GRAIN_SEED])
  );
}

function updateAcutanceBlurParams(state: AppState, width: number, height: number): void {
  const radiusPx = computeAcutanceRadiusPx(width);
  const sigma = radiusPx / 2;
  const texelW = 1 / width;
  const texelH = 1 / height;

  state.device.queue.writeBuffer(
    state.acutanceBlurHBuffer,
    0,
    new Float32Array([1, 0, texelW, texelH, radiusPx, sigma, 0, 0])
  );
  state.device.queue.writeBuffer(
    state.acutanceBlurVBuffer,
    0,
    new Float32Array([0, 1, texelW, texelH, radiusPx, sigma, 0, 0])
  );
}

function updateAcutanceAmount(state: AppState, multiplier: number): void {
  state.device.queue.writeBuffer(
    state.acutanceParamsBuffer,
    0,
    new Float32Array([ACUTANCE_BASE_AMOUNT * multiplier])
  );
}

function renderCurrent(): void {
  if (!app || !app.sourceTexture) return;
  app.pipeline.render(app.sourceTexture);
  const finalPass = paperToggle.checked ? app.scannerPaperPass : app.previewEncodePass;
  app.pipeline.displayFinal(finalPass, ["sharpened"], app.context);
}

/** Vuelve al preview rápido en tiempo real, descartando cualquier render riguroso previo. */
function backToPreview(): void {
  if (!app) return;
  app.renderGeneration++; // invalida cualquier render riguroso en curso
  if (app.mode === "preview") return;
  app.mode = "preview";
  downloadButton.hidden = true;
  renderButton.disabled = false;
  renderButton.textContent = "Renderizar grano riguroso";
  renderProgress.hidden = true;
  updateVisibleLayer();
}

function setRenderProgress(fraction: number): void {
  const pct = Math.round(fraction * 100);
  renderProgressFill.style.width = `${pct}%`;
  renderProgressText.textContent = `${pct}%`;
}

function buildRigorousParams(state: AppState): RigorousRenderParams {
  return {
    grain: {
      radius: computeGrainSizePx(state.imageWidth),
      seed: GRAIN_SEED,
      samplesPerPixel: RIGOROUS_SAMPLES_PER_PIXEL,
    },
    filmDMin: state.lut.dMin,
    filmDMax: state.lut.dMax,
    acutance: {
      radiusPx: computeAcutanceRadiusPx(state.imageWidth),
      amount: ACUTANCE_BASE_AMOUNT * parseFloat(acutanceSlider.value),
    },
    paper: {
      enabled: paperToggle.checked,
      offsets: state.paperOffsets,
    },
  };
}

async function startRigorousRender(): Promise<void> {
  if (!app || !app.sourceTexture) return;
  const state = app;

  state.mode = "rendering";
  state.renderGeneration++;
  const generation = state.renderGeneration;

  renderButton.disabled = true;
  renderButton.textContent = "Renderizando...";
  downloadButton.hidden = true;
  renderProgress.hidden = false;
  setRenderProgress(0);

  try {
    const { data, width, height } = await state.pipeline.readTextureRGBA16F("density");
    if (generation !== state.renderGeneration) return; // se canceló mientras leíamos

    if (!state.renderWorker) {
      state.renderWorker = new Worker(new URL("./render/rigorousRender.worker.ts", import.meta.url), {
        type: "module",
      });
    }
    const worker = state.renderWorker;

    const result = await new Promise<{ image: Uint8ClampedArray; width: number; height: number }>(
      (resolve, reject) => {
        const onMessage = (e: MessageEvent<WorkerResponse>) => {
          if (generation !== state.renderGeneration) return; // resultado obsoleto, ignorar
          if (e.data.type === "progress") {
            setRenderProgress(e.data.fraction);
          } else {
            worker.removeEventListener("message", onMessage);
            resolve({ image: e.data.image, width: e.data.width, height: e.data.height });
          }
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", reject, { once: true });
        worker.postMessage({ density: data, width, height, params: buildRigorousParams(state) }, [
          data.buffer,
        ]);
      }
    );

    if (generation !== state.renderGeneration) return; // el usuario siguió editando mientras se calculaba

    renderedCanvas.width = result.width;
    renderedCanvas.height = result.height;
    const ctx2d = renderedCanvas.getContext("2d")!;
    const imageData = new ImageData(
      new Uint8ClampedArray(result.image.buffer as ArrayBuffer),
      result.width,
      result.height
    );
    ctx2d.putImageData(imageData, 0, 0);

    state.mode = "rendered";
    updateVisibleLayer();
    downloadButton.hidden = false;
    renderProgress.hidden = true;
    renderButton.disabled = false;
    renderButton.textContent = "Renderizar grano riguroso";
    setStatus("Render riguroso completado (grano booleano real, no aproximación).");
  } catch (err) {
    console.error(err);
    if (generation === state.renderGeneration) {
      setStatus(err instanceof Error ? err.message : "Error al renderizar.");
      backToPreview();
    }
  }
}

function downloadRenderedImage(): void {
  const link = document.createElement("a");
  link.download = "revelado.png";
  link.href = renderedCanvas.toDataURL("image/png");
  link.click();
}

async function handleFile(file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    setStatus("El archivo no es una imagen.");
    return;
  }

  setStatus("Cargando imagen...");

  try {
    const bitmap = await createImageBitmap(file);

    dropzone.hidden = true;
    editor.hidden = false;

    originalCanvas.width = bitmap.width;
    originalCanvas.height = bitmap.height;
    const ctx2d = originalCanvas.getContext("2d")!;
    ctx2d.drawImage(bitmap, 0, 0);

    processedCanvas.width = bitmap.width;
    processedCanvas.height = bitmap.height;

    setStatus("Inicializando WebGPU...");
    const state = await ensureApp();

    updateSceneGrade(state);
    updateBlurParams(state, bitmap.width, bitmap.height);
    updateGrainSize(state, bitmap.width);
    updateGrainIntensity(state, parseFloat(grainSlider.value));
    updateAcutanceBlurParams(state, bitmap.width, bitmap.height);
    updateAcutanceAmount(state, parseFloat(acutanceSlider.value));

    state.sourceTexture?.destroy();
    state.sourceTexture = createTextureFromBitmap(state.device, bitmap, "rgba8unorm");
    state.imageWidth = bitmap.width;
    state.imageHeight = bitmap.height;

    showOriginal = false;
    backToPreview();
    renderCurrent();
    fitToViewport();

    setStatus(
      `Imagen ${bitmap.width}×${bitmap.height}. Halation + curva Portra 400 + grano + papel Endura aplicados.`
    );
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error desconocido al procesar la imagen.");
  }
}

dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

function makeSceneGradeSliderHandler(slider: HTMLInputElement, label: HTMLSpanElement): () => void {
  return () => {
    label.textContent = slider.value;
    if (!app) return;
    updateSceneGrade(app);
    backToPreview();
    renderCurrent();
  };
}

temperatureSlider.addEventListener("input", makeSceneGradeSliderHandler(temperatureSlider, temperatureValueLabel));
tintSlider.addEventListener("input", makeSceneGradeSliderHandler(tintSlider, tintValueLabel));
highlightsSlider.addEventListener("input", makeSceneGradeSliderHandler(highlightsSlider, highlightsValueLabel));
shadowsSlider.addEventListener("input", makeSceneGradeSliderHandler(shadowsSlider, shadowsValueLabel));
whitesSlider.addEventListener("input", makeSceneGradeSliderHandler(whitesSlider, whitesValueLabel));
blacksSlider.addEventListener("input", makeSceneGradeSliderHandler(blacksSlider, blacksValueLabel));

exposureSlider.addEventListener("input", () => {
  const stops = parseFloat(exposureSlider.value);
  exposureValueLabel.textContent = stops.toFixed(1);
  if (!app) return;
  // offset 20 bytes = índice 5 del array de floats (exposureStops en CurveParams)
  app.device.queue.writeBuffer(app.exposureUniformBuffer, 5 * 4, new Float32Array([stops]));
  backToPreview();
  renderCurrent();
});

grainSlider.addEventListener("input", () => {
  const multiplier = parseFloat(grainSlider.value);
  grainValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateGrainIntensity(app, multiplier);
  backToPreview();
  renderCurrent();
});

acutanceSlider.addEventListener("input", () => {
  const multiplier = parseFloat(acutanceSlider.value);
  acutanceValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateAcutanceAmount(app, multiplier);
  backToPreview();
  renderCurrent();
});

paperToggle.addEventListener("change", () => {
  backToPreview();
  renderCurrent();
});

renderButton.addEventListener("click", () => {
  startRigorousRender();
});

downloadButton.addEventListener("click", () => {
  downloadRenderedImage();
});

zoomSlider.addEventListener("input", () => {
  setZoomPercent(parseFloat(zoomSlider.value));
});

fitButton.addEventListener("click", () => {
  fitToViewport();
});

abToggleButton.addEventListener("click", () => {
  showOriginal = !showOriginal;
  updateVisibleLayer();
});

viewportFrame.addEventListener("mousedown", (e) => {
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartPanX = panX;
  dragStartPanY = panY;
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  panX = dragStartPanX + (e.clientX - dragStartX);
  panY = dragStartPanY + (e.clientY - dragStartY);
  applyCanvasTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
});

window.addEventListener("resize", () => {
  if (app?.imageWidth) fitToViewport();
});

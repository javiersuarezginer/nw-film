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
import opticalSofteningShader from "./shaders/opticalSoftening.wgsl?raw";
import scannerPaperShader from "./shaders/scannerPaper.wgsl?raw";
import lookIntensityShader from "./shaders/lookIntensity.wgsl?raw";
import type { CurveLUT } from "./color-science/curveModel";
import { FILMS, DEFAULT_FILM_ID, getFilm, type FilmProfile } from "./color-science/films/registry";
import {
  addCustomFilm,
  getAnyFilm,
  getCustomFilmRecords,
  initCustomFilmStore,
  removeCustomFilm,
  renderFilmSelectOptions,
} from "./color-science/films/customFilmStore";
import { validateAndClampFilmRecord, type FilmRecordContext } from "./color-science/films/customFilm";
import { buildPaperLUT, PAPER_DENSITY_MIN, PAPER_DENSITY_MAX } from "./color-science/portraEndura/paperCurve";

const MIDDLE_GRAY = 0.18;
// Exposición por defecto: las imágenes de entrada llegan display-referred
// (ya "reveladas" para verse bien en pantalla, no una captura lineal de
// escena real), así que su gris medio aparente cae por encima de 0.18
// lineal — alimentar la curva característica sin corregir empuja el
// trabajo hacia la zona de luces y se ve sobreexpuesto. -1.0 pasos es una
// corrección de partida basada en el uso repetido del usuario con fotos
// reales (subida desde -0.7 tras confirmar que seguía teniendo que bajar
// la exposición en casi todas las fotos), no un dato de datasheet. El
// slider de exposición sigue disponible para ajustar por imagen. Ver
// decisions.md y CLAUDE.md (Capa de IA) — la solución definitiva a este
// problema es la reconstrucción de altas luces de la Fase 7, que
// reemplazará esta corrección de partida.
const DEFAULT_EXPOSURE_STOPS = -1.0;
const CURVE_PARAMS_FLOATS = 12; // debe coincidir con el struct CurveParams del shader
const BLUR_PARAMS_FLOATS = 8; // debe coincidir con el struct BlurParams del shader
const GRAIN_PARAMS_FLOATS = 12; // debe coincidir con el struct GrainParams del shader
const SCANNER_PAPER_PARAMS_FLOATS = 12; // debe coincidir con el struct ScannerPaperParams del shader
const ACUTANCE_PARAMS_FLOATS = 4; // debe coincidir con el struct AcutanceParams del shader
const HALATION_PARAMS_FLOATS = 4; // debe coincidir con el struct HalationParams del shader
const SOFTENING_PARAMS_FLOATS = 4; // debe coincidir con el struct SofteningParams del shader
const SCENE_GRADE_PARAMS_FLOATS = 12; // debe coincidir con el struct SceneGradeParams del shader
const LOOK_INTENSITY_PARAMS_FLOATS = 4; // debe coincidir con el struct LookIntensityParams del shader

const ZOOM_MIN_PERCENT = 10;
const ZOOM_MAX_PERCENT = 500;

// El halo de halation se dimensiona como fracción del ancho de la imagen
// (no hay un valor "real" de datasheet para esto — ver halationSource.wgsl).
const HALATION_RADIUS_FRACTION = 0.035;
const HALATION_RADIUS_MIN_PX = 6;
const HALATION_RADIUS_MAX_PX = 200;
// a intensidad ×1. Recalibrado de 0.65 a 0.26 (×0.40) tras confirmar con
// uso repetido en fotos reales que el halation por defecto quedaba
// siempre exagerado, obligando a bajar el slider a ~0.40× cada vez — así
// que ese punto pasa a ser el nuevo ×1 (el slider sigue permitiendo
// subirlo si una foto concreta lo pide).
const HALATION_BASE_INTENSITY = 0.26;

// Tamaño de grano por canal, como fracción del ancho de imagen —
// aproximación razonable, no dato de datasheet (ver grain.wgsl). Escalado
// a partir de medir el tamaño aparente del grano en un crop real de
// Portra 400 que mandó el usuario (docs/reference/portra400-grain-reference.jpg,
// ~5-6px de grano en una imagen de 690px de ancho ≈ fracción 0.007-0.009
// del ancho) — el tamaño anterior era notablemente más fino que eso.
// Recalibrado de nuevo (×0.20) tras confirmar con uso repetido que ese
// tamaño seguía quedando gigante en fotos reales de resolución normal, y
// el usuario bajaba el slider a ~0.20× cada vez — ese punto pasa a ser el
// nuevo ×1.
const GRAIN_SIZE_FRACTION = { r: 0.00132, g: 0.00108, b: 0.00168 };
const GRAIN_SIZE_MIN_PX = 1.2;
// amplitud en unidades de densidad, a intensidad ×1. Recalibrado de 0.045
// a 0.065 (×1.45) tras confirmar con uso repetido que el grano por
// defecto quedaba sutil de más, obligando a subir el slider a ~1.45× cada
// vez — ese punto pasa a ser el nuevo ×1.
const GRAIN_BASE_INTENSITY = 0.065;
const GRAIN_SEED = 17.0; // fijo: mismo grano siempre para la misma imagen (determinismo)

// Radio de difusión inter-capa, mucho más pequeño que el del halation —
// aproximación razonable, no dato de datasheet (ver acutance.wgsl).
const ACUTANCE_RADIUS_FRACTION = 0.0018;
const ACUTANCE_RADIUS_MIN_PX = 1.5;
const ACUTANCE_RADIUS_MAX_PX = 6;
const ACUTANCE_BASE_AMOUNT = 0.5; // a intensidad ×1

// Radio del suavizado óptico — deliberadamente más grande que el de la
// acutancia (esto imita el límite de resolución del objetivo+película,
// no una difusión química de un solo píxel) pero sigue siendo sutil.
// Aproximación de herramienta de edición, no dato de MTF real (ver
// opticalSoftening.wgsl).
const SOFTENING_RADIUS_FRACTION = 0.004;
const SOFTENING_RADIUS_MIN_PX = 1.5;
const SOFTENING_RADIUS_MAX_PX = 10;
// mezcla máxima con la versión difuminada, a intensidad ×1. Recalibrado
// de 0.35 a 0.525 (×1.50) tras confirmar con uso repetido que el usuario
// siempre añadía más suavizado — ese punto pasa a ser el nuevo ×1.
const SOFTENING_BASE_AMOUNT = 0.525;

// Fuerza del slider "Temperatura del papel" en unidades de densidad —
// aproximación de herramienta de edición (como una filtración manual de
// ampliadora encima de la calibración automática), no dato de datasheet.
const PRINT_TEMPERATURE_STRENGTH = 0.15;

// --- Presets (look) ---
// Un preset es una "receta" plana de todos los sliders físicos del look
// (no incluye zoom/pan/comparación, que son estado de interfaz, ni el
// render riguroso, que se dispara aparte). Al importar, se aplica entero
// tal cual — la "intensidad del preset" NO interpola estos valores; mezcla
// el RESULTADO final (ya revelado con el preset al 100%) contra la foto
// original, como un fundido de opacidad de editor (ver lookIntensity.wgsl
// y updateLookIntensity). PRESET_DEFAULTS solo se usa como valor de
// respaldo para campos ausentes o corruptos al leer un JSON externo —
// deben coincidir con los valores por defecto de los sliders en
// index.html (mismo patrón que DEFAULT_EXPOSURE_STOPS más arriba).
interface PresetValues {
  temperature: number;
  tint: number;
  exposure: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  halation: number;
  saturation: number;
  vibrance: number;
  grain: number;
  grainSize: number;
  acutance: number;
  softening: number;
  paperTemperature: number;
}

const PRESET_DEFAULTS: PresetValues = {
  temperature: 0,
  tint: 0,
  exposure: DEFAULT_EXPOSURE_STOPS,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  halation: 1,
  saturation: 0,
  vibrance: 0,
  grain: 1,
  grainSize: 1,
  acutance: 1,
  softening: 1,
  paperTemperature: 0,
};

const openButton = document.querySelector<HTMLButtonElement>("#open-button")!;
const exportButton = document.querySelector<HTMLButtonElement>("#export-button")!;
const emptyState = document.querySelector<HTMLDivElement>("#empty-state")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const statusEl = document.querySelector<HTMLSpanElement>("#status")!;
const originalCanvas = document.querySelector<HTMLCanvasElement>("#canvas-original")!;
const processedCanvas = document.querySelector<HTMLCanvasElement>("#canvas-processed")!;
const canvasStacks = document.querySelectorAll<HTMLDivElement>(".canvas-stack");
const canvasPanes = document.querySelector<HTMLDivElement>("#canvas-panes")!;
const paneOriginal = document.querySelector<HTMLDivElement>("#pane-original")!;
const paneProcessed = document.querySelector<HTMLDivElement>("#pane-processed")!;
const viewportFrame = document.querySelector<HTMLDivElement>("#viewport-frame")!;
const sideBySideToggleButton = document.querySelector<HTMLButtonElement>("#side-by-side-toggle")!;
const filmGridToggleButton = document.querySelector<HTMLButtonElement>("#film-grid-toggle")!;
const filmGridOverlay = document.querySelector<HTMLDivElement>("#film-grid-overlay")!;
const filmGridClose = document.querySelector<HTMLButtonElement>("#film-grid-close")!;
const filmGridStatus = document.querySelector<HTMLDivElement>("#film-grid-status")!;
const filmGrid = document.querySelector<HTMLDivElement>("#film-grid")!;

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
const halationSlider = document.querySelector<HTMLInputElement>("#halation-slider")!;
const halationValueLabel = document.querySelector<HTMLSpanElement>("#halation-value")!;
const saturationSlider = document.querySelector<HTMLInputElement>("#saturation-slider")!;
const saturationValueLabel = document.querySelector<HTMLSpanElement>("#saturation-value")!;
const vibranceSlider = document.querySelector<HTMLInputElement>("#vibrance-slider")!;
const vibranceValueLabel = document.querySelector<HTMLSpanElement>("#vibrance-value")!;
const grainSlider = document.querySelector<HTMLInputElement>("#grain-slider")!;
const grainValueLabel = document.querySelector<HTMLSpanElement>("#grain-value")!;
const grainSizeSlider = document.querySelector<HTMLInputElement>("#grain-size-slider")!;
const grainSizeValueLabel = document.querySelector<HTMLSpanElement>("#grain-size-value")!;
const acutanceSlider = document.querySelector<HTMLInputElement>("#acutance-slider")!;
const acutanceValueLabel = document.querySelector<HTMLSpanElement>("#acutance-value")!;
const softeningSlider = document.querySelector<HTMLInputElement>("#softening-slider")!;
const softeningValueLabel = document.querySelector<HTMLSpanElement>("#softening-value")!;
const paperTemperatureSlider = document.querySelector<HTMLInputElement>("#paper-temperature-slider")!;
const paperTemperatureValueLabel = document.querySelector<HTMLSpanElement>("#paper-temperature-value")!;

const presetImportButton = document.querySelector<HTMLButtonElement>("#preset-import-button")!;
const presetExportButton = document.querySelector<HTMLButtonElement>("#preset-export-button")!;
const presetFileInput = document.querySelector<HTMLInputElement>("#preset-file-input")!;
const filmSelect = document.querySelector<HTMLSelectElement>("#film-select")!;
const filmAnalysisNote = document.querySelector<HTMLParagraphElement>("#film-analysis-note")!;
const lookIntensitySlider = document.querySelector<HTMLInputElement>("#look-intensity-slider")!;
const lookIntensityValueLabel = document.querySelector<HTMLSpanElement>("#look-intensity-value")!;

const createFilmButton = document.querySelector<HTMLButtonElement>("#create-film-button")!;
const deleteFilmButton = document.querySelector<HTMLButtonElement>("#delete-film-button")!;
const filmImportButton = document.querySelector<HTMLButtonElement>("#film-import-button")!;
const filmExportButton = document.querySelector<HTMLButtonElement>("#film-export-button")!;
const filmFileInput = document.querySelector<HTMLInputElement>("#film-file-input")!;

const createFilmOverlay = document.querySelector<HTMLDivElement>("#create-film-overlay")!;
const createFilmClose = document.querySelector<HTMLButtonElement>("#create-film-close")!;
const createFilmFileInput = document.querySelector<HTMLInputElement>("#create-film-file-input")!;
const createFilmChooseButton = document.querySelector<HTMLButtonElement>("#create-film-choose-button")!;
const createFilmPreview = document.querySelector<HTMLDivElement>("#create-film-preview")!;
const createFilmLabelInput = document.querySelector<HTMLInputElement>("#create-film-label-input")!;
const createFilmAnalyzeButton = document.querySelector<HTMLButtonElement>("#create-film-analyze-button")!;
const createFilmStatus = document.querySelector<HTMLDivElement>("#create-film-status")!;

// Carga las películas creadas por el usuario (IA/importadas) desde
// localStorage y puebla el desplegable con las 5 reales + las del
// usuario (agrupadas aparte solo si hay alguna) — ver customFilmStore.ts.
initCustomFilmStore();
renderFilmSelectOptions(filmSelect, DEFAULT_FILM_ID);

const abToggleButton = document.querySelector<HTMLButtonElement>("#ab-toggle")!;
const zoomSlider = document.querySelector<HTMLInputElement>("#zoom-slider")!;
const zoomValueLabel = document.querySelector<HTMLSpanElement>("#zoom-value")!;
const fitButton = document.querySelector<HTMLButtonElement>("#fit-button")!;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

/** Alinea los tres canales del negativo en su punto de exposición de referencia, igual que el filtro de la ampliadora en un laboratorio real (ver scannerPaper.wgsl). */
function computeChannelOffsets(film: FilmProfile): { r: number; g: number; b: number } {
  const refDensity = {
    r: film.curveModel.sampleDensity("r", film.source.logHRef),
    g: film.curveModel.sampleDensity("g", film.source.logHRef),
    b: film.curveModel.sampleDensity("b", film.source.logHRef),
  };
  const commonTarget = (refDensity.r + refDensity.g + refDensity.b) / 3;
  return {
    r: commonTarget - refDensity.r,
    g: commonTarget - refDensity.g,
    b: commonTarget - refDensity.b,
  };
}

function computeGrainSizePx(width: number, sizeMultiplier: number): { r: number; g: number; b: number } {
  return {
    r: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.r * sizeMultiplier),
    g: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.g * sizeMultiplier),
    b: Math.max(GRAIN_SIZE_MIN_PX, width * GRAIN_SIZE_FRACTION.b * sizeMultiplier),
  };
}

function computeAcutanceRadiusPx(width: number): number {
  return Math.min(ACUTANCE_RADIUS_MAX_PX, Math.max(ACUTANCE_RADIUS_MIN_PX, width * ACUTANCE_RADIUS_FRACTION));
}

function computeSofteningRadiusPx(width: number): number {
  return Math.min(SOFTENING_RADIUS_MAX_PX, Math.max(SOFTENING_RADIUS_MIN_PX, width * SOFTENING_RADIUS_FRACTION));
}

interface AppState {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  pipeline: Pipeline;
  currentFilm: FilmProfile;
  lut: CurveLUT;
  lutTexture: GPUTexture;
  sceneGradeParamsBuffer: GPUBuffer;
  exposureUniformBuffer: GPUBuffer;
  blurHBuffer: GPUBuffer;
  blurVBuffer: GPUBuffer;
  grainUniformBuffer: GPUBuffer;
  acutanceBlurHBuffer: GPUBuffer;
  acutanceBlurVBuffer: GPUBuffer;
  acutanceParamsBuffer: GPUBuffer;
  halationParamsBuffer: GPUBuffer;
  softeningBlurHBuffer: GPUBuffer;
  softeningBlurVBuffer: GPUBuffer;
  softeningParamsBuffer: GPUBuffer;
  scannerPaperPass: Pass;
  scannerPaperUniformBuffer: GPUBuffer;
  paperOffsets: { r: number; g: number; b: number };
  lookIntensityPass: Pass;
  lookIntensityParamsBuffer: GPUBuffer;
  sourceTexture: GPUTexture | null;
  encodedTexture: GPUTexture | null;
  imageWidth: number;
  imageHeight: number;
}

let app: AppState | null = null;

// --- Estado de zoom/arrastre/comparación A-B (solo interfaz, no motor) ---
let zoomPercent = 100;
let panX = 0;
let panY = 0;
let showOriginal = false;
let sideBySide = false;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

// Nombre base (sin extensión) de la última imagen cargada, para que el
// preset exportado quede asociado por nombre a la imagen.
let currentFileBaseName: string | null = null;

function applyCanvasTransform(): void {
  const transform = `translate(${panX}px, ${panY}px) scale(${zoomPercent / 100})`;
  canvasStacks.forEach((stack) => {
    stack.style.transform = transform;
  });
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
  // En modo lado a lado cada panel solo tiene la mitad del ancho.
  const availableWidth = sideBySide ? frameRect.width / 2 : frameRect.width;
  const fitScale = Math.min(availableWidth / app.imageWidth, frameRect.height / app.imageHeight);
  panX = 0;
  panY = 0;
  setZoomPercent(fitScale * 100);
}

function updateVisibleLayer(): void {
  if (sideBySide) {
    paneOriginal.hidden = false;
    paneProcessed.hidden = false;
  } else {
    paneOriginal.hidden = !showOriginal;
    paneProcessed.hidden = showOriginal;
  }

  abToggleButton.textContent = showOriginal ? "Ver editada" : "Ver original";
  abToggleButton.classList.toggle("active", showOriginal);
  abToggleButton.disabled = sideBySide;
}

async function ensureApp(): Promise<AppState> {
  if (app) return app;

  const { device, context, format } = await initWebGPU(processedCanvas);

  const initialFilm = getFilm(DEFAULT_FILM_ID);
  const lut = initialFilm.curveModel.buildCurveLUT(512, 3.0);
  const lutTexture = createLUTTexture(device, lut.data, lut.width);

  const curveParams = new Float32Array(CURVE_PARAMS_FLOATS);
  curveParams.set([
    lut.domainMin,
    lut.domainMax,
    lut.width,
    initialFilm.source.logHRef,
    MIDDLE_GRAY,
    DEFAULT_EXPOSURE_STOPS, // se actualiza con el slider a partir de aquí
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
  // blancos, negros, carácter de color de la película) arranca a 0 y se
  // actualiza con updateSceneGrade en cuanto se carga una imagen.
  device.queue.writeBuffer(
    sceneGradeParamsBuffer,
    0,
    new Float32Array([MIDDLE_GRAY, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  );

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

  const halationParamsBuffer = device.createBuffer({
    label: "halation-params",
    size: HALATION_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(halationParamsBuffer, 0, new Float32Array([HALATION_BASE_INTENSITY]));

  const softeningBlurHBuffer = device.createBuffer({
    label: "softening-blur-h-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const softeningBlurVBuffer = device.createBuffer({
    label: "softening-blur-v-params",
    size: BLUR_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const softeningParamsBuffer = device.createBuffer({
    label: "softening-params",
    size: SOFTENING_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(softeningParamsBuffer, 0, new Float32Array([SOFTENING_BASE_AMOUNT]));

  // --- Simulación de papel (Kodak Portra Endura) ---
  const paperLut = buildPaperLUT(512, 1.5);
  const paperLutTexture = createLUTTexture(device, paperLut.data, paperLut.width);

  const paperOffsets = computeChannelOffsets(initialFilm);

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
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "softening-blur-h", [
      { binding: 2, resource: { buffer: softeningBlurHBuffer } },
    ]),
    ["graded"],
    "softeningBlurH"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", gaussianBlurShader, "softening-blur-v", [
      { binding: 2, resource: { buffer: softeningBlurVBuffer } },
    ]),
    ["softeningBlurH"],
    "softeningBlur"
  );

  pipeline.addStep(
    new CompositePass(device, "rgba16float", opticalSofteningShader, "optical-softening", [
      { binding: 4, resource: { buffer: softeningParamsBuffer } },
    ]),
    ["graded", "softeningBlur"],
    "softened"
  );

  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", halationSourceShader, "halation-source"),
    ["softened"],
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
    new CompositePass(device, "rgba16float", addHalationShader, "add-halation", [
      { binding: 4, resource: { buffer: halationParamsBuffer } },
    ]),
    ["softened", "halationGlow"],
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

  // Densidad "de referencia": la misma curva, pero sobre la escena SIN el
  // suavizado óptico. Solo se usa para decidir cuánto grano mostrar en
  // cada zona (ver comentario en grain.wgsl) — así el suavizado no apaga
  // el grano en zonas con detalle fino.
  pipeline.addStep(
    new FullscreenPass(device, "rgba16float", characteristicCurveShader, "characteristic-curve-ref", [
      { binding: 2, resource: lutTexture.createView() },
      { binding: 3, resource: { buffer: exposureUniformBuffer } },
    ]),
    ["graded"],
    "densityRef"
  );

  pipeline.addStep(
    new CompositePass(device, "rgba16float", grainShader, "grain", [
      { binding: 4, resource: { buffer: grainUniformBuffer } },
    ]),
    ["density", "densityRef"],
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

  // Etapa final de papel (Kodak Portra Endura) — NO se añade a la cadena
  // fija, se ejecuta suelta con `pipeline.renderFinalToTexture` para
  // poder mezclarla luego con la foto original en el paso de intensidad.
  const scannerPaperPass = new FullscreenPass(device, format, scannerPaperShader, "scanner-paper", [
    { binding: 2, resource: paperLutTexture.createView() },
    { binding: 3, resource: { buffer: scannerPaperUniformBuffer } },
  ]);

  // Paso final: mezcla el resultado revelado con la foto original según
  // el slider "Intensidad del preset" (100% = look completo, 0% = foto
  // sin tocar). Arranca en 1.0 (look completo) para no cambiar nada por
  // defecto hasta que se importe un preset.
  const lookIntensityParamsBuffer = device.createBuffer({
    label: "look-intensity-params",
    size: LOOK_INTENSITY_PARAMS_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(lookIntensityParamsBuffer, 0, new Float32Array([1]));
  const lookIntensityPass = new CompositePass(device, format, lookIntensityShader, "look-intensity", [
    { binding: 4, resource: { buffer: lookIntensityParamsBuffer } },
  ]);

  app = {
    device,
    context,
    format,
    pipeline,
    currentFilm: initialFilm,
    lut,
    lutTexture,
    sceneGradeParamsBuffer,
    exposureUniformBuffer,
    blurHBuffer,
    blurVBuffer,
    grainUniformBuffer,
    acutanceBlurHBuffer,
    acutanceBlurVBuffer,
    acutanceParamsBuffer,
    halationParamsBuffer,
    softeningBlurHBuffer,
    softeningBlurVBuffer,
    softeningParamsBuffer,
    scannerPaperPass,
    scannerPaperUniformBuffer,
    paperOffsets,
    lookIntensityPass,
    lookIntensityParamsBuffer,
    sourceTexture: null,
    encodedTexture: null,
    imageWidth: 0,
    imageHeight: 0,
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

  // offset 32 bytes = índices 8-11 (carácter de color de la película activa).
  const cc = state.currentFilm.colorCharacter;
  state.device.queue.writeBuffer(
    state.sceneGradeParamsBuffer,
    8 * 4,
    new Float32Array([cc.shadowWarmth / 100, cc.shadowTint / 100, cc.highlightWarmth / 100, cc.highlightTint / 100])
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

function updateGrainSize(state: AppState, width: number, sizeMultiplier: number): void {
  const size = computeGrainSizePx(width, sizeMultiplier * state.currentFilm.grainCharacter.sizeMultiplier);
  // offset 24 bytes = índice 6 (sizeR) en GrainParams; sigue sizeG, sizeB.
  state.device.queue.writeBuffer(state.grainUniformBuffer, 6 * 4, new Float32Array([size.r, size.g, size.b]));
}

function updateGrainIntensity(state: AppState, multiplier: number): void {
  // offset 36 bytes = índice 9 (intensity); índice 10 (seed) justo después.
  const effective = GRAIN_BASE_INTENSITY * multiplier * state.currentFilm.grainCharacter.intensityMultiplier;
  state.device.queue.writeBuffer(state.grainUniformBuffer, 9 * 4, new Float32Array([effective, GRAIN_SEED]));
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

function updateSofteningBlurParams(state: AppState, width: number, height: number): void {
  const radiusPx = computeSofteningRadiusPx(width);
  const sigma = radiusPx / 2;
  const texelW = 1 / width;
  const texelH = 1 / height;

  state.device.queue.writeBuffer(
    state.softeningBlurHBuffer,
    0,
    new Float32Array([1, 0, texelW, texelH, radiusPx, sigma, 0, 0])
  );
  state.device.queue.writeBuffer(
    state.softeningBlurVBuffer,
    0,
    new Float32Array([0, 1, texelW, texelH, radiusPx, sigma, 0, 0])
  );
}

function updateSofteningAmount(state: AppState, multiplier: number): void {
  state.device.queue.writeBuffer(
    state.softeningParamsBuffer,
    0,
    new Float32Array([SOFTENING_BASE_AMOUNT * multiplier])
  );
}

// La saturación/viveza final es la del slider del usuario MÁS el sesgo
// propio de la película activa (ver FilmColorCharacter) — no lo sustituye.
function updateSaturationVibrance(state: AppState): void {
  const cc = state.currentFilm.colorCharacter;
  const saturation = parseFloat(saturationSlider.value) / 100 + cc.saturationBias / 100;
  const vibrance = parseFloat(vibranceSlider.value) / 100 + cc.vibranceBias / 100;
  // offset 32 bytes = índice 8 (saturation) en ScannerPaperParams; sigue vibrance.
  state.device.queue.writeBuffer(
    state.scannerPaperUniformBuffer,
    8 * 4,
    new Float32Array([saturation, vibrance])
  );
}

function updateHalationIntensity(state: AppState, multiplier: number): void {
  const effective = HALATION_BASE_INTENSITY * multiplier * state.currentFilm.halationMultiplier;
  state.device.queue.writeBuffer(state.halationParamsBuffer, 0, new Float32Array([effective]));
}

/** Offsets de calibración del papel (neutro en gris) + ajuste manual del usuario (temperatura del papel). */
function computePaperOffsets(state: AppState, printTemperature: number): { r: number; g: number; b: number } {
  const delta = printTemperature * PRINT_TEMPERATURE_STRENGTH;
  return {
    r: state.paperOffsets.r + delta,
    g: state.paperOffsets.g,
    b: state.paperOffsets.b - delta,
  };
}

function updatePrintTemperature(state: AppState, printTemperature: number): void {
  const offsets = computePaperOffsets(state, printTemperature);
  state.device.queue.writeBuffer(
    state.scannerPaperUniformBuffer,
    0,
    new Float32Array([offsets.r, offsets.g, offsets.b])
  );
}

/**
 * Cambia la película activa: recarga su curva en la GPU y realinea el
 * offset de papel, sin recrear ningún buffer ni textura (la LUT siempre
 * mide 512x1, solo cambia su contenido). El grano, el halation y el
 * ajuste manual de exposición del usuario NO dependen de la película —
 * siguen constantes compartidas hasta que haya fotos de referencia reales
 * por emulsión (ver decisions.md).
 */
function loadFilmIntoState(state: AppState, film: FilmProfile): void {
  state.currentFilm = film;
  const lut = film.curveModel.buildCurveLUT(512, 3.0);
  state.lut = lut;

  state.device.queue.writeTexture(
    { texture: state.lutTexture },
    lut.data.buffer as ArrayBuffer,
    { bytesPerRow: lut.width * 4 * 4 },
    [lut.width, 1]
  );

  // offset 0 bytes = índices 0-3 (domainMin, domainMax, width, logHRef) en
  // CurveParams; índice 4 (middleGray) y 5 (exposureStops, ajuste manual
  // del usuario) se dejan intactos.
  state.device.queue.writeBuffer(
    state.exposureUniformBuffer,
    0,
    new Float32Array([lut.domainMin, lut.domainMax, lut.width, film.source.logHRef])
  );
  // offset 24 bytes = índices 6-11 (dMin r/g/b, dMax r/g/b) en CurveParams.
  state.device.queue.writeBuffer(
    state.exposureUniformBuffer,
    6 * 4,
    new Float32Array([lut.dMin.r, lut.dMin.g, lut.dMin.b, lut.dMax.r, lut.dMax.g, lut.dMax.b])
  );

  // dMin/dMax también viven en grainUniformBuffer, offset 0.
  const dMinDMax = new Float32Array([lut.dMin.r, lut.dMin.g, lut.dMin.b, lut.dMax.r, lut.dMax.g, lut.dMax.b]);
  state.device.queue.writeBuffer(state.grainUniformBuffer, 0, dMinDMax);

  state.paperOffsets = computeChannelOffsets(film);
  updatePrintTemperature(state, parseFloat(paperTemperatureSlider.value) / 100);

  // Carácter de color propio de la película nueva (warmth/tint por zona
  // tonal + sesgo de saturación/viveza) — se suma al ajuste manual del
  // usuario, que se deja intacto.
  updateSceneGrade(state);
  updateSaturationVibrance(state);

  // Grano y halation propios de la película nueva (ver FilmGrainCharacter/
  // halationMultiplier en registry.ts) — se multiplican por el ajuste
  // manual del usuario, que se deja intacto. Solo si ya hay una imagen
  // cargada (imageWidth a 0 antes de la primera carga, igual que el resto
  // de sitios que dependen del tamaño de imagen).
  if (state.imageWidth) {
    updateGrainSize(state, state.imageWidth, parseFloat(grainSizeSlider.value));
    updateGrainIntensity(state, parseFloat(grainSlider.value));
    updateHalationIntensity(state, parseFloat(halationSlider.value));
  }
}

function renderCurrent(): void {
  if (!app || !app.sourceTexture || !app.encodedTexture) return;
  app.pipeline.render(app.sourceTexture);
  // El resultado revelado se escribe primero a una textura intermedia (no
  // directo al canvas) para poder mezclarlo con la foto original en el
  // paso de "intensidad del preset" antes de mostrarlo.
  app.pipeline.renderFinalToTexture(app.scannerPaperPass, ["sharpened"], app.encodedTexture);
  app.pipeline.displayFinalWithTextures(
    app.lookIntensityPass,
    [app.sourceTexture, app.encodedTexture],
    app.context
  );
}

function updateLookIntensity(state: AppState, intensity: number): void {
  state.device.queue.writeBuffer(state.lookIntensityParamsBuffer, 0, new Float32Array([intensity]));
}

/**
 * Guarda un blob en disco. Si el navegador soporta File System Access API
 * (Chrome/Edge), abre el diálogo nativo "Guardar como" para que el usuario
 * elija dónde guardarlo; si no (Firefox, Safari), cae al método de
 * descarga automática de siempre a la carpeta de descargas.
 */
async function saveBlob(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
  typeDescription: string
): Promise<void> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
      }>;
    }
  ).showSaveFilePicker;

  if (picker) {
    try {
      const extension = suggestedName.slice(suggestedName.lastIndexOf("."));
      const handle = await picker({
        suggestedName,
        types: [{ description: typeDescription, accept: { [mimeType]: [extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // el usuario canceló el diálogo
      console.error(err);
      // sigue al método de descarga de siempre como respaldo
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = suggestedName;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar el PNG."));
    }, "image/png");
  });
}

async function exportCurrentImage(): Promise<void> {
  if (!app || !app.sourceTexture) return;
  const blob = await canvasToBlob(processedCanvas);
  await saveBlob(blob, "nw-film.png", "image/png", "Imagen PNG");
}

let filmGridObjectUrls: string[] = [];

function closeFilmGrid(): void {
  filmGridOverlay.hidden = true;
  for (const url of filmGridObjectUrls) URL.revokeObjectURL(url);
  filmGridObjectUrls = [];
  filmGrid.innerHTML = "";
}

/**
 * Renderiza la foto actual con cada película del catálogo (dejando el
 * resto de sliders tal cual están) y las muestra en una cuadrícula para
 * comparar a simple vista. Reutiliza el pipeline real uno a uno — no hay
 * un modo "multi-película" en la GPU, así que cada captura es un
 * renderCurrent() normal seguido de una lectura del canvas.
 */
async function openFilmGrid(): Promise<void> {
  if (!app || !app.sourceTexture) return;
  const state = app;
  const originalFilmId = state.currentFilm.id;

  filmGridToggleButton.disabled = true;
  filmGrid.innerHTML = "";
  filmGridStatus.textContent = "Generando cuadrícula...";
  filmGridOverlay.hidden = false;

  try {
    for (const film of FILMS) {
      loadFilmIntoState(state, film);
      renderCurrent();
      await state.device.queue.onSubmittedWorkDone();
      const blob = await canvasToBlob(processedCanvas);
      const url = URL.createObjectURL(blob);
      filmGridObjectUrls.push(url);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "film-grid-cell";
      cell.title = `Usar ${film.label}`;
      const img = document.createElement("img");
      img.src = url;
      img.alt = film.label;
      const caption = document.createElement("span");
      caption.textContent = film.label;
      cell.appendChild(img);
      cell.appendChild(caption);
      cell.addEventListener("click", () => {
        filmSelect.value = film.id;
        filmSelect.dispatchEvent(new Event("change", { bubbles: true }));
        closeFilmGrid();
      });
      filmGrid.appendChild(cell);
    }
    filmGridStatus.textContent = "";
  } finally {
    // Vuelve a la película que estaba activa antes de abrir la cuadrícula
    // (puede ser una custom del usuario, no solo una de las 5 reales).
    loadFilmIntoState(state, getAnyFilm(originalFilmId));
    updateCustomFilmUi(state.currentFilm);
    renderCurrent();
    filmGridToggleButton.disabled = false;
  }
}

/** Muestra/oculta lo que solo aplica a películas creadas por el usuario (nota de análisis, botones de eliminar/exportar). */
function updateCustomFilmUi(film: FilmProfile): void {
  if (film.isCustom) {
    const record = getCustomFilmRecords().find((r) => r.id === film.id);
    filmAnalysisNote.textContent = record?.analysisNote ? `IA: ${record.analysisNote}` : "";
    filmAnalysisNote.hidden = !record?.analysisNote;
    deleteFilmButton.hidden = false;
    filmExportButton.hidden = false;
  } else {
    filmAnalysisNote.hidden = true;
    filmAnalysisNote.textContent = "";
    deleteFilmButton.hidden = true;
    filmExportButton.hidden = true;
  }
}

let pendingFilmImageFile: File | null = null;
let pendingFilmPreviewUrl: string | null = null;

function openCreateFilmOverlay(): void {
  pendingFilmImageFile = null;
  createFilmFileInput.value = "";
  createFilmLabelInput.value = "";
  createFilmPreview.innerHTML = "";
  createFilmAnalyzeButton.disabled = true;
  createFilmStatus.textContent = "";
  if (pendingFilmPreviewUrl) {
    URL.revokeObjectURL(pendingFilmPreviewUrl);
    pendingFilmPreviewUrl = null;
  }
  createFilmOverlay.hidden = false;
}

function closeCreateFilmOverlay(): void {
  createFilmOverlay.hidden = true;
  if (pendingFilmPreviewUrl) {
    URL.revokeObjectURL(pendingFilmPreviewUrl);
    pendingFilmPreviewUrl = null;
  }
}

/** Reduce la foto a ≤1024px de lado mayor y la codifica en JPEG — la IA no necesita resolución completa para este análisis, y mantiene la petición pequeña/barata/rápida. */
const MAX_UPLOAD_DIMENSION = 1024;

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo procesar la foto de referencia."));
      },
      "image/jpeg",
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la foto de referencia."));
    reader.readAsDataURL(blob);
  });
}

interface ZoneColorStats {
  r: number;
  g: number;
  b: number;
  /** Fracción de píxeles de la foto que cayeron en esta zona — si es muy baja, la medición es poco fiable. */
  pixelFraction: number;
}

interface ReferenceImageStats {
  shadows: ZoneColorStats;
  midtones: ZoneColorStats;
  highlights: ZoneColorStats;
  /** Percentil 5 y 95 de luminancia (0-255) — contraste real aproximado de la escena. */
  lumaP5: number;
  lumaP95: number;
}

/**
 * Mide de verdad el color medio en sombras/medios/luces (por umbral de
 * luminancia, mismos pesos Rec.709 que sceneGrade.wgsl) y el contraste
 * aproximado (percentil 5/95 de luminancia) de la foto de referencia —
 * para que la IA base el carácter de color en datos reales en vez de
 * adivinarlos mirando. Mismo criterio que ya se usó a mano con numpy en
 * la sesión de calibración de grano/color (ver decisions.md): medir
 * parches de sombra/piel/cielo en vez de "a ojo". El grano/halation/forma
 * de curva se dejan al juicio visual de la IA — un análisis de parches
 * simple no discrimina bien ahí (ya se intentó y falló para el grano, ver
 * decisions.md 2026-08-03).
 */
function computeReferenceImageStats(canvas: HTMLCanvasElement): ReferenceImageStats {
  const ctx = canvas.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const totalPixels = width * height;

  const histogram = new Uint32Array(256);
  const zones = {
    shadows: { r: 0, g: 0, b: 0, count: 0 },
    midtones: { r: 0, g: 0, b: 0, count: 0 },
    highlights: { r: 0, g: 0, b: 0, count: 0 },
  };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    histogram[Math.min(255, Math.max(0, Math.round(luma)))]++;

    const zone = luma < 85 ? zones.shadows : luma > 170 ? zones.highlights : zones.midtones;
    zone.r += r;
    zone.g += g;
    zone.b += b;
    zone.count++;
  }

  function toZoneStats(zone: { r: number; g: number; b: number; count: number }): ZoneColorStats {
    if (zone.count === 0) return { r: 0, g: 0, b: 0, pixelFraction: 0 };
    return { r: zone.r / zone.count, g: zone.g / zone.count, b: zone.b / zone.count, pixelFraction: zone.count / totalPixels };
  }

  let lumaP5: number | null = null;
  let lumaP95: number | null = null;
  let cumulative = 0;
  const p5Target = totalPixels * 0.05;
  const p95Target = totalPixels * 0.95;
  for (let level = 0; level < 256; level++) {
    cumulative += histogram[level];
    if (lumaP5 === null && cumulative >= p5Target) lumaP5 = level;
    if (lumaP95 === null && cumulative >= p95Target) {
      lumaP95 = level;
      break;
    }
  }

  return {
    shadows: toZoneStats(zones.shadows),
    midtones: toZoneStats(zones.midtones),
    highlights: toZoneStats(zones.highlights),
    lumaP5: lumaP5 ?? 0,
    lumaP95: lumaP95 ?? 255,
  };
}

async function downscaleImageToJpegBase64(
  file: File
): Promise<{ base64: string; mediaType: string; stats: ReferenceImageStats }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);

  const stats = computeReferenceImageStats(canvas);
  const blob = await canvasToJpegBlob(canvas, 0.85);
  const base64 = await blobToBase64(blob);
  return { base64, mediaType: "image/jpeg", stats };
}

/** Llama al endpoint de servidor (única pieza no-cliente del proyecto, ver api/analyze-film.ts) — la API key de Anthropic vive solo ahí. */
async function requestFilmProposal(file: File, suggestedLabel: string): Promise<unknown> {
  const { base64, mediaType, stats } = await downscaleImageToJpegBase64(file);

  const response = await fetch("/api/analyze-film", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mediaType, suggestedLabel, referenceStats: stats }),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Error al analizar la foto.";
    throw new Error(message);
  }
  return body;
}

async function handleCreateFilmAnalyze(): Promise<void> {
  if (!pendingFilmImageFile) return;

  createFilmAnalyzeButton.disabled = true;
  createFilmStatus.textContent = "Analizando foto con IA… puede tardar unos segundos";

  try {
    const raw = await requestFilmProposal(pendingFilmImageFile, createFilmLabelInput.value);
    const context: FilmRecordContext = {
      id: `custom-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      modelId: typeof (raw as Record<string, unknown>).modelId === "string" ? (raw as Record<string, unknown>).modelId as string : "desconocido",
      sourceImageName: pendingFilmImageFile.name,
    };
    const result = validateAndClampFilmRecord(raw, context);
    if (!result.ok) {
      createFilmStatus.textContent = `No se pudo crear la película: ${result.reason}`;
      createFilmAnalyzeButton.disabled = false;
      return;
    }

    const persisted = addCustomFilm(result.record);
    if (!persisted) {
      setStatus("Película creada, pero no se pudo guardar (almacenamiento lleno) — se perderá al recargar.");
    }
    renderFilmSelectOptions(filmSelect, result.record.id);
    filmSelect.dispatchEvent(new Event("change", { bubbles: true }));
    closeCreateFilmOverlay();
  } catch (err) {
    console.error(err);
    createFilmStatus.textContent = err instanceof Error ? err.message : "Error inesperado al crear la película.";
    createFilmAnalyzeButton.disabled = false;
  }
}

async function handleFilmExport(): Promise<void> {
  const record = getCustomFilmRecords().find((r) => r.id === filmSelect.value);
  if (!record) return;
  const json = JSON.stringify(record, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  await saveBlob(blob, `${record.label}.nwfilm.json`, "application/json", "Película JSON");
}

async function importFilmFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    const modelId =
      isRecordLike(parsed) && typeof parsed.modelId === "string" ? parsed.modelId : "importado";
    const context: FilmRecordContext = {
      id: `custom-${crypto.randomUUID()}`, // id nuevo siempre, evita colisión al reimportar el mismo archivo
      createdAt: new Date().toISOString(),
      modelId,
      sourceImageName: file.name,
    };
    const result = validateAndClampFilmRecord(parsed, context);
    if (!result.ok) {
      setStatus(`Película inválida o corrupta: ${result.reason}`);
      return;
    }
    const persisted = addCustomFilm(result.record);
    if (!persisted) {
      setStatus("Película importada, pero no se pudo guardar (almacenamiento lleno) — se perderá al recargar.");
    }
    renderFilmSelectOptions(filmSelect, result.record.id);
    filmSelect.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "No se pudo leer el archivo de película.");
  }
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectCurrentPreset(): PresetValues {
  return {
    temperature: parseFloat(temperatureSlider.value),
    tint: parseFloat(tintSlider.value),
    exposure: parseFloat(exposureSlider.value),
    highlights: parseFloat(highlightsSlider.value),
    shadows: parseFloat(shadowsSlider.value),
    whites: parseFloat(whitesSlider.value),
    blacks: parseFloat(blacksSlider.value),
    halation: parseFloat(halationSlider.value),
    saturation: parseFloat(saturationSlider.value),
    vibrance: parseFloat(vibranceSlider.value),
    grain: parseFloat(grainSlider.value),
    grainSize: parseFloat(grainSizeSlider.value),
    acutance: parseFloat(acutanceSlider.value),
    softening: parseFloat(softeningSlider.value),
    paperTemperature: parseFloat(paperTemperatureSlider.value),
  };
}

/** Escribe los valores en los sliders y en el motor, y renderiza una sola vez (evita un render por slider). */
function applyPresetValues(values: PresetValues): void {
  temperatureSlider.value = String(values.temperature);
  temperatureValueLabel.textContent = temperatureSlider.value;
  tintSlider.value = String(values.tint);
  tintValueLabel.textContent = tintSlider.value;
  exposureSlider.value = values.exposure.toFixed(1);
  exposureValueLabel.textContent = values.exposure.toFixed(1);
  highlightsSlider.value = String(values.highlights);
  highlightsValueLabel.textContent = highlightsSlider.value;
  shadowsSlider.value = String(values.shadows);
  shadowsValueLabel.textContent = shadowsSlider.value;
  whitesSlider.value = String(values.whites);
  whitesValueLabel.textContent = whitesSlider.value;
  blacksSlider.value = String(values.blacks);
  blacksValueLabel.textContent = blacksSlider.value;
  halationSlider.value = values.halation.toFixed(2);
  halationValueLabel.textContent = values.halation.toFixed(2);
  saturationSlider.value = String(values.saturation);
  saturationValueLabel.textContent = saturationSlider.value;
  vibranceSlider.value = String(values.vibrance);
  vibranceValueLabel.textContent = vibranceSlider.value;
  grainSlider.value = values.grain.toFixed(2);
  grainValueLabel.textContent = values.grain.toFixed(2);
  grainSizeSlider.value = values.grainSize.toFixed(2);
  grainSizeValueLabel.textContent = values.grainSize.toFixed(2);
  acutanceSlider.value = values.acutance.toFixed(2);
  acutanceValueLabel.textContent = values.acutance.toFixed(2);
  softeningSlider.value = values.softening.toFixed(2);
  softeningValueLabel.textContent = values.softening.toFixed(2);
  paperTemperatureSlider.value = String(values.paperTemperature);
  paperTemperatureValueLabel.textContent = paperTemperatureSlider.value;

  if (!app) return;
  updateSceneGrade(app);
  app.device.queue.writeBuffer(
    app.exposureUniformBuffer,
    5 * 4,
    new Float32Array([parseFloat(exposureSlider.value)])
  );
  updateHalationIntensity(app, parseFloat(halationSlider.value));
  updateSaturationVibrance(app);
  updateGrainIntensity(app, parseFloat(grainSlider.value));
  if (app.imageWidth) updateGrainSize(app, app.imageWidth, parseFloat(grainSizeSlider.value));
  updateAcutanceAmount(app, parseFloat(acutanceSlider.value));
  updateSofteningAmount(app, parseFloat(softeningSlider.value));
  updatePrintTemperature(app, parseFloat(paperTemperatureSlider.value) / 100);
  renderCurrent();
}

function coercePresetNumber(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

/** Reconstruye un PresetValues válido a partir de JSON externo, sustituyendo por defecto cualquier campo ausente o corrupto. */
function parsePresetValues(raw: unknown): PresetValues {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    temperature: coercePresetNumber(obj.temperature, PRESET_DEFAULTS.temperature),
    tint: coercePresetNumber(obj.tint, PRESET_DEFAULTS.tint),
    exposure: coercePresetNumber(obj.exposure, PRESET_DEFAULTS.exposure),
    highlights: coercePresetNumber(obj.highlights, PRESET_DEFAULTS.highlights),
    shadows: coercePresetNumber(obj.shadows, PRESET_DEFAULTS.shadows),
    whites: coercePresetNumber(obj.whites, PRESET_DEFAULTS.whites),
    blacks: coercePresetNumber(obj.blacks, PRESET_DEFAULTS.blacks),
    halation: coercePresetNumber(obj.halation, PRESET_DEFAULTS.halation),
    saturation: coercePresetNumber(obj.saturation, PRESET_DEFAULTS.saturation),
    vibrance: coercePresetNumber(obj.vibrance, PRESET_DEFAULTS.vibrance),
    grain: coercePresetNumber(obj.grain, PRESET_DEFAULTS.grain),
    grainSize: coercePresetNumber(obj.grainSize, PRESET_DEFAULTS.grainSize),
    acutance: coercePresetNumber(obj.acutance, PRESET_DEFAULTS.acutance),
    softening: coercePresetNumber(obj.softening, PRESET_DEFAULTS.softening),
    paperTemperature: coercePresetNumber(obj.paperTemperature, PRESET_DEFAULTS.paperTemperature),
  };
}

async function exportPreset(): Promise<void> {
  const preset = collectCurrentPreset();
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const suggestedName = `${currentFileBaseName ?? "nw-film-preset"}.json`;
  await saveBlob(blob, suggestedName, "application/json", "Preset JSON");
}

async function importPresetFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = parsePresetValues(JSON.parse(text));
    applyPresetValues(parsed); // el preset se aplica entero; la intensidad se controla aparte, mezclando el resultado contra la foto original
    lookIntensitySlider.value = "100";
    lookIntensityValueLabel.textContent = "100";
    if (app) {
      updateLookIntensity(app, 1);
      renderCurrent();
    }
    setStatus("Preset importado.");
  } catch (err) {
    console.error(err);
    setStatus("No se pudo leer el preset (JSON inválido).");
  }
}

async function handleFile(file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    setStatus("El archivo no es una imagen.");
    return;
  }

  setStatus("Cargando imagen...");
  currentFileBaseName = file.name.replace(/\.[^./\\]+$/, "");

  try {
    const bitmap = await createImageBitmap(file);

    emptyState.hidden = true;
    canvasPanes.hidden = false;

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
    updateGrainSize(state, bitmap.width, parseFloat(grainSizeSlider.value));
    updateGrainIntensity(state, parseFloat(grainSlider.value));
    updateAcutanceBlurParams(state, bitmap.width, bitmap.height);
    updateAcutanceAmount(state, parseFloat(acutanceSlider.value));
    updateSofteningBlurParams(state, bitmap.width, bitmap.height);
    updateSofteningAmount(state, parseFloat(softeningSlider.value));
    updateSaturationVibrance(state);

    state.sourceTexture?.destroy();
    state.sourceTexture = createTextureFromBitmap(state.device, bitmap, "rgba8unorm");
    state.encodedTexture?.destroy();
    state.encodedTexture = state.device.createTexture({
      label: "encoded-final",
      size: [bitmap.width, bitmap.height],
      format: state.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    state.imageWidth = bitmap.width;
    state.imageHeight = bitmap.height;

    showOriginal = false;
    renderCurrent();
    fitToViewport();

    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error desconocido al procesar la imagen.");
  }
}

openButton.addEventListener("click", () => fileInput.click());
emptyState.addEventListener("click", () => fileInput.click());
exportButton.addEventListener("click", () => {
  exportCurrentImage().catch((err) => {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error al exportar la imagen.");
  });
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
  fileInput.value = ""; // permite volver a elegir el mismo archivo dos veces seguidas
});

presetImportButton.addEventListener("click", () => presetFileInput.click());
presetExportButton.addEventListener("click", () => {
  exportPreset().catch((err) => {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error al exportar el preset.");
  });
});

presetFileInput.addEventListener("change", () => {
  const file = presetFileInput.files?.[0];
  if (file) importPresetFile(file);
  presetFileInput.value = ""; // permite volver a importar el mismo archivo dos veces seguidas
});

lookIntensitySlider.addEventListener("input", () => {
  lookIntensityValueLabel.textContent = lookIntensitySlider.value;
  if (!app) return;
  updateLookIntensity(app, parseFloat(lookIntensitySlider.value) / 100);
  renderCurrent();
});

filmSelect.addEventListener("change", () => {
  // La nota/botones de película custom no dependen de que haya imagen
  // cargada (app puede ser null todavía) — el render sí.
  updateCustomFilmUi(getAnyFilm(filmSelect.value));
  if (!app) return;
  loadFilmIntoState(app, getAnyFilm(filmSelect.value));
  renderCurrent();
});

deleteFilmButton.addEventListener("click", () => {
  const film = getAnyFilm(filmSelect.value);
  if (!film.isCustom) return;
  if (!confirm(`¿Eliminar "${film.label}"? Esta acción no se puede deshacer.`)) return;
  removeCustomFilm(film.id);
  renderFilmSelectOptions(filmSelect, DEFAULT_FILM_ID);
  filmSelect.value = DEFAULT_FILM_ID;
  filmSelect.dispatchEvent(new Event("change", { bubbles: true }));
});

filmExportButton.addEventListener("click", () => {
  handleFilmExport().catch((err) => {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error al exportar la película.");
  });
});

filmImportButton.addEventListener("click", () => filmFileInput.click());
filmFileInput.addEventListener("change", () => {
  const file = filmFileInput.files?.[0];
  if (file) importFilmFile(file).catch((err) => console.error(err));
  filmFileInput.value = "";
});

createFilmButton.addEventListener("click", () => openCreateFilmOverlay());
createFilmClose.addEventListener("click", () => closeCreateFilmOverlay());
createFilmOverlay.addEventListener("click", (e) => {
  if (e.target === createFilmOverlay) closeCreateFilmOverlay();
});
createFilmChooseButton.addEventListener("click", () => createFilmFileInput.click());
createFilmFileInput.addEventListener("change", () => {
  const file = createFilmFileInput.files?.[0];
  if (!file) return;
  pendingFilmImageFile = file;
  if (pendingFilmPreviewUrl) URL.revokeObjectURL(pendingFilmPreviewUrl);
  pendingFilmPreviewUrl = URL.createObjectURL(file);
  createFilmPreview.innerHTML = "";
  const img = document.createElement("img");
  img.src = pendingFilmPreviewUrl;
  img.alt = "Foto de referencia";
  createFilmPreview.appendChild(img);
  createFilmAnalyzeButton.disabled = false;
  createFilmStatus.textContent = "";
});
createFilmAnalyzeButton.addEventListener("click", () => {
  handleCreateFilmAnalyze().catch((err) => {
    console.error(err);
    createFilmStatus.textContent = err instanceof Error ? err.message : "Error inesperado al crear la película.";
    createFilmAnalyzeButton.disabled = false;
  });
});

// El arrastre funciona sobre todo el visor, tanto sin imagen cargada como
// para reemplazar la imagen actual arrastrando una nueva encima.
viewportFrame.addEventListener("dragover", (e) => {
  e.preventDefault();
  viewportFrame.classList.add("dragover");
});

viewportFrame.addEventListener("dragleave", () => {
  viewportFrame.classList.remove("dragover");
});

viewportFrame.addEventListener("drop", (e) => {
  e.preventDefault();
  viewportFrame.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

function makeSceneGradeSliderHandler(slider: HTMLInputElement, label: HTMLSpanElement): () => void {
  return () => {
    label.textContent = slider.value;
    if (!app) return;
    updateSceneGrade(app);
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
  renderCurrent();
});

grainSlider.addEventListener("input", () => {
  const multiplier = parseFloat(grainSlider.value);
  grainValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateGrainIntensity(app, multiplier);
  renderCurrent();
});

grainSizeSlider.addEventListener("input", () => {
  const multiplier = parseFloat(grainSizeSlider.value);
  grainSizeValueLabel.textContent = multiplier.toFixed(2);
  if (!app || !app.imageWidth) return;
  updateGrainSize(app, app.imageWidth, multiplier);
  renderCurrent();
});

acutanceSlider.addEventListener("input", () => {
  const multiplier = parseFloat(acutanceSlider.value);
  acutanceValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateAcutanceAmount(app, multiplier);
  renderCurrent();
});

softeningSlider.addEventListener("input", () => {
  const multiplier = parseFloat(softeningSlider.value);
  softeningValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateSofteningAmount(app, multiplier);
  renderCurrent();
});

halationSlider.addEventListener("input", () => {
  const multiplier = parseFloat(halationSlider.value);
  halationValueLabel.textContent = multiplier.toFixed(2);
  if (!app) return;
  updateHalationIntensity(app, multiplier);
  renderCurrent();
});

function handleSaturationVibranceInput(): void {
  saturationValueLabel.textContent = saturationSlider.value;
  vibranceValueLabel.textContent = vibranceSlider.value;
  if (!app) return;
  updateSaturationVibrance(app);
  renderCurrent();
}

saturationSlider.addEventListener("input", handleSaturationVibranceInput);
vibranceSlider.addEventListener("input", handleSaturationVibranceInput);

paperTemperatureSlider.addEventListener("input", () => {
  const value = parseFloat(paperTemperatureSlider.value);
  paperTemperatureValueLabel.textContent = paperTemperatureSlider.value;
  if (!app) return;
  updatePrintTemperature(app, value / 100);
  renderCurrent();
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

sideBySideToggleButton.addEventListener("click", () => {
  sideBySide = !sideBySide;
  canvasPanes.classList.toggle("side-by-side", sideBySide);
  sideBySideToggleButton.classList.toggle("active", sideBySide);
  updateVisibleLayer();
  fitToViewport();
});

filmGridToggleButton.addEventListener("click", () => {
  openFilmGrid().catch((err) => {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Error al generar la cuadrícula.");
    closeFilmGrid();
  });
});

filmGridClose.addEventListener("click", () => closeFilmGrid());

filmGridOverlay.addEventListener("click", (e) => {
  if (e.target === filmGridOverlay) closeFilmGrid();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !filmGridOverlay.hidden) closeFilmGrid();
  if (e.key === "Escape" && !createFilmOverlay.hidden) closeCreateFilmOverlay();
});

// Pinch en trackpad: los navegadores lo entregan como evento "wheel" con
// ctrlKey activo (así distingue el gesto de pellizco del scroll normal de
// dos dedos). preventDefault evita que el navegador haga zoom de página.
viewportFrame.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoomPercent(zoomPercent - e.deltaY * 2);
  },
  { passive: false }
);

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

// Botones de reset: cada uno apunta a un slider (data-reset) y a su valor
// por defecto (data-default). Reutiliza el listener "input" que cada
// slider ya tiene — no duplica la lógica de actualización de cada control.
document.querySelectorAll<HTMLButtonElement>(".reset-btn").forEach((button) => {
  const targetId = button.dataset.reset;
  const defaultValue = button.dataset.default;
  if (!targetId || defaultValue === undefined) return;
  const slider = document.getElementById(targetId) as HTMLInputElement | null;
  if (!slider) return;

  button.addEventListener("click", () => {
    slider.value = defaultValue;
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
});

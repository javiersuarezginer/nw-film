import type { Pass } from "./passes/Pass";

const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : s ? -Infinity : Infinity;
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

interface PipelineStep {
  pass: Pass;
  inputs: string[];
  output: string;
}

/**
 * Orquesta la ejecución del pipeline de revelado como un grafo de
 * texturas con nombre (no una simple cadena lineal): algunos passes,
 * como el halation, necesitan volver a leer una textura de un paso
 * anterior (la escena original) además de la salida del paso previo.
 *
 * `addStep(pass, inputs, output)` — `inputs` son nombres de textura
 * ('source' es la imagen original); `output` es un nombre de textura o
 * 'canvas' para el resultado final en pantalla.
 */
export class Pipeline {
  private device: GPUDevice;
  private intermediateFormat: GPUTextureFormat;
  private steps: PipelineStep[] = [];
  private textures = new Map<string, GPUTexture>();
  private size = { width: 0, height: 0 };

  constructor(device: GPUDevice, intermediateFormat: GPUTextureFormat = "rgba16float") {
    this.device = device;
    this.intermediateFormat = intermediateFormat;
  }

  addStep(pass: Pass, inputs: string[], output: string): void {
    this.steps.push({ pass, inputs, output });
  }

  private ensureTexturesForSize(width: number, height: number): void {
    if (this.size.width === width && this.size.height === height) return;
    for (const texture of this.textures.values()) texture.destroy();
    this.textures.clear();
    this.size = { width, height };
  }

  private getOrCreateTexture(name: string, width: number, height: number): GPUTexture {
    let texture = this.textures.get(name);
    if (!texture) {
      texture = this.device.createTexture({
        label: `pipeline-${name}`,
        size: [width, height],
        format: this.intermediateFormat,
        // COPY_SRC además de lo básico: el render riguroso necesita poder
        // leer de vuelta a la CPU la textura de densidad (ver
        // readTextureRGBA16F). Barato de tener siempre disponible.
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });
      this.textures.set(name, texture);
    }
    return texture;
  }

  render(source: GPUTexture, canvasContext?: GPUCanvasContext): void {
    if (this.steps.length === 0) {
      throw new Error("El pipeline no tiene ningún pass añadido.");
    }

    this.ensureTexturesForSize(source.width, source.height);

    const encoder = this.device.createCommandEncoder({ label: "pipeline-encoder" });

    for (const step of this.steps) {
      const inputTextures = step.inputs.map((name) =>
        name === "source" ? source : this.getOrCreateTexture(name, source.width, source.height)
      );
      if (step.output === "canvas" && !canvasContext) {
        throw new Error(`El paso "${step.pass.label}" escribe a "canvas" pero no se pasó canvasContext.`);
      }
      const outputView =
        step.output === "canvas"
          ? canvasContext!.getCurrentTexture().createView()
          : this.getOrCreateTexture(step.output, source.width, source.height).createView();

      step.pass.execute(encoder, inputTextures, outputView);
    }

    this.device.queue.submit([encoder.finish()]);
  }

  /**
   * Ejecuta un pass "suelto" (no parte de la cadena fija) leyendo
   * texturas internas ya calculadas y escribiendo directo al canvas.
   * Pensado para etapas finales conmutables — por ejemplo, comparar la
   * simulación de papel/escáner activada o desactivada sin tener que
   * recalcular el resto del pipeline.
   */
  displayFinal(pass: Pass, inputNames: string[], canvasContext: GPUCanvasContext): void {
    const inputTextures = inputNames.map((name) =>
      this.getOrCreateTexture(name, this.size.width, this.size.height)
    );
    const encoder = this.device.createCommandEncoder({ label: "pipeline-final-encoder" });
    pass.execute(encoder, inputTextures, canvasContext.getCurrentTexture().createView());
    this.device.queue.submit([encoder.finish()]);
  }

  /**
   * Lee de vuelta a la CPU una textura interna ya calculada (formato
   * rgba16float). Pensado para pasarle datos de densidad al Web Worker
   * del render riguroso — algo que solo hace falta al pulsar "Renderizar",
   * no en cada frame del preview en tiempo real.
   */
  async readTextureRGBA16F(name: string): Promise<{ data: Float32Array; width: number; height: number }> {
    const texture = this.textures.get(name);
    if (!texture) throw new Error(`No existe la textura "${name}" en el pipeline.`);

    const { width, height } = this.size;
    const bytesPerPixel = 8; // rgba16float
    const unpaddedBytesPerRow = width * bytesPerPixel;
    const paddedBytesPerRow =
      Math.ceil(unpaddedBytesPerRow / COPY_BYTES_PER_ROW_ALIGNMENT) * COPY_BYTES_PER_ROW_ALIGNMENT;

    const readbackBuffer = this.device.createBuffer({
      label: `readback-${name}`,
      size: paddedBytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = this.device.createCommandEncoder({ label: `readback-${name}-encoder` });
    encoder.copyTextureToBuffer({ texture }, { buffer: readbackBuffer, bytesPerRow: paddedBytesPerRow }, [
      width,
      height,
    ]);
    this.device.queue.submit([encoder.finish()]);

    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const mapped = new Uint16Array(readbackBuffer.getMappedRange());

    const out = new Float32Array(width * height * 4);
    const paddedU16PerRow = paddedBytesPerRow / 2;
    for (let y = 0; y < height; y++) {
      const rowStart = y * paddedU16PerRow;
      for (let x = 0; x < width; x++) {
        const srcIdx = rowStart + x * 4;
        const dstIdx = (y * width + x) * 4;
        out[dstIdx] = halfToFloat(mapped[srcIdx]);
        out[dstIdx + 1] = halfToFloat(mapped[srcIdx + 1]);
        out[dstIdx + 2] = halfToFloat(mapped[srcIdx + 2]);
        out[dstIdx + 3] = halfToFloat(mapped[srcIdx + 3]);
      }
    }

    readbackBuffer.unmap();
    readbackBuffer.destroy();

    return { data: out, width, height };
  }
}

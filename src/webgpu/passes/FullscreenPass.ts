import type { Pass } from "./Pass";

/**
 * Pass genérico: pinta un triángulo a pantalla completa muestreando una
 * textura de entrada, ejecutando el shader indicado, y escribiendo en la
 * vista de salida. Sirve de base para todos los passes de post-proceso
 * del pipeline (este y los que vengan en fases siguientes).
 */
export class FullscreenPass implements Pass {
  readonly label: string;

  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private sampler: GPUSampler;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    shaderCode: string,
    label: string,
    private readonly extraEntries: GPUBindGroupEntry[] = []
  ) {
    this.label = label;
    this.device = device;

    const module = device.createShaderModule({ label: `${label}-shader`, code: shaderCode });

    this.pipeline = device.createRenderPipeline({
      label: `${label}-pipeline`,
      layout: "auto",
      vertex: { module, entryPoint: "vs_main" },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  execute(encoder: GPUCommandEncoder, inputs: GPUTexture[], output: GPUTextureView): void {
    const bindGroup = this.device.createBindGroup({
      label: `${this.label}-bindgroup`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputs[0].createView() },
        { binding: 1, resource: this.sampler },
        ...this.extraEntries,
      ],
    });

    const pass = encoder.beginRenderPass({
      label: `${this.label}-renderpass`,
      colorAttachments: [
        {
          view: output,
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }
}

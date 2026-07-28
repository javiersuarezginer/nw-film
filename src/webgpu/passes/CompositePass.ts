import type { Pass } from "./Pass";

/**
 * Pass que combina DOS texturas de entrada (por ejemplo: escena base +
 * halo de halation ya difuminado) en una salida. A diferencia de
 * FullscreenPass, ambas entradas son dinámicas (cambian con cada imagen),
 * así que cada una tiene su propio par textura+sampler en el bind group.
 */
export class CompositePass implements Pass {
  readonly label: string;

  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private samplerA: GPUSampler;
  private samplerB: GPUSampler;

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

    this.samplerA = device.createSampler({ magFilter: "linear", minFilter: "linear" });
    this.samplerB = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  }

  execute(encoder: GPUCommandEncoder, inputs: GPUTexture[], output: GPUTextureView): void {
    const [a, b] = inputs;

    const bindGroup = this.device.createBindGroup({
      label: `${this.label}-bindgroup`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: a.createView() },
        { binding: 1, resource: this.samplerA },
        { binding: 2, resource: b.createView() },
        { binding: 3, resource: this.samplerB },
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

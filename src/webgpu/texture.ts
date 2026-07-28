export function createTextureFromBitmap(
  device: GPUDevice,
  bitmap: ImageBitmap,
  format: GPUTextureFormat
): GPUTexture {
  const texture = device.createTexture({
    label: "source-image",
    size: [bitmap.width, bitmap.height],
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [bitmap.width, bitmap.height]
  );

  return texture;
}

/** Sube una LUT 1D (guardada como textura width×1 rgba32float) a la GPU. */
export function createLUTTexture(device: GPUDevice, data: Float32Array, width: number): GPUTexture {
  const texture = device.createTexture({
    label: "curve-lut",
    size: [width, 1],
    format: "rgba32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    data.buffer as ArrayBuffer,
    { bytesPerRow: width * 4 * 4 },
    [width, 1]
  );

  return texture;
}

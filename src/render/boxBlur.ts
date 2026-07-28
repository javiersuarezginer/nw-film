/**
 * Blur de caja separable, por canal, sobre un buffer de densidad
 * `[w*h*4]`. Se usa como aproximación barata del blur gaussiano para la
 * acutancia en el render riguroso (CPU) — la vía GPU en tiempo real ya
 * usa un gaussiano de verdad; en CPU, con radios tan pequeños, un blur
 * de caja da un resultado visualmente equivalente a mucho menor coste.
 */
export function boxBlurChannel(
  src: Float32Array,
  width: number,
  height: number,
  channelIndex: number,
  radiusPx: number,
  out: Float32Array
): void {
  const r = Math.max(1, Math.round(radiusPx));
  const tmp = new Float32Array(width * height);

  // Horizontal
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const rowBase = y * width;
    for (let x = -r; x <= r; x++) {
      const xi = Math.min(width - 1, Math.max(0, x));
      sum += src[(rowBase + xi) * 4 + channelIndex];
    }
    for (let x = 0; x < width; x++) {
      tmp[rowBase + x] = sum / (2 * r + 1);
      const addX = Math.min(width - 1, x + r + 1);
      const subX = Math.max(0, x - r);
      sum += src[(rowBase + addX) * 4 + channelIndex] - src[(rowBase + subX) * 4 + channelIndex];
    }
  }

  // Vertical
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const yi = Math.min(height - 1, Math.max(0, y));
      sum += tmp[yi * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[(y * width + x) * 4 + channelIndex] = sum / (2 * r + 1);
      const addY = Math.min(height - 1, y + r + 1);
      const subY = Math.max(0, y - r);
      sum += tmp[addY * width + x] - tmp[subY * width + x];
    }
  }
}

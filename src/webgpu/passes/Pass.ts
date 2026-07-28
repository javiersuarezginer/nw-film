/**
 * Contrato común de una etapa del pipeline de revelado.
 * Cada pass recibe una o varias texturas de entrada (por ejemplo, halation
 * necesita la escena original + el halo ya difuminado) y pinta el
 * resultado sobre una vista de salida. Añadir un pass nuevo = implementar
 * esta interfaz + insertarlo en Pipeline con sus nombres de textura.
 */
export interface Pass {
  readonly label: string;
  execute(encoder: GPUCommandEncoder, inputs: GPUTexture[], output: GPUTextureView): void;
}

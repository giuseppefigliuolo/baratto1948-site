/** Seal dimensions and the worker's output, shared by the worker (seal.compute.ts) and the renderer. */
export const T = 0.14; // coin thickness
export const R = 0.036; // letter relief
export const N = 1024; // heightmap resolution
export const M = 512; // colour / bump map resolution

export interface SealBuild {
  /** RGBA, M², rows bottom-up (uploaded without flipY) */
  color: Uint8ClampedArray;
  bump: Uint8ClampedArray;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
}

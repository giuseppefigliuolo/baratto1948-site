/** Seal relief + maps off the main thread (see seal.compute.ts). One message in, one out, buffers transferred. */
import { buildSeal } from './seal.compute';

self.onmessage = (e: MessageEvent<Uint8ClampedArray>) => {
  const b = buildSeal(e.data);
  (self as unknown as Worker).postMessage(b, [b.color.buffer, b.bump.buffer, b.position.buffer, b.normal.buffer, b.uv.buffer, b.index.buffer]);
};

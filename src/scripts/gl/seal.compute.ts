/**
 * Seal: the CPU-heavy, DOM-free part (logo relief, procedural maps, face mesh).
 * Runs in a Web Worker (seal.worker.ts) so the hero never waits on it; seal.ts falls back to calling it
 * on the main thread when workers are unavailable. Same maths as the original in-page version.
 */

export const T = 0.14; // coin thickness
export const R = 0.036; // letter relief
export const N = 1024; // heightmap resolution
export const M = 512; // colour / bump map resolution
const S = 440; // face grid segments

export interface SealBuild {
  /** RGBA, M², rows already flipped for a non-flipY DataTexture */
  color: Uint8ClampedArray;
  bump: Uint8ClampedArray;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** @param rgba logo drawn at N² (ImageData.data): only the alpha channel is read */
export function buildSeal(rgba: Uint8ClampedArray): SealBuild {
  const alpha = logoAlpha(rgba);
  const { position, normal, uv, index } = faceMesh(alpha);
  return { color: colorMap(alpha), bump: bumpMap(), position, normal, uv, index };
}

/** Logo alpha at N², blurred (~2.2 px) so the relief has soft shoulders. */
function logoAlpha(d: Uint8ClampedArray) {
  let a = new Float32Array(N * N), b = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] / 255;
  // 3 box passes (r=2) per axis ≈ gaussian σ 2.4
  const r = 2, k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (const horiz of [true, false]) {
      for (let j = 0; j < N; j++) {
        let s = 0;
        const at = (i: number) => a[horiz ? j * N + clamp(i, 0, N - 1) : clamp(i, 0, N - 1) * N + j];
        for (let i = -r; i <= r; i++) s += at(i);
        for (let i = 0; i < N; i++) {
          b[horiz ? j * N + i : i * N + j] = s * k;
          s += at(i + r + 1) - at(i - r);
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

/**
 * Relief face: a dense plane displaced by the logo alpha, trimmed to the unit disc. Laid out like three's
 * PlaneGeometry(2, 2, S, S) (vertex order, winding, uv), normals as BufferGeometry.computeVertexNormals.
 */
function faceMesh(alpha: Float32Array) {
  const g1 = S + 1, count = g1 * g1;
  const position = new Float32Array(count * 3), uv = new Float32Array(count * 2), normal = new Float32Array(count * 3);
  for (let iy = 0; iy < g1; iy++) {
    for (let ix = 0; ix < g1; ix++) {
      const v = iy * g1 + ix;
      position[v * 3] = ix * (2 / S) - 1;
      position[v * 3 + 1] = -(iy * (2 / S) - 1);
      uv[v * 2] = ix / S;
      uv[v * 2 + 1] = 1 - iy / S;
    }
  }
  for (let i = 0; i < count; i++) {
    const u = clamp(Math.round(((position[i * 3] + 1) / 2) * (N - 1)), 0, N - 1);
    const v = clamp(Math.round(((1 - position[i * 3 + 1]) / 2) * (N - 1)), 0, N - 1);
    position[i * 3 + 2] = T / 2 + R * alpha[v * N + u];
  }
  const keep: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    const cx = (position[a * 3] + position[b * 3] + position[c * 3]) / 3;
    const cy = (position[a * 3 + 1] + position[b * 3 + 1] + position[c * 3 + 1]) / 3;
    if (cx * cx + cy * cy <= 1) keep.push(a, b, c);
  };
  for (let iy = 0; iy < S; iy++) {
    for (let ix = 0; ix < S; ix++) {
      const a = ix + g1 * iy, b = ix + g1 * (iy + 1), c = ix + 1 + g1 * (iy + 1), d = ix + 1 + g1 * iy;
      tri(a, b, d);
      tri(b, c, d);
    }
  }
  const index = Uint32Array.from(keep);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const cbx = position[c] - position[b], cby = position[c + 1] - position[b + 1], cbz = position[c + 2] - position[b + 2];
    const abx = position[a] - position[b], aby = position[a + 1] - position[b + 1], abz = position[a + 2] - position[b + 2];
    const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
    for (const o of [a, b, c]) { normal[o] += nx; normal[o + 1] += ny; normal[o + 2] += nz; }
  }
  for (let i = 0; i < count; i++) {
    const o = i * 3, l = Math.hypot(normal[o], normal[o + 1], normal[o + 2]) || 1;
    normal[o] /= l; normal[o + 1] /= l; normal[o + 2] /= l;
  }
  return { position, normal, uv, index };
}

const hash = (x: number, y: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number) =>
  vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 7, y * 2.03 + 3) * 0.25 + vnoise(x * 4.1 + 13, y * 4.1 + 17) * 0.125 + vnoise(x * 8.3 + 5, y * 8.3 + 11) * 0.0625;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** M² RGBA, written bottom-up: a DataTexture is not flipped on upload, a canvas texture is. */
function pixels(fill: (i: number, j: number, out: number[]) => void) {
  const px = new Uint8ClampedArray(M * M * 4), c = [0, 0, 0]; // clamped, like the canvas ImageData it replaces
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    fill(i, j, c);
    const o = ((M - 1 - j) * M + i) * 4;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  return px;
}

/** Patinated bronze: warm base, green patina in the field only, letters worn lighter. */
function colorMap(alpha: Float32Array) {
  const base = [0x5c, 0x4a, 0x32], patch = [0x66, 0x70, 0x5a], wear = [0x96, 0x77, 0x4b];
  return pixels((i, j, out) => {
    const u = i / M, v = j / M, h = alpha[j * 2 * N + i * 2];
    const n = fbm(u * 5, v * 5), n2 = fbm(u * 11 + 4, v * 11 + 9);
    const pt = clamp((n2 - 0.52) / 0.18, 0, 1) * (1 - h) * 0.7;
    const sh = 0.9 + n * 0.2;
    for (let k = 0; k < 3; k++) out[k] = mix(mix(base[k], patch[k], pt), wear[k], h * 0.85) * sh;
  });
}

/** Fine cast-metal grain. */
function bumpMap() {
  return pixels((i, j, out) => {
    const s = (vnoise((i / M) * 120, (j / M) * 120) * 0.5 + hash(i, j) * 0.5) * 255;
    out[0] = out[1] = out[2] = s;
  });
}

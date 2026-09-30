/** Minimal WebGL1 helpers (replaces three.js: ~150 KB → a few KB). */

export type GL = WebGLRenderingContext;

export function context(canvas: HTMLCanvasElement, opts: WebGLContextAttributes = {}): GL | null {
  return canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', ...opts }) as GL | null;
}

export function program(gl: GL, vs: string, fs: string) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[gl] shader link failed:', gl.getProgramInfoLog(p));
    return null;
  }
  gl.useProgram(p);
  const u = (name: string) => gl.getUniformLocation(p, name);
  return { p, u };
}

/** Upload an image/bitmap as a non-mipmapped, clamped texture (NPOT-safe). Y is flipped in shaders. */
export function texture(gl: GL, src: TexImageSource): WebGLTexture | null {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  } catch {
    return null;
  }
  return t;
}

/** Fullscreen quad bound to attribute `p` (clip-space -1..1). */
export function quad(gl: GL, prog: WebGLProgram) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

/** Resolve once an <img> has decoded pixels. */
export function loaded(img: HTMLImageElement): Promise<HTMLImageElement> {
  if (img.complete && img.naturalWidth) return Promise.resolve(img);
  return new Promise((res, rej) => {
    img.addEventListener('load', () => res(img), { once: true });
    img.addEventListener('error', rej, { once: true });
  });
}

/** Decode off the main thread when possible. */
export async function bitmap(url: string): Promise<TexImageSource> {
  const blob = await (await fetch(url)).blob();
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return img;
}

export const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;
/** Device-pixel cap: phones don't need 3x for a distorted photo. */
export const dpr = () => Math.min(touch ? 1.5 : 1.75, devicePixelRatio || 1);

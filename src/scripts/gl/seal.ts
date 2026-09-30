/**
 * Hero seal: the Baratto stamp printed on the cloth in the photo becomes a patinated bronze coin
 * that materialises in register with the print, lifts off (+18% apparent size) and follows the
 * pointer (desktop) or device tilt (phones), with a soft shadow left on the cloth. It can be spun by
 * dragging (mouse or finger), with momentum, and settles face-on again.
 *
 * The only three.js module on the site (see ARCHITECTURE §9, §13). Ported from the design's
 * `seal-reference.js`, "lift" mode, "bronze" finish only.
 */
import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, type Texture
} from 'three';
import logoUrl from '../../assets/brand/logo.png?url';
import { clamp, fine, lerp, setStyle } from '../core/dom';
import { subscribe } from '../core/loop';

interface Opts {
  /** resolves to the `performance.now()` at which the timeline starts (hero photo on screen) */
  start: Promise<number>;
  /** no motion: render once in the final pose */
  still?: boolean;
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const T = 0.14; // coin thickness
const R = 0.036; // letter relief
const FOV = 18;
const FRAME = 2.4; // half-height of the view at z=0: coin diameter (2) = printed stamp diameter
const CAM_Z = FRAME / Math.tan(((FOV / 2) * Math.PI) / 180);
const LIFT = CAM_Z * (1 - 1 / (1.18 * 0.97)); // z at rest: +14.5% apparent size (design's +18%, less 3%)

export async function seal(frameEl: HTMLElement, opts: Opts) {
  const host = frameEl.querySelector<HTMLElement>('[data-seal-host]');
  const shadow = frameEl.querySelector<HTMLElement>('[data-seal-shadow]');
  const hit = frameEl.querySelector<HTMLElement>('[data-seal-hit]');
  const hero = frameEl.closest<HTMLElement>('[data-cover]');
  if (!host || !hero) return;

  const img = await load(logoUrl);
  const alpha = logoAlpha(img);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement;
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);

  const scene = new Scene();
  scene.environment = envFor(renderer);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const map = colorMap(alpha);
  const bump = bumpMap();
  const mat = (roughness: number) => new MeshStandardMaterial({
    map, metalness: 0.25, roughness, bumpMap: bump, bumpScale: 0.5, envMapIntensity: 0.3,
    transparent: true, opacity: opts.still ? 1 : 0
  });
  const face = mat(0.88), edge = mat(0.91);

  const coin = new Group();
  coin.add(new Mesh(faceGeometry(alpha), face));
  const rim = new Mesh(new CylinderGeometry(1.006, 1.006, T + R, 180, 1, true), edge);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = R / 2;
  coin.add(rim);
  const back = new Mesh(new CircleGeometry(1.006, 180), edge);
  back.rotation.y = Math.PI;
  back.position.z = -T / 2;
  coin.add(back);
  scene.add(coin);

  const key = new DirectionalLight(0xffe4bd, 2.8);
  key.position.set(0.6, 3, 4);
  scene.add(key);
  scene.add(new AmbientLight(0x2a2018, 0.6));

  // Pointer (or tilt) in [-1, 1], relative to the hero.
  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  // Drag spin, added on top of the pose (radians).
  const sp = { x: 0, y: 0 };
  let live = false;

  // pose(t): t in seconds since the timeline start; lf forces the lift (still mode)
  const pose = (t: number, lf?: number) => {
    const f = lf ?? smoother(clamp((t - 0.6) / 2.6, 0, 1));
    const lr = clamp((t - 1.8) / 5.8, 0, 1);
    const l = lf ?? smoother(smoother(lr) * 0.35 + (1 - Math.pow(1 - lr, 3)) * 0.65);
    const sway = lf == null ? 1 : 0;
    face.opacity = edge.opacity = f;
    coin.position.z = LIFT * l;
    coin.rotation.x = l * (-0.34 + sway * Math.sin(t * 0.4) * 0.05 + m.y * 0.22) + sp.x;
    coin.rotation.y = l * (0.2 + sway * Math.sin(t * 0.3) * 0.08 + m.x * 0.3) + sp.y;
    if (!live && hit && f > 0.5) { live = true; hit.classList.add('is-live'); }
    key.position.x = 0.6 + m.x * 2.4;
    key.position.y = 3 - m.y * 1.5;
    if (shadow) {
      setStyle(shadow, 'opacity', (0.8 * l).toFixed(3));
      // A coin turned edge-on casts a narrower shadow.
      const s = 1 + 0.15 * l, sx = s * (0.3 + 0.7 * Math.abs(Math.cos(sp.y))), sy = s * (0.3 + 0.7 * Math.abs(Math.cos(sp.x)));
      setStyle(shadow, 'transform', `translate(-50%,-50%) translate(${(5 * l).toFixed(2)}%,${(11 * l).toFixed(2)}%) scale(${sx.toFixed(3)},${sy.toFixed(3)})`);
    }
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = host.clientWidth || 1;
    renderer.setSize(w, w, false); // the host is square
  };
  resize();

  const start = await opts.start;
  if (opts.still) {
    new ResizeObserver(() => { resize(); pose(0, 1); }).observe(host);
    pose(0, 1);
    return;
  }

  new ResizeObserver(resize).observe(host);

  if (fine()) {
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      m.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      m.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    }, { passive: true });
    hero.addEventListener('mouseleave', () => { m.tx = m.ty = 0; });
  } else {
    tilt(m);
  }

  const spin = hit ? spinner(hit, sp) : null;

  // A late start (slow device) begins at the fade-in rather than popping in half-way.
  const t0 = Math.max(start, performance.now() - 600);
  let last = 0;
  subscribe((fr) => {
    const dt = last ? fr.now - last : 1000 / 60;
    last = fr.now;
    // The sheet covers the sticky hero after one viewport: stop drawing.
    if (fr.y >= fr.vh) return;
    m.x += (m.tx - m.x) * 0.05;
    m.y += (m.ty - m.y) * 0.05;
    spin?.(dt);
    pose((fr.now - t0) / 1000);
  });
}

/**
 * Drag to spin: the coin follows the pointer with a soft lag, keeps its momentum on release,
 * then settles face-on (nearest full turn) while the forward/back tilt springs back to 0.
 * Returns the per-frame step (dt in ms), which writes the smoothed angles into `out`. Rates are per 60 Hz frame.
 */
function spinner(hit: HTMLElement, out: { x: number; y: number }) {
  const TURN = Math.PI * 2, MAXV = 0.6;
  const s = { tx: 0, ty: 0, vx: 0, vy: 0, dx: 0, dy: 0, px: 0, py: 0, id: -1 };
  hit.addEventListener('pointerdown', (e) => {
    if (s.id !== -1 || e.button > 0) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection / image drag
    s.id = e.pointerId; s.px = e.clientX; s.py = e.clientY; s.vx = s.vy = 0;
    hit.setPointerCapture(e.pointerId);
    hit.classList.add('is-grabbing');
  });
  hit.addEventListener('pointermove', (e) => {
    if (e.pointerId !== s.id) return;
    const k = Math.PI / Math.max(1, hit.clientWidth); // across the coin ≈ half a turn
    s.dx += (e.clientX - s.px) * k;
    s.dy += (e.clientY - s.py) * k;
    s.px = e.clientX; s.py = e.clientY;
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== s.id) return;
    s.id = -1;
    hit.classList.remove('is-grabbing');
  };
  hit.addEventListener('pointerup', up);
  hit.addEventListener('pointercancel', up); // e.g. the browser took over a vertical scroll

  return (dt: number) => {
    const k = clamp(dt / (1000 / 60), 0.25, 4);
    const decay = (r: number) => Math.pow(r, k), ease = (a: number) => 1 - Math.pow(1 - a, k);
    if (s.id !== -1) {
      s.ty += s.dx;
      s.tx = clamp(s.tx + s.dy, -1.1, 1.1);
      s.vy = lerp(s.vy, s.dx / k, ease(0.5)); // velocity per 60 Hz frame
      s.vx = lerp(s.vx, s.dy / k, ease(0.5));
      s.dx = s.dy = 0;
    } else {
      s.vy = clamp(s.vy, -MAXV, MAXV) * decay(0.94);
      s.vx = clamp(s.vx, -MAXV, MAXV) * decay(0.85);
      s.ty += s.vy * k;
      s.tx = clamp(s.tx + s.vx * k, -1.1, 1.1) * decay(0.92);
      if (Math.abs(s.vy) < 0.02) s.ty += (Math.round(s.ty / TURN) * TURN - s.ty) * ease(0.05);
    }
    out.x = lerp(out.x, s.tx, ease(0.18));
    out.y = lerp(out.y, s.ty, ease(0.18));
  };
}

/** Phones: device tilt relative to the first reading. iOS asks for permission on the first tap. */
function tilt(m: { tx: number; ty: number }) {
  let b0: number | null = null, g0 = 0;
  const on = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (b0 == null) { b0 = e.beta; g0 = e.gamma; }
    m.tx = clamp((e.gamma - g0) / 20, -1, 1);
    m.ty = clamp((e.beta - b0) / 20, -1, 1);
  };
  const DOE = (window as any).DeviceOrientationEvent as { requestPermission?: () => Promise<string> } | undefined;
  if (!DOE) return;
  if (typeof DOE.requestPermission !== 'function') {
    addEventListener('deviceorientation', on, { passive: true });
    return;
  }
  const ask = () => {
    removeEventListener('touchend', ask);
    DOE.requestPermission!().then((s) => { if (s === 'granted') addEventListener('deviceorientation', on, { passive: true }); }).catch(() => {});
  };
  addEventListener('touchend', ask, { passive: true });
}

// ---------- assets ----------

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

const N = 1024; // heightmap resolution
const M = 512; // colour / bump map resolution

/** Logo alpha at N², blurred (~2.2 px) so the relief has soft shoulders. JS blur: ctx.filter isn't everywhere. */
function logoAlpha(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;
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

/** Relief face: a dense plane displaced by the logo alpha, trimmed to the unit disc. */
function faceGeometry(alpha: Float32Array) {
  const S = 440;
  const g = new PlaneGeometry(2, 2, S, S), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = clamp(Math.round(((p.getX(i) + 1) / 2) * (N - 1)), 0, N - 1);
    const v = clamp(Math.round(((1 - p.getY(i)) / 2) * (N - 1)), 0, N - 1);
    p.setZ(i, T / 2 + R * alpha[v * N + u]);
  }
  const idx = g.index!.array, keep: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const A = idx[i], B = idx[i + 1], C = idx[i + 2];
    const cx = (p.getX(A) + p.getX(B) + p.getX(C)) / 3, cy = (p.getY(A) + p.getY(B) + p.getY(C)) / 3;
    if (cx * cx + cy * cy <= 1) keep.push(A, B, C);
  }
  g.setIndex(keep);
  g.computeVertexNormals();
  return g;
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

function canvasMap(fill: (i: number, j: number) => [number, number, number]) {
  const c = document.createElement('canvas');
  c.width = c.height = M;
  const x = c.getContext('2d')!, d = x.createImageData(M, M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const o = (j * M + i) * 4, [r, g, b] = fill(i, j);
    d.data[o] = r; d.data[o + 1] = g; d.data[o + 2] = b; d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return new CanvasTexture(c);
}

/** Patinated bronze: warm base, green patina in the field only, letters worn lighter. */
function colorMap(alpha: Float32Array): Texture {
  const base = [0x5c, 0x4a, 0x32], patch = [0x66, 0x70, 0x5a], wear = [0x96, 0x77, 0x4b];
  const tex = canvasMap((i, j) => {
    const u = i / M, v = j / M, h = alpha[j * 2 * N + i * 2];
    const n = fbm(u * 5, v * 5), n2 = fbm(u * 11 + 4, v * 11 + 9);
    const pt = clamp((n2 - 0.52) / 0.18, 0, 1) * (1 - h) * 0.7;
    const sh = 0.9 + n * 0.2;
    return [0, 1, 2].map((k) => mix(mix(base[k], patch[k], pt), wear[k], h * 0.85) * sh) as [number, number, number];
  });
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Fine cast-metal grain. */
function bumpMap(): Texture {
  return canvasMap((i, j) => {
    const s = (vnoise((i / M) * 120, (j / M) * 120) * 0.5 + hash(i, j) * 0.5) * 255;
    return [s, s, s];
  });
}

/** Small warm studio for reflections: five emissive panels, prefiltered once. */
function envFor(renderer: WebGLRenderer) {
  const pm = new PMREMGenerator(renderer), es = new Scene();
  es.background = new Color(0x0b0908);
  const add = (w: number, h: number, pos: [number, number, number], col: number, k: number) => {
    const mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(col).multiplyScalar(k), side: DoubleSide }));
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    es.add(mesh);
  };
  add(5, 5, [0, 7, 5], 0xffe0b0, 4.5);
  add(12, 1.6, [-8, 2, 3], 0xfff0da, 1.6);
  add(1.6, 12, [8, -1, 4], 0xc2a36b, 1.2);
  add(10, 10, [0, -7, 5], 0x3b2b1c, 1.2);
  add(20, 20, [0, 0, -9], 0x1a1410, 1);
  const t = pm.fromScene(es, 0.035).texture;
  pm.dispose();
  return t;
}

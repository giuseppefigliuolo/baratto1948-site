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
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry,
  DataTexture, DirectionalLight, DoubleSide, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RGBAFormat, Scene, SRGBColorSpace,
  WebGLRenderer, type Texture
} from 'three';
import logoUrl from '../../assets/brand/logo.png?url';
import { clamp, damp, fine, lerp, setStyle } from '../core/dom';
import { subscribe } from '../core/loop';
import { buildSeal, M, N, R, T, type SealBuild } from './seal.compute';

interface Opts {
  /** resolves to the `performance.now()` at which the timeline starts (hero photo on screen) */
  start: Promise<number>;
  /** no motion: render once in the final pose */
  still?: boolean;
}

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const PACE = 800; // ms per timeline second (opening sequence runs 20% faster)
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
  // Relief, colour/bump maps and face mesh are built off the main thread while the renderer is set up here.
  const built = build(logoPixels(img));

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
  await idle();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const b = await built;
  const map = dataTexture(b.color, true);
  const bump = dataTexture(b.bump, false);
  const mat = (roughness: number) => new MeshStandardMaterial({
    map, metalness: 0.25, roughness, bumpMap: bump, bumpScale: 0.5, envMapIntensity: 0.3,
    transparent: true, opacity: opts.still ? 1 : 0
  });
  const face = mat(0.88), edge = mat(0.91);

  const coin = new Group();
  coin.add(new Mesh(faceGeometry(b), face));
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

  // Compile the shaders without blocking, then draw once (still invisible: opacity 0) so geometry and
  // textures are already on the GPU when the timeline starts.
  if (!opts.still) {
    await renderer.compileAsync(scene, camera).catch(() => {});
    renderer.render(scene, camera);
  }

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
  const t0 = Math.max(start, performance.now() - 480);
  let last = 0;
  subscribe((fr) => {
    const dt = last ? fr.now - last : 1000 / 60;
    last = fr.now;
    // The sheet covers the sticky hero after one viewport: stop drawing.
    if (fr.y >= fr.vh) return;
    m.x = damp(m.x, m.tx, 0.05, fr.k);
    m.y = damp(m.y, m.ty, 0.05, fr.k);
    spin?.(dt);
    pose((fr.now - t0) / PACE);
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

/** The logo drawn at N² (the relief is sampled from its alpha channel). */
function logoPixels(img: HTMLImageElement) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, N, N);
  return x.getImageData(0, 0, N, N).data;
}

/** buildSeal() in a worker; on the main thread (after a frame's rest) if workers are unavailable or fail. */
function build(pixels: Uint8ClampedArray): Promise<SealBuild> {
  const local = async () => {
    await idle();
    return buildSeal(pixels);
  };
  if (typeof Worker === 'undefined') return local();
  return new Promise<SealBuild>((res, rej) => {
    const w = new Worker(new URL('./seal.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<SealBuild>) => { w.terminate(); res(e.data); };
    w.onerror = (e) => { w.terminate(); rej(e); };
    const copy = pixels.slice(); // transferred; `pixels` stays intact for the fallback
    w.postMessage(copy, [copy.buffer]);
  }).catch(local);
}

/** Let the browser draw a frame between two heavy steps. */
const idle = () => new Promise<void>((res) => setTimeout(res, 0));

/** M² RGBA bytes → mipmapped texture (what a canvas texture would give). */
function dataTexture(px: Uint8ClampedArray, colour: boolean): Texture {
  const tex = new DataTexture(px, M, M, RGBAFormat);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  if (colour) {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Relief face, built by the worker: a dense plane displaced by the logo alpha, trimmed to the unit disc. */
function faceGeometry(b: SealBuild) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(b.position, 3));
  g.setAttribute('normal', new BufferAttribute(b.normal, 3));
  g.setAttribute('uv', new BufferAttribute(b.uv, 2));
  g.setIndex(new BufferAttribute(b.index, 1));
  return g;
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

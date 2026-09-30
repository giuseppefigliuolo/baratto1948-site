import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const eo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 7, y * 2.03 + 3) * 0.25 + vnoise(x * 4.1 + 13, y * 4.1 + 17) * 0.125 + vnoise(x * 8.3 + 5, y * 8.3 + 11) * 0.0625;
const mix = (a, b, t) => a + (b - a) * t;
const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

let coinCache = null;
async function coinParts(src) {
  if (coinCache) return coinCache;
  const img = await loadImg(src);
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.filter = 'blur(2.2px)'; x.drawImage(img, 0, 0, N, N); x.filter = 'none';
  const a = x.getImageData(0, 0, N, N).data;
  const S = 440, T = 0.14, R = 0.036;
  const g = new THREE.PlaneGeometry(2, 2, S, S), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i);
    const u = clamp(Math.round((X + 1) / 2 * (N - 1)), 0, N - 1), v = clamp(Math.round((1 - Y) / 2 * (N - 1)), 0, N - 1);
    p.setZ(i, T / 2 + R * (a[(v * N + u) * 4 + 3] / 255));
  }
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const A = idx[i], B = idx[i + 1], C = idx[i + 2];
    const cx = (p.getX(A) + p.getX(B) + p.getX(C)) / 3, cy = (p.getY(A) + p.getY(B) + p.getY(C)) / 3;
    if (cx * cx + cy * cy <= 1) keep.push(A, B, C);
  }
  g.setIndex(keep); g.computeVertexNormals();
  // polished letters, satin field
  const rc = document.createElement('canvas'); rc.width = rc.height = N;
  const rx = rc.getContext('2d'); rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, N, N);
  const lc = document.createElement('canvas'); lc.width = lc.height = N;
  const lx = lc.getContext('2d'); lx.drawImage(img, 0, 0, N, N); lx.globalCompositeOperation = 'source-in'; lx.fillStyle = '#383838'; lx.fillRect(0, 0, N, N);
  rx.drawImage(lc, 0, 0);
  // letter mask at 512 for colour maps
  const M = 512, hc = document.createElement('canvas'); hc.width = hc.height = M;
  const hx = hc.getContext('2d'); hx.filter = 'blur(1px)'; hx.drawImage(img, 0, 0, M, M);
  const h512 = hx.getImageData(0, 0, M, M).data;
  coinCache = { g, rc, a, N, h512, M, T, R, maps: {} };
  return coinCache;
}

// brushed grain roughness (letters a touch smoother)
function grainMap(cc) {
  if (cc.maps.grain) return cc.maps.grain;
  const { N, a } = cc, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), d = x.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = clamp(205 + (Math.random() - 0.5) * 60 - (a[i * 4 + 3] / 255) * 60, 0, 255);
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return (cc.maps.grain = new THREE.CanvasTexture(c));
}

function colorMap(cc, kind) {
  if (cc.maps[kind]) return cc.maps[kind];
  const { M, h512 } = cc, c = document.createElement('canvas'); c.width = c.height = M;
  const x = c.getContext('2d'), d = x.createImageData(M, M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const u = i / M, v = j / M, h = h512[(j * M + i) * 4 + 3] / 255, o = (j * M + i) * 4;
    let r, g, b;
    if (kind === 'wood') {
      const warp = fbm(u * 3, v * 7) * 2.4;
      const ring = (v * 13 + warp) % 1, band = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 3);
      const fib = vnoise(u * 180, v * 6) * 0.12 + vnoise(u * 420, v * 12) * 0.06;
      const t = clamp(band * 0.75 + fib, 0, 1), L = hex(0x8c5d37), D = hex(0x4b2d19);
      const burn = 1 - 0.42 * h;
      r = mix(L[0], D[0], t) * burn; g = mix(L[1], D[1], t) * burn; b = mix(L[2], D[2], t) * burn;
    } else if (kind === 'horn') {
      const n = fbm(u * 2.2 + fbm(u * 4, v * 4) * 0.8, v * 7);
      const t = clamp(Math.pow(clamp((n - 0.28) / 0.5, 0, 1), 1.8), 0, 1), D = hex(0x17100b), L = hex(0x8a6236);
      r = mix(D[0], L[0], t); g = mix(D[1], L[1], t); b = mix(D[2], L[2], t);
    } else if (kind === 'olive') {
      const warp = fbm(u * 2.5, v * 2.5) * 5 + fbm(u * 6, v * 3) * 1.5;
      const ring = (u * 4 + v * 9 + warp) % 1, band = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 5);
      const fib = vnoise(u * 240, v * 10) * 0.1;
      const t = clamp(band * 0.55 + fib + fbm(u * 9, v * 9) * 0.2, 0, 1), L = hex(0xa6825a), D = hex(0x6b4b2c), k = 1 - 0.3 * h;
      r = mix(L[0], D[0], t) * k; g = mix(L[1], D[1], t) * k; b = mix(L[2], D[2], t) * k;
    } else if (kind === 'leather') {
      const n = fbm(u * 6, v * 6), p = vnoise(u * 220, v * 220);
      const B = hex(0x8e5b33), D = hex(0x4e3019), t = clamp((1 - n) * 0.55 + (p < 0.25 ? 0.18 : 0), 0, 1) * (1 - 0.3 * h) + 0.45 * h;
      r = mix(B[0], D[0], t); g = mix(B[1], D[1], t); b = mix(B[2], D[2], t);
    } else if (kind === 'bronze' || kind === 'iron') {
      const n = fbm(u * 5, v * 5), n2 = fbm(u * 11 + 4, v * 11 + 9);
      const base = hex(kind === 'bronze' ? 0x5c4a32 : 0x3a3834), patch = hex(kind === 'bronze' ? 0x66705a : 0x5e3e27), wear = hex(kind === 'bronze' ? 0x96774b : 0x5d5952);
      const pt = clamp((n2 - 0.52) / 0.18, 0, 1) * (1 - h) * (kind === 'bronze' ? 0.7 : 0.55);
      const sh = 0.9 + n * 0.2;
      r = mix(mix(base[0], patch[0], pt), wear[0], h * 0.85) * sh; g = mix(mix(base[1], patch[1], pt), wear[1], h * 0.85) * sh; b = mix(mix(base[2], patch[2], pt), wear[2], h * 0.85) * sh;
    } else if (kind === 'wax') {
      const n = fbm(u * 3, v * 3), B = hex(0x7c2519), D = hex(0x4f140d), t = clamp(0.35 + (0.5 - n) * 0.8 + 0.25 * h, 0, 1);
      r = mix(B[0], D[0], t); g = mix(B[1], D[1], t); b = mix(B[2], D[2], t);
    } else if (kind === 'clay') {
      const n = fbm(u * 4, v * 4), sp = hash(i, j) < 0.035 ? 0.75 : 1, B = hex(0xa4633f), k = (0.9 + n * 0.2) * sp * (1 + 0.08 * h);
      r = clamp(B[0] * k, 0, 255); g = clamp(B[1] * k, 0, 255); b = clamp(B[2] * k, 0, 255);
    } else { // corozo
      const n = fbm(u * 5, v * 5), s = vnoise(u * 60, v * 3) * 0.06;
      const B = hex(0xd6c6a4), t = (n - 0.45) * 0.22 + s, k = 1 + 0.06 * h;
      r = clamp(B[0] * (1 + t) * k, 0, 255); g = clamp(B[1] * (1 + t) * k, 0, 255); b = clamp(B[2] * (1 + t * 1.1) * k, 0, 255);
    }
    d.data[o] = r; d.data[o + 1] = g; d.data[o + 2] = b; d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return (cc.maps[kind] = tex);
}

// fine surface relief for the natural finishes
function bumpMap(cc, kind) {
  const key = 'bump_' + kind;
  if (cc.maps[key]) return cc.maps[key];
  const M = 512, c = document.createElement('canvas'); c.width = c.height = M;
  const x = c.getContext('2d'), d = x.createImageData(M, M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const u = i / M, v = j / M, o = (j * M + i) * 4;
    let s;
    if (kind === 'leather') s = vnoise(u * 160, v * 160) * 0.6 + vnoise(u * 40, v * 40) * 0.4;
    else if (kind === 'wood') s = vnoise(u * 300, v * 8) * 0.7 + vnoise(u * 60, v * 3) * 0.3;
    else if (kind === 'clay') s = vnoise(u * 90, v * 90) * 0.5 + hash(i, j) * 0.5;
    else s = vnoise(u * 120, v * 120) * 0.5 + hash(i, j) * 0.5;
    s = s * 255; d.data[o] = d.data[o + 1] = d.data[o + 2] = s; d.data[o + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return (cc.maps[key] = new THREE.CanvasTexture(c));
}

export const FINISHES = {
  gold:    { label: 'Ottone lucido' },
  brass:   { label: 'Ottone brunito' },
  pewter:  { label: 'Canna di fucile' },
  wood:    { label: 'Noce' },
  horn:    { label: 'Corno' },
  corozo:  { label: 'Corozo' }
};

function makeMats(cc, finish, transparent) {
  const S = p => new THREE.MeshStandardMaterial(Object.assign({ transparent }, p));
  switch (finish) {
    case 'brass': {
      const gr = grainMap(cc);
      return [S({ color: 0x9c8058, metalness: 0.35, roughness: 1, roughnessMap: gr, envMapIntensity: 0.7 }), S({ color: 0x86694a, metalness: 0.3, roughness: 0.72, envMapIntensity: 0.7 }), 2.4];
    }
    case 'pewter': {
      const gr = grainMap(cc);
      return [S({ color: 0x6a6660, metalness: 0.55, roughness: 0.85, roughnessMap: gr, envMapIntensity: 0.8 }), S({ color: 0x55524d, metalness: 0.5, roughness: 0.7, envMapIntensity: 0.8 }), 2.4];
    }
    case 'wood': {
      const m = colorMap(cc, 'wood');
      const b = bumpMap(cc, 'wood');
      return [S({ map: m, metalness: 0, roughness: 0.9, bumpMap: b, bumpScale: 0.6, envMapIntensity: 0.3 }), S({ map: m, metalness: 0, roughness: 0.92, bumpMap: b, bumpScale: 0.6, envMapIntensity: 0.3 }), 2.6];
    }
    case 'horn': {
      const m = colorMap(cc, 'horn');
      return [S({ map: m, metalness: 0, roughness: 0.42, envMapIntensity: 0.7 }), S({ map: m, metalness: 0, roughness: 0.38, envMapIntensity: 0.7 }), 2.4];
    }
    case 'olive': case 'leather': case 'bronze': case 'iron': case 'wax': case 'clay': {
      const m = colorMap(cc, finish);
      const P = {
        olive:   { metalness: 0,    roughness: 0.94, bump: 'wood',    bs: 0.6, k: 2.2 },
        leather: { metalness: 0,    roughness: 0.88, bump: 'leather', bs: 1.2, k: 2.6 },
        bronze:  { metalness: 0.25, roughness: 0.88, bump: 'metal',   bs: 0.5, k: 2.8 },
        iron:    { metalness: 0.3,  roughness: 0.92, bump: 'metal',   bs: 0.8, k: 3.0 },
        wax:     { metalness: 0,    roughness: 0.72, bump: 'metal',   bs: 0.3, k: 2.4 },
        clay:    { metalness: 0,    roughness: 0.97, bump: 'clay',    bs: 1.0, k: 2.6 }
      }[finish];
      const b = bumpMap(cc, P.bump);
      const base = { map: m, metalness: P.metalness, roughness: P.roughness, bumpMap: b, bumpScale: P.bs, envMapIntensity: 0.3 };
      return [S(base), S(Object.assign({}, base, { roughness: Math.min(1, P.roughness + 0.03) })), P.k];
    }
    case 'corozo': {
      const m = colorMap(cc, 'corozo');
      return [S({ map: m, metalness: 0, roughness: 0.6, envMapIntensity: 0.55 }), S({ map: m, metalness: 0, roughness: 0.55, envMapIntensity: 0.55 }), 2.2];
    }
    default: {
      const rough = cc.maps.polish || (cc.maps.polish = new THREE.CanvasTexture(cc.rc));
      return [S({ color: 0xcfa968, metalness: 1, roughness: 1, roughnessMap: rough }), S({ color: 0xb48f55, metalness: 1, roughness: 0.3 }), 1.6];
    }
  }
}

function envFor(renderer) {
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  es.background = new THREE.Color(0x0b0908);
  const add = (w, h, pos, col, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); es.add(m);
  };
  add(5, 5, [0, 7, 5], 0xffe0b0, 4.5);
  add(12, 1.6, [-8, 2, 3], 0xfff0da, 1.6);
  add(1.6, 12, [8, -1, 4], 0xc2a36b, 1.2);
  add(10, 10, [0, -7, 5], 0x3b2b1c, 1.2);
  add(20, 20, [0, 0, -9], 0x1a1410, 1);
  const t = pm.fromScene(es, 0.035).texture; pm.dispose();
  return t;
}

export async function seal(host, opts = {}) {
  const mode = opts.mode || 'solo';
  const cc = await coinParts(opts.logo || 'assets/brand/logo.png');
  const { g, T, R } = cc;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  host.appendChild(cv);

  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  const fov = mode === 'lift' ? 18 : 30;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const dist = mode === 'lift' ? (opts.frame || 2.4) / Math.tan(THREE.MathUtils.degToRad(fov / 2)) : 4.9;
  camera.position.set(0, 0, dist);

  const coin = new THREE.Group();
  const faceM = new THREE.Mesh(g); coin.add(faceM);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.006, 1.006, T + R, 180, 1, true));
  rim.rotation.x = Math.PI / 2; rim.position.z = R / 2; coin.add(rim);
  const back = new THREE.Mesh(new THREE.CircleGeometry(1.006, 180));
  back.rotation.y = Math.PI; back.position.z = -T / 2; coin.add(back);
  scene.add(coin);

  const key = new THREE.DirectionalLight(0xffe4bd, 1.6); key.position.set(0.6, 3, 4); scene.add(key);
  scene.add(new THREE.AmbientLight(0x2a2018, 0.6));

  let face, edge;
  const setFinish = f => {
    const [fm, em, k] = makeMats(cc, f || 'gold', mode === 'lift');
    const op = face ? face.opacity : 1;
    [face, edge].forEach(m => m && m.dispose());
    face = fm; edge = em; face.opacity = edge.opacity = op;
    faceM.material = face; rim.material = edge; back.material = edge; key.intensity = k;
  };
  setFinish(opts.finish);

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(host);

  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  const pt = opts.pointer || host;
  const onMove = e => { const r = pt.getBoundingClientRect(); m.tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); m.ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); };
  const onLeave = () => { m.tx = 0; m.ty = 0; };
  pt.addEventListener('mousemove', onMove); pt.addEventListener('mouseleave', onLeave);
  // phones: device tilt instead of cursor (iOS needs DeviceOrientationEvent.requestPermission on a tap)
  let b0 = null, g0 = null;
  const onTilt = e => {
    if (e.beta == null) return;
    if (b0 == null) { b0 = e.beta; g0 = e.gamma; }
    m.tx = clamp((e.gamma - g0) / 20, -1, 1); m.ty = clamp((e.beta - b0) / 20, -1, 1);
  };
  if (opts.tilt) window.addEventListener('deviceorientation', onTilt);

  let t0 = performance.now(), raf = 0, dead = false;
  const sh = opts.shadow;
  const frame = now => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / 1000;
    m.x += (m.tx - m.x) * 0.05; m.y += (m.ty - m.y) * 0.05;
    if (mode === 'lift') {
      // slow materialise, then a long, soft rise off the cloth
      const f = smoother(clamp((t - 0.6) / 2.6, 0, 1)), lr = clamp((t - 1.8) / 5.8, 0, 1);
      const l = smoother(smoother(lr) * 0.35 + (1 - Math.pow(1 - lr, 3)) * 0.65);
      face.opacity = edge.opacity = f;
      coin.position.z = 2.31 * l; // +18% apparent size at rest
      coin.rotation.x = l * (-0.34 + Math.sin(t * 0.4) * 0.05 + m.y * 0.22);
      coin.rotation.y = l * (0.2 + Math.sin(t * 0.3) * 0.08 + m.x * 0.3);
      if (sh) { sh.style.opacity = (0.8 * l).toFixed(3); sh.style.transform = 'translate(-50%,-50%) translate(' + (5 * l).toFixed(2) + '%,' + (11 * l).toFixed(2) + '%) scale(' + (1 + 0.15 * l).toFixed(3) + ')'; }
    } else {
      const p = eo(clamp(t / 2.8, 0, 1));
      coin.position.z = -4 * (1 - p);
      coin.rotation.y = -Math.PI * 2.25 * (1 - p) + Math.sin(t * 0.4) * 0.2 + m.x * 0.5;
      coin.rotation.x = 0.7 * (1 - p) - 0.06 + Math.cos(t * 0.31) * 0.06 + m.y * 0.32;
    }
    key.position.x = 0.6 + m.x * 2.4; key.position.y = 3 - m.y * 1.5;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    replay() { t0 = performance.now(); },
    setFinish,
    destroy() {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      pt.removeEventListener('mousemove', onMove); pt.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
      renderer.dispose(); cv.remove();
    }
  };
}

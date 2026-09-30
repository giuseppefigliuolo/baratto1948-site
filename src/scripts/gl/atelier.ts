/**
 * Atelier: curved, draggable, infinite gallery (vanilla WebGL port of the
 * three.js version). Panels bend away from the centre, react to drag velocity,
 * lift on hover and desaturate when out of focus.
 */
import { clamp, lerp } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';
import { watch } from '../core/visible';
import { bitmap, context, program, texture, touch } from './util';

const VS = `attribute vec2 p;attribute vec2 uv;uniform mat4 uP;uniform float uX,uPW,uPH,uVel,uW,uHover,uCam;varying vec2 vUv;
void main(){vUv=uv;vec3 wp=vec3(p.x*uPW+uX,p.y*uPH,0.);float nx=wp.x/uW;
wp.z-=nx*nx*uW*.55;wp.x+=sin(uv.y*3.14159)*uVel*uW*.035;wp.y+=sin(uv.x*3.14159)*abs(uVel)*uW*.01;wp.z+=uHover*50.;
wp.z-=uCam;gl_Position=uP*vec4(wp,1.);}`;
const FS = `precision mediump float;uniform sampler2D t;uniform vec2 uC;uniform float uVel,uFocus,uHover,uReady;varying vec2 vUv;
void main(){vec2 uv=(vUv-.5)*uC+.5;uv=(uv-.5)*(1.-.07*uHover)+.5;uv.y=1.-uv.y;float s=clamp(uVel,-1.,1.)*.025;
vec3 c=vec3(texture2D(t,uv+vec2(s,0.)).r,texture2D(t,uv).g,texture2D(t,uv-vec2(s,0.)).b);
float l=dot(c,vec3(.299,.587,.114));float f=clamp(uFocus+uHover,0.,1.);
c=mix(vec3(l)*.55,c,.25+.75*f);gl_FragColor=vec4(c*uReady,uReady);}`;

const FOV = 35;
const SEG = 24;

function perspective(fovDeg: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function grid(gl: WebGLRenderingContext, prog: WebGLProgram) {
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let y = 0; y <= SEG; y++)
    for (let x = 0; x <= SEG; x++) { pos.push(x / SEG - 0.5, y / SEG - 0.5); uvs.push(x / SEG, y / SEG); }
  for (let y = 0; y < SEG; y++)
    for (let x = 0; x < SEG; x++) {
      const a = y * (SEG + 1) + x, b = a + 1, c = a + SEG + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const bind = (data: number[], name: string) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };
  bind(pos, 'p');
  bind(uvs, 'uv');
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  return idx.length;
}

interface Item { src: string; title: string }

export function atelier(host: HTMLElement) {
  const items: Item[] = JSON.parse(host.dataset.items || '[]');
  if (items.length < 3) return;
  const titleEl = document.querySelector<HTMLElement>('[data-atelier-title]');
  const countEl = document.querySelector<HTMLElement>('[data-atelier-count]');
  const fallback = host.querySelector<HTMLElement>('[data-atelier-fallback]');

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const gl = context(cv, { alpha: true, antialias: true, premultipliedAlpha: true });
  const pr = gl && program(gl, VS, FS);
  if (!gl || !pr) { cv.remove(); return; }
  const count = grid(gl, pr.p);
  const U: Record<string, WebGLUniformLocation | null> = {};
  ['uP', 'uX', 'uPW', 'uPH', 'uVel', 'uW', 'uHover', 'uCam', 't', 'uC', 'uFocus', 'uReady'].forEach((n) => (U[n] = pr.u(n)));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const meshes = items.map((_, i) => ({ i, tex: null as WebGLTexture | null, ia: 1, hover: 0, ready: 0 }));
  let loadedCount = 0;
  // Stagger texture decode/upload so it never lands in a single long frame.
  meshes.forEach((m, i) =>
    setTimeout(() =>
      bitmap(items[i].src).then((b) => {
        m.tex = texture(gl, b);
        m.ia = (b as ImageBitmap).width / (b as ImageBitmap).height;
        if (++loadedCount === 1) { cv.style.opacity = '1'; if (fallback) fallback.style.visibility = 'hidden'; }
      }).catch(() => {}), i * 60)
  );

  let W = 1, H = 1, pw = 1, ph = 1, step = 1, L = 1, cam = 1, d = 1;
  onMeasure(() => {
    W = host.clientWidth; H = host.clientHeight;
    d = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cam = H / 2 / Math.tan((FOV * Math.PI) / 360);
    const mob = W < 700;
    pw = mob ? W * 0.66 : clamp(W * 0.23, 220, 400);
    ph = Math.min(pw * 1.28, H * 0.84);
    if (mob) pw = Math.min(pw, ph / 1.2);
    step = pw + (mob ? W * 0.07 : pw * 0.16);
    L = step * items.length;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniformMatrix4fv(U.uP, false, perspective(FOV, W / H, 1, 6000));
    gl.uniform1f(U.uW, W);
    gl.uniform1f(U.uCam, cam);
    gl.uniform1f(U.uPW, pw);
    gl.uniform1f(U.uPH, ph);
  });

  let off = 0, target = 0, vel = 0, dragging = false, sx = 0, st = 0, current = -1;
  let mx = -1e5, my = -1e5;
  cv.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX; st = target; cv.style.cursor = 'grabbing'; });
  addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    mx = e.clientX - r.left - W / 2; my = e.clientY - r.top - H / 2;
    if (dragging) target = st + (e.clientX - sx) * (touch ? 1.9 : 1.6);
  }, { passive: true });
  const up = () => { dragging = false; cv.style.cursor = ''; };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { mx = my = -1e5; if (!touch) up(); });
  cv.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); target -= e.deltaX * 1.2; }
  }, { passive: false });

  const vis = watch(host, '100px 0px');
  const pad = (n: number) => String(n).padStart(2, '0');

  subscribe((f) => {
    if (!vis.on) return;
    if (!dragging) target -= 0.45 + f.vel * 0.9;
    const prev = off;
    off = lerp(off, target, 0.075);
    vel = lerp(vel, off - prev, 0.2);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uVel, clamp(vel / 40, -1, 1));
    let best = 0, bestF = -1;
    for (const m of meshes) {
      const x = (((m.i * step + off + L / 2) % L) + L) % L - L / 2;
      const focus = clamp(1 - Math.abs(x) / step, 0, 1);
      // Screen-space hit test at the panel's curved depth (replaces a raycaster).
      const s = cam / (cam + ((x * x) / W) * 0.55);
      const hit = !touch && Math.abs(mx - x * s) < (pw / 2) * s && Math.abs(my) < (ph / 2) * s;
      m.hover = lerp(m.hover, hit ? 1 : 0, 0.1);
      m.ready = lerp(m.ready, m.tex ? 1 : 0, 0.06);
      if (focus > bestF) { bestF = focus; best = m.i; }
      if (!m.tex || m.ready < 0.01 || Math.abs(x) > W) continue;
      const pa = pw / ph;
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
      gl.uniform1i(U.t, 0);
      gl.uniform2f(U.uC, pa > m.ia ? 1 : pa / m.ia, pa > m.ia ? m.ia / pa : 1);
      gl.uniform1f(U.uX, x);
      gl.uniform1f(U.uFocus, focus);
      gl.uniform1f(U.uHover, m.hover);
      gl.uniform1f(U.uReady, m.ready);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    }
    if (best !== current) {
      current = best;
      if (countEl) countEl.textContent = `${pad(best + 1)} / ${pad(items.length)}`;
      if (titleEl) {
        titleEl.style.transition = 'none';
        titleEl.style.opacity = '0';
        titleEl.style.transform = 'translateY(10px)';
        titleEl.textContent = items[best].title;
        requestAnimationFrame(() => {
          titleEl.style.transition = 'opacity .5s ease, transform .6s cubic-bezier(.16,1,.3,1)';
          titleEl.style.opacity = '1';
          titleEl.style.transform = 'none';
        });
      }
    }
  });
}

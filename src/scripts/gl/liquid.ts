/**
 * "Liquid fabric" image shader, used by the hero (always alive) and by
 * [data-gl] images (on hover on desktop; gentle ambient drift on touch).
 * One small WebGL context per image, created lazily, drawing only while the
 * image is on screen and the effect is active.
 */
import { clamp, hostOf, lerp } from '../core/dom';
import { subscribe } from '../core/loop';
import { watch } from '../core/visible';
import { context, dpr, loaded, program, quad, texture, touch } from './util';

const VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;varying vec2 vUv;uniform sampler2D t;
uniform vec2 uM,uC,uO;uniform float uH,uS,uT,uV,uA,uB,uSc;
void main(){vec2 uv=vUv;uv.y+=uSc*.12;uv=(uv-.5)/(uB+.04*uH+uSc*.04)+.5;
uv+=vec2(sin(uv.y*7.+uT*.6),cos(uv.x*6.+uT*.5))*.0022*uH;
vec2 d=vUv-uM;d.x*=uA;float dist=length(d);
float w=sin(dist*36.-uT*4.5)*exp(-dist*4.5)*uS;uv+=normalize(d+1e-5)*w*.014;
uv.y+=(vUv.y-.5)*uV*.0018;
vec2 c=(uv-.5)*uC+uO;c.y=1.-c.y;
float sh=.0025*uS+min(abs(uV)*.0007,.012);
vec3 col=vec3(texture2D(t,c+vec2(sh,0.)).r,texture2D(t,c).g,texture2D(t,c-vec2(sh,0.)).b);
col*=1.-uSc*.35;gl_FragColor=vec4(col,1.);}`;

interface Opts { hero?: boolean; posY?: number }

export function liquid(img: HTMLImageElement, host: HTMLElement = hostOf(img), o: Opts = {}) {
  const hero = !!o.hero;
  const posY = o.posY ?? 0.5;
  const vis = watch(host, '0px');
  const st = { h: hero ? 1 : 0, target: hero ? 1 : 0, mx: 0.5, my: 0.5, tmx: 0.5, tmy: 0.5, s: 0, S: 0, v: 0, lx: 0, ly: 0, ph: Math.random() * 6 };

  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGLRenderingContext | null = null;
  let U: Record<string, WebGLUniformLocation | null> = {};
  let ready = false, shown = false, ia = 1, failed = false;
  let hr: DOMRect | null = null, ir: DOMRect | null = null;

  const setup = () => {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;${hero ? 'transition:opacity .8s ease' : ''}`;
    host.appendChild(canvas);
    gl = context(canvas, { alpha: !hero, premultipliedAlpha: false });
    const pr = gl && program(gl, VS, FS);
    if (!gl || !pr) { failed = true; canvas.remove(); return; }
    quad(gl, pr.p);
    ['t', 'uM', 'uC', 'uO', 'uH', 'uS', 'uT', 'uV', 'uA', 'uB', 'uSc'].forEach((n) => (U[n] = pr.u(n)));
    loaded(img).then((i) => {
      if (!gl) return;
      ia = i.naturalWidth / i.naturalHeight;
      ready = !!texture(gl, i);
    }).catch(() => { failed = true; });
  };

  const point = (x: number, y: number) => {
    const r = (hero ? host : img).getBoundingClientRect();
    const sp = Math.hypot(x - st.lx, y - st.ly);
    st.lx = x; st.ly = y;
    st.tmx = (x - r.left) / r.width;
    st.tmy = 1 - (y - r.top) / r.height;
    st.s = Math.min(1, st.s + sp * 0.012);
  };

  if (!touch) {
    if (hero) addEventListener('mousemove', (e) => point(e.clientX, e.clientY), { passive: true });
    else {
      host.dataset.cursor ||= 'Scopri';
      host.addEventListener('mouseenter', (e) => { st.lx = e.clientX; st.ly = e.clientY; st.target = 1; point(e.clientX, e.clientY); });
      host.addEventListener('mousemove', (e) => point(e.clientX, e.clientY), { passive: true });
      host.addEventListener('mouseleave', () => { st.target = 0; });
    }
  } else {
    host.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; if (!t) return;
      st.lx = t.clientX; st.ly = t.clientY; point(t.clientX, t.clientY); st.s = Math.max(st.s, 0.7);
    }, { passive: true });
    host.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) point(t.clientX, t.clientY); }, { passive: true });
  }

  const active = (y: number, vh: number) =>
    vis.on && !failed && (hero ? y < vh * 1.3 : touch || st.h > 0.004 || st.target > 0);

  subscribe({
    read(f) {
      if (!active(f.y, f.vh)) return;
      hr = host.getBoundingClientRect();
      ir = hero ? hr : img.getBoundingClientRect();
    },
    write(f) {
      if (!active(f.y, f.vh)) {
        if (shown && !hero) { shown = false; canvas!.style.opacity = '0'; }
        return;
      }
      if (!canvas) setup();
      if (!gl || !ready || !hr || !ir) return;
      const T = f.now / 1000;
      if (touch) {
        if (!hero) st.target = 1;
        st.tmx += (0.5 + Math.sin(T * 0.35 + st.ph) * 0.3 - st.tmx) * 0.01;
        st.tmy += (0.45 + Math.cos(T * 0.27 + st.ph) * 0.25 - st.tmy) * 0.01;
        st.s = Math.max(st.s, 0.22);
      }
      st.h = hero ? 1 : lerp(st.h, st.target, 0.06);
      st.mx = lerp(st.mx, st.tmx, 0.08); st.my = lerp(st.my, st.tmy, 0.08);
      st.s *= touch ? 0.985 : 0.965;
      st.S = lerp(st.S, st.s, 0.1);
      st.v = lerp(st.v, f.vel, 0.15);

      const d = dpr();
      const cw = Math.max(1, Math.round(hr.width * d)), ch = Math.max(1, Math.round(hr.height * d));
      if (canvas!.width !== cw || canvas!.height !== ch) { canvas!.width = cw; canvas!.height = ch; }
      const ra = ir.width / ir.height;
      const uc = ra > ia ? [1, ia / ra] : [ra / ia, 1];
      const oy = hero ? 1 - ((1 - uc[1]) * posY + uc[1] / 2) : 0.5;
      if (!hero) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.viewport((ir.left - hr.left) * d, (hr.bottom - ir.bottom) * d, ir.width * d, ir.height * d);
      gl.uniform1i(U.t, 0);
      gl.uniform2f(U.uM, st.mx, st.my);
      gl.uniform2f(U.uC, uc[0], uc[1]);
      gl.uniform2f(U.uO, 0.5, oy);
      gl.uniform1f(U.uH, st.h);
      gl.uniform1f(U.uS, st.S * st.h);
      gl.uniform1f(U.uT, T);
      gl.uniform1f(U.uV, st.v * st.h);
      gl.uniform1f(U.uA, ra);
      gl.uniform1f(U.uB, hero ? 1.04 : 1);
      gl.uniform1f(U.uSc, hero ? clamp(f.y / f.vh, 0, 1.2) : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!shown) {
        shown = true;
        canvas!.style.opacity = '1';
        if (hero) setTimeout(() => { img.style.visibility = 'hidden'; }, 850);
      }
    }
  });
}

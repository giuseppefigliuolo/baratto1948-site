/**
 * Hero seal renderer: plain WebGL2, no three.js. A line-by-line port of what three.js r186 drew for the coin
 * (MeshStandardMaterial with map + bumpMap, one directional + one ambient light, PMREM environment,
 * ACES Filmic tone mapping, sRGB output, transparent meshes sorted back to front), so the coin looks the same
 * for ~10 KB gz instead of ~130. The environment comes pre-baked as spherical harmonics (seal.data.ts).
 */
import { DFG, ENV_R08, ENV_R1 } from './seal.data';
import { M, type SealBuild } from './seal.shape';

const VS = `#version 300 es
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vUv;
void main() {
  vUv = uv;
  vNormal = normalize( normalMatrix * normal );
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vViewPosition = - mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}`;

// Names and order follow three's shader chunks (meshphysical, bumpmap_pars, lights_physical_pars, ...).
const FS = `#version 300 es
precision highp float;
#define PI 3.141592653589793
#define RECIPROCAL_PI 0.3183098861837907
#define EPSILON 1e-6
#define saturate( a ) clamp( a, 0.0, 1.0 )
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vUv;
uniform sampler2D map, bumpMap, dfgLUT;
uniform float roughness, opacity;
uniform vec3 lightDirection, lightColor, ambientLightColor;
uniform vec3 envR1[ 25 ], envR08[ 25 ];
out vec4 fragColor;
// envMapIntensity: the three.js version asked for 0.3, but three ignores a material's envMapIntensity when the
// environment comes from scene.environment and uses scene.environmentIntensity (1) instead; 1 is what was on screen.
const float metalness = 0.25, bumpScale = 0.5, envMapIntensity = 1.0, toneMappingExposure = 1.05;

float pow2( const in float x ) { return x * x; }
float pow4( const in float x ) { float x2 = x * x; return x2 * x2; }

vec2 dHdxy_fwd() {
  vec2 dSTdx = dFdx( vUv ), dSTdy = dFdy( vUv );
  float Hll = bumpScale * texture( bumpMap, vUv ).x;
  float dBx = bumpScale * texture( bumpMap, vUv + dSTdx ).x - Hll;
  float dBy = bumpScale * texture( bumpMap, vUv + dSTdy ).x - Hll;
  return vec2( dBx, dBy );
}
vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
  vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
  vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
  vec3 vN = surf_norm;
  vec3 R1 = cross( vSigmaY, vN );
  vec3 R2 = cross( vN, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDirection;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return normalize( abs( fDet ) * surf_norm - vGrad );
}

vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
  float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
  return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
  float a2 = pow2( alpha );
  float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
  float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
  return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
  float a2 = pow2( alpha );
  float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
  return RECIPROCAL_PI * a2 / pow2( denom );
}
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 f0, const in float f90, const in float roughness ) {
  float alpha = pow2( roughness );
  vec3 halfDir = normalize( lightDir + viewDir );
  float dotNL = saturate( dot( normal, lightDir ) );
  float dotNV = saturate( dot( normal, viewDir ) );
  float dotNH = saturate( dot( normal, halfDir ) );
  float dotVH = saturate( dot( viewDir, halfDir ) );
  return F_Schlick( f0, f90, dotVH ) * ( V_GGX_SmithCorrelated( alpha, dotNL, dotNV ) * D_GGX( alpha, dotNH ) );
}
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
  vec3 FssEss = specularColor * fab.x + specularF90 * fab.y;
  float Ess = fab.x + fab.y;
  float Ems = 1.0 - Ess;
  vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;
  vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
  singleScatter += FssEss;
  multiScatter += Fms * Ems;
}

// Environment: order-4 SH of PMREM mips -2 (roughness 1) and -1 (roughness 0.8); three blends them linearly
// in between. The camera is axis-aligned, so view-space directions are world-space directions.
vec3 env( vec3 d, float roughness ) {
  float x = d.x, y = d.y, z = d.z, x2 = x * x, y2 = y * y, z2 = z * z;
  float b[ 25 ] = float[ 25 ]( 0.282095,
    0.488603 * y, 0.488603 * z, 0.488603 * x,
    1.092548 * x * y, 1.092548 * y * z, 0.315392 * ( 3.0 * z2 - 1.0 ), 1.092548 * x * z, 0.546274 * ( x2 - y2 ),
    0.590044 * y * ( 3.0 * x2 - y2 ), 2.890611 * x * y * z, 0.457046 * y * ( 5.0 * z2 - 1.0 ), 0.373176 * z * ( 5.0 * z2 - 3.0 ),
    0.457046 * x * ( 5.0 * z2 - 1.0 ), 1.445306 * z * ( x2 - y2 ), 0.590044 * x * ( x2 - 3.0 * y2 ),
    2.503343 * x * y * ( x2 - y2 ), 1.770131 * y * z * ( 3.0 * x2 - y2 ), 0.946175 * x * y * ( 7.0 * z2 - 1.0 ),
    0.669047 * y * z * ( 7.0 * z2 - 3.0 ), 0.105786 * ( 35.0 * z2 * z2 - 30.0 * z2 + 3.0 ), 0.669047 * x * z * ( 7.0 * z2 - 3.0 ),
    0.473087 * ( x2 - y2 ) * ( 7.0 * z2 - 1.0 ), 1.770131 * x * z * ( x2 - 3.0 * y2 ), 0.625836 * ( x2 * ( x2 - 3.0 * y2 ) - y2 * ( 3.0 * x2 - y2 ) ) );
  float t = saturate( ( 1.0 - roughness ) * 5.0 );
  vec3 c = vec3( 0.0 );
  for ( int i = 0; i < 25; i ++ ) c += b[ i ] * mix( envR1[ i ], envR08[ i ], t );
  return max( c, 0.0 );
}

vec3 RRTAndODTFit( vec3 v ) {
  vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
  vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
  return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
  const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  color *= toneMappingExposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit( color );
  color = ACESOutputMat * color;
  return saturate( color );
}
vec3 sRGBTransferOETF( in vec3 value ) {
  return mix( pow( value, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value * 12.92, vec3( lessThanEqual( value, vec3( 0.0031308 ) ) ) );
}

void main() {
  vec4 diffuseColor = vec4( 1.0, 1.0, 1.0, opacity ) * texture( map, vUv ); // sRGB texture: decoded on fetch

  float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
  vec3 normal = normalize( vNormal );
  vec3 nonPerturbedNormal = normal;
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );

  vec3 diffuseContribution = diffuseColor.rgb * ( 1.0 - metalness );
  vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
  float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
  float rough = min( max( roughness, 0.0525 ) + geometryRoughness, 1.0 );
  const vec3 specularColor = vec3( 0.04 );
  const float specularF90 = 1.0;
  vec3 specularColorBlended = mix( specularColor, diffuseColor.rgb, metalness );

  vec3 geometryNormal = normal;
  vec3 geometryViewDir = normalize( vViewPosition );
  vec2 dfg = texture( dfgLUT, vec2( rough, saturate( dot( geometryNormal, geometryViewDir ) ) ) ).rg;
  vec3 multiScatteringCompensation = 1.0 + specularColorBlended * ( 1.0 / ( dfg.x + dfg.y ) - 1.0 );

  // RE_Direct_Physical (key light)
  vec3 irradianceD = saturate( dot( geometryNormal, lightDirection ) ) * lightColor;
  vec3 directSpecular = irradianceD * BRDF_GGX( lightDirection, geometryViewDir, geometryNormal, specularColorBlended, specularF90, rough ) * multiScatteringCompensation;
  float dotVH = saturate( dot( geometryViewDir, normalize( lightDirection + geometryViewDir ) ) );
  vec3 directDiffuse = irradianceD * RECIPROCAL_PI * diffuseContribution * ( 1.0 - F_Schlick( specularColor, specularF90, dotVH ) );

  // RE_IndirectDiffuse_Physical (ambient light)
  vec3 ss = vec3( 0.0 ), ms = vec3( 0.0 );
  computeMultiscattering( dfg, specularColor, specularF90, ss, ms );
  vec3 indirectDiffuse = ambientLightColor * RECIPROCAL_PI * diffuseContribution * ( 1.0 - ss - ms );

  // getIBLIrradiance / getIBLRadiance + RE_IndirectSpecular_Physical (environment)
  vec3 iblIrradiance = PI * env( geometryNormal, 1.0 ) * envMapIntensity;
  vec3 reflectVec = normalize( mix( reflect( - geometryViewDir, geometryNormal ), geometryNormal, pow4( rough ) ) );
  vec3 radiance = env( reflectVec, rough ) * envMapIntensity;
  vec3 ssD = vec3( 0.0 ), msD = vec3( 0.0 ), ssM = vec3( 0.0 ), msM = vec3( 0.0 );
  computeMultiscattering( dfg, specularColor, specularF90, ssD, msD );
  computeMultiscattering( dfg, diffuseColor.rgb, specularF90, ssM, msM );
  vec3 cosineWeightedIrradiance = iblIrradiance * RECIPROCAL_PI;
  vec3 indirectSpecular = radiance * mix( ssD, ssM, metalness ) + mix( msD, msM, metalness ) * cosineWeightedIrradiance;
  indirectDiffuse += diffuseContribution * ( 1.0 - ( ssD + msD ) ) * cosineWeightedIrradiance;

  vec3 outgoingLight = directDiffuse + indirectDiffuse + directSpecular + indirectSpecular;
  fragColor = vec4( sRGBTransferOETF( ACESFilmicToneMapping( outgoingLight ) ), diffuseColor.a );
}`;

export interface CoinPose {
  /** coin lift along z, and rotation (three Euler XYZ, z = 0) */
  z: number; rx: number; ry: number;
  opacity: number;
  /** key light position (it points at the origin) */
  light: [number, number, number];
}

type Mat4 = Float32Array;
const mat4 = (e: number[]) => new Float32Array(e);
const mul = (a: Mat4, b: Mat4): Mat4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const translate = (x: number, y: number, z: number) => mat4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const rotX = (a: number) => { const c = Math.cos(a), s = Math.sin(a); return mat4([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a: number) => { const c = Math.cos(a), s = Math.sin(a); return mat4([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
/** PerspectiveCamera.updateProjectionMatrix() */
function perspective(fovDeg: number, aspect: number, near: number, far: number) {
  const top = near * Math.tan((fovDeg * Math.PI) / 360), h = 2 * top, w = aspect * h, left = -0.5 * w;
  const x = (2 * near) / w, y = (2 * near) / h, a = (2 * left + w) / w;
  const c = -(far + near) / (far - near), d = (-2 * far * near) / (far - near);
  return mat4([x, 0, 0, 0, 0, y, 0, 0, a, 0, c, -1, 0, 0, d, 0]);
}
/** Color.setHex(): sRGB hex → linear working space, times the light intensity. */
const linear = (hex: number, k: number) => [16, 8, 0].map((sh) => {
  const c = ((hex >> sh) & 255) / 255;
  return (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)) * k;
});

/** CylinderGeometry(r, r, h, segs, 1, openEnded) torso and CircleGeometry(r, segs), as three builds them. */
function rimGeometry(r: number, h: number, segs: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let y = 0; y <= 1; y++) for (let x = 0; x <= segs; x++) {
    const u = x / segs, th = u * Math.PI * 2, s = Math.sin(th), c = Math.cos(th);
    pos.push(r * s, -y * h + h / 2, r * c); nor.push(s, 0, c); uv.push(u, 1 - y);
  }
  for (let x = 0; x < segs; x++) {
    const a = x, b = segs + 1 + x, c = segs + 2 + x, d = x + 1;
    idx.push(a, b, d, b, c, d);
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), uv: new Float32Array(uv), index: new Uint32Array(idx) };
}
function discGeometry(r: number, segs: number) {
  const pos = [0, 0, 0], nor = [0, 0, 1], uv = [0.5, 0.5], idx: number[] = [];
  for (let s = 0; s <= segs; s++) {
    const th = (s / segs) * Math.PI * 2, x = r * Math.cos(th), y = r * Math.sin(th);
    pos.push(x, y, 0); nor.push(0, 0, 1);
    const p = new Float32Array([x, y]); // three derives the uv from the stored (float32) vertex
    uv.push((p[0] / r + 1) / 2, (p[1] / r + 1) / 2);
  }
  for (let i = 1; i <= segs; i++) idx.push(i, i + 1, 0);
  return { position: new Float32Array(pos), normal: new Float32Array(nor), uv: new Float32Array(uv), index: new Uint32Array(idx) };
}

export interface CoinSpec { cam: number; fov: number; thickness: number; relief: number }

/**
 * Creates the context and starts compiling right away, while `build` (the worker) is still running; uploads the
 * meshes and maps once it resolves. Where KHR_parallel_shader_compile exists, the compile is awaited frame by
 * frame instead of blocking.
 */
export async function coinRenderer(cv: HTMLCanvasElement, build: Promise<SealBuild>, spec: CoinSpec) {
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('no webgl2');

  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram()!;
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const b = await build;
  if (par) while (!gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) await new Promise(requestAnimationFrame);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`seal shader: ${gl.getShaderInfoLog(vs) || ''} ${gl.getShaderInfoLog(fs) || ''} ${gl.getProgramInfoLog(prog) || ''}`);
  }
  gl.useProgram(prog);
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['modelViewMatrix', 'projectionMatrix', 'normalMatrix', 'map', 'bumpMap', 'dfgLUT', 'roughness', 'opacity',
    'lightDirection', 'lightColor', 'ambientLightColor', 'envR1', 'envR08']) U[n] = gl.getUniformLocation(prog, n);

  // Textures: colour (sRGB, anisotropic) and bump maps as three uploads them (mipmapped, clamped), DFG LUT (RG16F).
  const tex = (unit: number, setup: () => void) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    setup();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const mipmapped = (px: Uint8ClampedArray, format: number) => {
    gl.texStorage2D(gl.TEXTURE_2D, Math.log2(M) + 1, format, M, M);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, M, M, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(px.buffer, px.byteOffset, px.byteLength));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  tex(0, () => {
    mipmapped(b.color, gl.SRGB8_ALPHA8);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  });
  tex(1, () => mipmapped(b.bump, gl.RGBA8));
  tex(2, () => {
    const lut = new Uint16Array(512);
    for (let i = 0; i < 512; i++) lut[i] = parseInt(DFG.slice(i * 4, i * 4 + 4), 16);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, 16, 16, 0, gl.RG, gl.HALF_FLOAT, lut);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  });
  gl.uniform1i(U.map, 0);
  gl.uniform1i(U.bumpMap, 1);
  gl.uniform1i(U.dfgLUT, 2);
  gl.uniform3fv(U.envR1, ENV_R1);
  gl.uniform3fv(U.envR08, ENV_R08);
  gl.uniform3fv(U.ambientLightColor, linear(0x2a2018, 0.6));
  gl.uniform3fv(U.lightColor, linear(0xffe4bd, 2.8));

  // Meshes: relief face, rim, back, each in its own VAO.
  const mesh = (g: { position: Float32Array; normal: Float32Array; uv: Float32Array; index: Uint32Array }, local: Mat4, roughness: number) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const attr = (name: string, data: Float32Array, size: number) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('position', g.position, 3);
    attr('normal', g.normal, 3);
    attr('uv', g.uv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    // Bounding-box centre: three sorts transparent meshes by its depth.
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < g.position.length; i++) {
      const v = g.position[i], k = i % 3;
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
    const centre = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
    return { vao, count: g.index.length, local, roughness, centre };
  };
  const { thickness: T, relief: R } = spec;
  const meshes = [
    mesh(b, translate(0, 0, 0), 0.88),
    mesh(rimGeometry(1.006, T + R, 180), mul(translate(0, 0, R / 2), rotX(Math.PI / 2)), 0.91),
    mesh(discGeometry(1.006, 180), mul(translate(0, 0, -T / 2), rotY(Math.PI)), 0.91)
  ];

  const proj = perspective(spec.fov, 1, 0.1, 100);
  const view = translate(0, 0, -spec.cam);
  gl.uniformMatrix4fv(U.projectionMatrix, false, proj);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);

  let vw = 1;
  /** WebGLRenderer.setPixelRatio + setSize(w, w, false): canvas floored, viewport rounded. */
  const resize = (w: number) => {
    const pr = Math.min(devicePixelRatio || 1, 2);
    cv.width = cv.height = Math.floor(w * pr);
    vw = Math.round(w * pr);
  };

  const draw = (p: CoinPose) => {
    gl.viewport(0, 0, vw, vw);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const l = Math.hypot(...p.light);
    gl.uniform3f(U.lightDirection, p.light[0] / l, p.light[1] / l, p.light[2] / l);
    gl.uniform1f(U.opacity, p.opacity);
    const group = mul(translate(0, 0, p.z), mul(rotX(p.rx), rotY(p.ry)));
    const items = meshes.map((m, i) => {
      const mv = mul(view, mul(group, m.local));
      const c = mul(proj, mv), [x, y, z] = m.centre;
      const depth = (c[2] * x + c[6] * y + c[10] * z + c[14]) / (c[3] * x + c[7] * y + c[11] * z + c[15]);
      return { m, i, mv, z: depth };
    }).sort((a, b) => b.z - a.z || a.i - b.i);
    for (const { m, mv } of items) {
      gl.uniformMatrix4fv(U.modelViewMatrix, false, mv);
      gl.uniformMatrix3fv(U.normalMatrix, false, [mv[0], mv[1], mv[2], mv[4], mv[5], mv[6], mv[8], mv[9], mv[10]]);
      gl.uniform1f(U.roughness, m.roughness);
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  };

  return { resize, draw };
}

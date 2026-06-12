// Bau-Helfer: Comic-Toon-Material, Teile färben, verschmelzen, Umriss-Hülle
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let _gradient = null;
export function gradientKarte() {
  if (_gradient) return _gradient;
  // 5 weiche Stufen — feinere Licht-Abstufung als hartes 2-Ton-Toon
  const daten = new Uint8Array([105, 140, 175, 215, 255]);
  _gradient = new THREE.DataTexture(daten, 5, 1, THREE.RedFormat);
  _gradient.needsUpdate = true;
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  return _gradient;
}

// ---------------------------------------------------------------- Rauschen (für Gelände & Streuung)
export function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
export function rausch(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oktaven = 4) {
  let summe = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oktaven; i++) {
    summe += rausch(x * f, z * f) * amp;
    norm += amp;
    amp *= 0.5; f *= 2.03;
  }
  return summe / norm; // 0..1
}

const _matCache = new Map();
export function toonMat(farbe, optionen = {}) {
  const key = farbe + JSON.stringify(optionen);
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color: farbe, gradientMap: gradientKarte(), ...optionen });
  _matCache.set(key, m);
  return m;
}

export const toonVertex = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientKarte() });

// Geometrie einfärben und positionieren — für spätere Verschmelzung.
// farbe darf auch [obenFarbe, untenFarbe] sein: senkrechter Farbverlauf
// (= weiches Licht von oben + eingebackene Verschattung unten, Walkabout-Look).
export function teil(geo, farbe, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const g = geo.clone();
  g.scale(sx, sy, sz);
  const n = g.attributes.position.count;
  const farben = new Float32Array(n * 3);
  if (Array.isArray(farbe)) {
    const oben = new THREE.Color(farbe[0]), unten = new THREE.Color(farbe[1]);
    g.computeBoundingBox();
    const minY = g.boundingBox.min.y, spanne = Math.max(0.0001, g.boundingBox.max.y - minY);
    const pos = g.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = (pos.getY(i) - minY) / spanne;
      c.copy(unten).lerp(oben, t * t * (3 - 2 * t));
      farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
    }
  } else {
    const c = new THREE.Color(farbe);
    for (let i = 0; i < n; i++) { farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b; }
  }
  if (rx || ry || rz) { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); }
  g.translate(x, y, z);
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  return g;
}

export function verschmelze(teile) {
  const sauber = teile.map(g => g.index ? g.toNonIndexed() : g);
  sauber.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
  return mergeGeometries(sauber, false);
}

// Umriss-Hülle: Geometrie entlang der Normalen aufblasen, schwarz, BackSide
const _umrissMat = new THREE.MeshBasicMaterial({ color: 0x201409, side: THREE.BackSide });
export function umriss(geo, dicke = 0.03) {
  const g = geo.clone();
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + nor.getX(i) * dicke,
      pos.getY(i) + nor.getY(i) * dicke,
      pos.getZ(i) + nor.getZ(i) * dicke);
  }
  pos.needsUpdate = true;
  return new THREE.Mesh(g, _umrissMat);
}

// Fertiges Comic-Mesh: verschmolzene Teile + Umriss in einer Gruppe
export function comicMesh(teile, dicke = 0.03) {
  const geo = verschmelze(teile);
  const mesh = new THREE.Mesh(geo, toonVertex());
  const gruppe = new THREE.Group();
  gruppe.add(mesh);
  gruppe.add(umriss(geo, dicke));
  return gruppe;
}

// Runder weicher Schatten-Fleck (Blob) unter Figuren
let _blobTex = null;
export function blobTextur() {
  if (!_blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.38)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    _blobTex = new THREE.CanvasTexture(c);
  }
  return _blobTex;
}
export function blobSchatten(radius = 0.6) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTextur(), transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// Weiche Punkt-Textur für Partikel (Schnee, Pollen, Rauch …)
let _punktTex = null;
export function punktTextur() {
  if (!_punktTex) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
    _punktTex = new THREE.CanvasTexture(c);
  }
  return _punktTex;
}

// Basis-Geometrien (geteilt)
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  kugel: new THREE.SphereGeometry(0.5, 10, 8),
  zylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  kegel: new THREE.ConeGeometry(0.5, 1, 10),
  kapsel: new THREE.CapsuleGeometry(0.5, 0.6, 3, 10),
  ring: new THREE.TorusGeometry(0.5, 0.12, 8, 16),
  // grobe Varianten für Vegetation in Massen (wenig Dreiecke)
  kugelGrob: new THREE.SphereGeometry(0.5, 7, 5),
  zylinderGrob: new THREE.CylinderGeometry(0.5, 0.5, 1, 7),
  kegelGrob: new THREE.ConeGeometry(0.5, 1, 6),
  kegelSpitz: new THREE.CylinderGeometry(0.06, 0.5, 1, 6),
  scheibe: new THREE.CircleGeometry(0.5, 8),
};

// Bau-Helfer: Comic-Toon-Material, Teile färben, verschmelzen, Umriss-Hülle
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let _gradient = null;
export function gradientKarte() {
  if (_gradient) return _gradient;
  const daten = new Uint8Array([90, 160, 255, 255]);
  _gradient = new THREE.DataTexture(daten, 4, 1, THREE.RedFormat);
  _gradient.needsUpdate = true;
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  return _gradient;
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

// Geometrie einfärben (Vertex-Farben) und positionieren — für spätere Verschmelzung
export function teil(geo, farbe, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const g = geo.clone();
  g.scale(sx, sy, sz);
  if (rx || ry || rz) { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); }
  g.translate(x, y, z);
  const c = new THREE.Color(farbe);
  const n = g.attributes.position.count;
  const farben = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b; }
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
export function blobSchatten(radius = 0.6) {
  if (!_blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.38)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    _blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: _blobTex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// Basis-Geometrien (geteilt)
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  kugel: new THREE.SphereGeometry(0.5, 10, 8),
  zylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  kegel: new THREE.ConeGeometry(0.5, 1, 10),
  kapsel: new THREE.CapsuleGeometry(0.5, 0.6, 3, 10),
  ring: new THREE.TorusGeometry(0.5, 0.12, 8, 16),
};

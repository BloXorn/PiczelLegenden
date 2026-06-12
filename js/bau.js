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

// ---------------------------------------------------------------- Boden-Detail-Texturen (prozedural, kachelbar)
import { rngFabrik } from './zustand.js';

function kachelTextur(groesse, malen) {
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  malen(c.getContext('2d'), groesse);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// zeichnet eine Form 9-fach versetzt, damit die Kachel nahtlos wird
function mitWrap(g, x, y, zeichne) {
  for (const dx of [-g, 0, g]) for (const dy of [-g, 0, g]) zeichne(x + dx, y + dy);
}

let _texturen = null;
export function bodenTexturen() {
  if (_texturen) return _texturen;
  const G = 256;

  const grasErde = kachelTextur(G, (ctx, g) => {
    const rng = rngFabrik(101);
    ctx.fillStyle = 'rgb(231,229,221)';
    ctx.fillRect(0, 0, g, g);
    for (let i = 0; i < 26; i++) { // Erde blitzt durch
      const x = rng() * g, y = rng() * g, r = 8 + rng() * 22, r2 = r * (0.5 + rng() * 0.5);
      ctx.fillStyle = `rgba(${170 + rng() * 25 | 0},${140 + rng() * 20 | 0},${105 + rng() * 20 | 0},${0.25 + rng() * 0.28})`;
      mitWrap(g, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r2, rng() * 3, 0, 7); ctx.fill(); });
    }
    for (let i = 0; i < 14; i++) { // dunklere Moos-Flecken
      const x = rng() * g, y = rng() * g, r = 10 + rng() * 18;
      ctx.fillStyle = `rgba(150,162,128,${0.25 + rng() * 0.25})`;
      mitWrap(g, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.7, rng() * 3, 0, 7); ctx.fill(); });
    }
    for (let i = 0; i < 170; i++) { // Körnchen & Lichtpunkte
      const x = rng() * g, y = rng() * g, s = 1 + rng() * 1.6;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(120,100,78,0.5)' : 'rgba(255,255,244,0.65)';
      ctx.fillRect(x, y, s, s);
    }
  });

  const pflaster = kachelTextur(G, (ctx, g) => {
    const rng = rngFabrik(202);
    ctx.fillStyle = 'rgb(96,90,82)';
    ctx.fillRect(0, 0, g, g);
    const zelle = g / 4;
    for (let rx = -1; rx <= 4; rx++) {
      for (let ry = -1; ry <= 4; ry++) {
        const x = rx * zelle + zelle / 2 + (rng() - 0.5) * 9 + (ry % 2 ? zelle / 2 : 0);
        const y = ry * zelle + zelle / 2 + (rng() - 0.5) * 9;
        const b = zelle * (0.78 + rng() * 0.14), h = zelle * (0.74 + rng() * 0.14);
        const ton = 196 + rng() * 42;
        ctx.fillStyle = `rgb(${ton | 0},${ton - 6 | 0},${ton - 14 | 0})`;
        ctx.beginPath();
        ctx.roundRect(x - b / 2, y - h / 2, b, h, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,250,0.30)'; // Licht oben links
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - b / 2 + 2, y - h / 2 + 2, b - 4, h - 4, 12);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(40,34,28,0.35)';   // Schatten unten
        ctx.beginPath();
        ctx.roundRect(x - b / 2 + 1, y - h / 2 + 3, b - 2, h - 3, 13);
        ctx.stroke();
      }
    }
  });

  const sand = kachelTextur(G, (ctx, g) => {
    const rng = rngFabrik(303);
    ctx.fillStyle = 'rgb(238,231,212)';
    ctx.fillRect(0, 0, g, g);
    for (let i = 0; i < 9; i++) { // sanfte Wellen-Rippel
      const y = rng() * g;
      ctx.strokeStyle = `rgba(205,188,156,${0.25 + rng() * 0.2})`;
      ctx.lineWidth = 3 + rng() * 3;
      mitWrap(g, 0, y, (px, py) => {
        ctx.beginPath();
        ctx.moveTo(-10, py);
        for (let x = 0; x <= g + 10; x += 16) ctx.lineTo(x, py + Math.sin(x * 0.08 + i) * 4);
        ctx.stroke();
      });
    }
    for (let i = 0; i < 420; i++) { // Sandkörner
      const x = rng() * g, y = rng() * g, s = 0.8 + rng() * 1.4;
      const w = rng();
      ctx.fillStyle = w < 0.4 ? 'rgba(198,178,142,0.7)' : w < 0.75 ? 'rgba(255,252,240,0.8)' : 'rgba(170,148,116,0.55)';
      ctx.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 9; i++) { // Kieselchen
      const x = rng() * g, y = rng() * g, r = 2.5 + rng() * 3;
      ctx.fillStyle = `rgba(${185 + rng() * 30 | 0},${175 + rng() * 25 | 0},${155 + rng() * 20 | 0},0.9)`;
      mitWrap(g, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.75, rng() * 3, 0, 7); ctx.fill(); });
    }
  });

  const fels = kachelTextur(G, (ctx, g) => {
    const rng = rngFabrik(404);
    ctx.fillStyle = 'rgb(221,221,218)';
    ctx.fillRect(0, 0, g, g);
    for (let i = 0; i < 20; i++) { // hellere/dunklere Gesteins-Flecken
      const x = rng() * g, y = rng() * g, r = 14 + rng() * 30;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(200,202,199,0.5)' : 'rgba(238,238,235,0.5)';
      mitWrap(g, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.7, rng() * 3, 0, 7); ctx.fill(); });
    }
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 11; i++) { // Risse
      let x = rng() * g, y = rng() * g;
      ctx.strokeStyle = `rgba(146,146,142,${0.4 + rng() * 0.25})`;
      mitWrap(g, 0, 0, (ox, oy) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        let px = x, py = y;
        for (let s = 0; s < 5; s++) {
          px += (rng() - 0.5) * 46;
          py += 14 + rng() * 22;
          ctx.lineTo(px + ox, py + oy);
        }
        ctx.stroke();
      });
    }
  });

  const schnee = kachelTextur(G, (ctx, g) => {
    const rng = rngFabrik(505);
    ctx.fillStyle = 'rgb(250,251,253)';
    ctx.fillRect(0, 0, g, g);
    for (let i = 0; i < 14; i++) { // bläuliche Mulden
      const x = rng() * g, y = rng() * g, r = 16 + rng() * 30;
      ctx.fillStyle = `rgba(222,232,245,${0.35 + rng() * 0.3})`;
      mitWrap(g, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.65, rng() * 3, 0, 7); ctx.fill(); });
    }
    for (let i = 0; i < 110; i++) { // Glitzer
      const x = rng() * g, y = rng() * g;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x, y, 1 + rng(), 1 + rng());
    }
  });

  _texturen = { grasErde, pflaster, sand, fels, schnee };
  return _texturen;
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

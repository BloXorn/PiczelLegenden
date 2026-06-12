// Dichter Gras-Teppich: zehntausende wiegende Halme + Blumen rund um den Spieler.
// Der Teppich wandert unsichtbar mit (Zellen-Raster + Hash = stabile Positionen).
import * as THREE from 'three';
import { S, WELT, klemme, glatt } from './zustand.js';
import { ZONEN } from './daten.js';
import { hash2, gradientKarte } from './bau.js';
import { hoeheAn, zoneIndexAn, istFreiFuerGras } from './welt.js';

const RADIUS = 42, ZELLE = 1.15, MAX_GRAS = 15000, MAX_BLUMEN = 1500;

// Halm-Farben & Dichte je Biom
const PALETTE = {
  wald: [0x86ca5e, 0x4c9438], kueste: [0xaada7a, 0x6fae4e],
  steppe: [0xe4d078, 0xb89c4e], moor: [0x739e50, 0x44663a],
  berge: [0x93b86c, 0x5d8a4a], frost: [0xccd8c4, 0x9ab092],
};
const DICHTE = { wald: 0.8, kueste: 0.62, steppe: 0.95, moor: 0.72, berge: 0.5, frost: 0.12 };
const BLUMEN_FARBEN = [0xf06a9a, 0xf8f8ff, 0xf0c84a, 0x7a8af5, 0xff8a5a];

let grasMesh = null, blumenMesh = null;
const shaderRefs = [];
let letzteX = 1e9, letzteZ = 1e9;

function grasGeometrie() {
  const pos = [], col = [], nor = [];
  const halme = 4;
  for (let i = 0; i < halme; i++) {
    const w = (i / halme) * Math.PI * 2 + 0.4;
    const bx = Math.cos(w) * 0.07, bz = Math.sin(w) * 0.07;
    const tx = bx + Math.cos(w) * 0.16, tz = bz + Math.sin(w) * 0.16;
    const px = -Math.sin(w) * 0.05, pz = Math.cos(w) * 0.05;
    const hoch = 0.72 + (i % 2) * 0.22;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, hoch, tz);
    // Basis dunkler als die Spitze (multipliziert sich mit der Instanz-Farbe)
    col.push(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.05, 1.05, 1.05);
    for (let k = 0; k < 3; k++) nor.push(0, 1, 0); // Normale nach oben = Licht wie der Boden
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function blumenGeometrie() {
  // zwei gekreuzte Blüten-Quads + Stängel-Dreieck
  const pos = [], col = [], nor = [];
  const quad = (w) => {
    const c = Math.cos(w), s = Math.sin(w);
    const b = 0.14, y0 = 0.3, y1 = 0.52;
    const ecken = [[-b, y0], [b, y0], [b, y1], [-b, y0], [b, y1], [-b, y1]];
    for (const [ex, ey] of ecken) {
      pos.push(ex * c, ey, ex * s);
      col.push(1, 1, 1);
      nor.push(0, 1, 0);
    }
  };
  quad(0.3); quad(0.3 + Math.PI / 2);
  // Stängel (bleibt grünlich-dunkel, egal welche Blütenfarbe)
  pos.push(-0.025, 0, 0, 0.025, 0, 0, 0, 0.36, 0);
  col.push(0.25, 0.4, 0.22, 0.25, 0.4, 0.22, 0.3, 0.5, 0.28);
  nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function wiegeMaterial() {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientKarte(), side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.zeit = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float zeit;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float wx = instanceMatrix[3][0];
          float wz = instanceMatrix[3][2];
          float schwung = sin(zeit * 1.7 + wx * 0.35 + wz * 0.45) + 0.45 * sin(zeit * 3.6 + wx * 1.3 + wz * 0.7);
          float gewicht = smoothstep(0.08, 0.85, position.y);
          transformed.x += schwung * 0.09 * gewicht;
          transformed.z += schwung * 0.055 * gewicht;
        #endif`);
    shaderRefs.push(shader);
  };
  return mat;
}

export function initGras() {
  grasMesh = new THREE.InstancedMesh(grasGeometrie(), wiegeMaterial(), MAX_GRAS);
  grasMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GRAS * 3), 3);
  grasMesh.frustumCulled = false;
  S.szene.add(grasMesh);

  blumenMesh = new THREE.InstancedMesh(blumenGeometrie(), wiegeMaterial(), MAX_BLUMEN);
  blumenMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BLUMEN * 3), 3);
  blumenMesh.frustumCulled = false;
  S.szene.add(blumenMesh);

  baueTeppich();
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(),
  _c1 = new THREE.Color(), _c2 = new THREE.Color();

function baueTeppich() {
  const p = S.rig.position;
  letzteX = p.x; letzteZ = p.z;
  let n = 0, nb = 0;
  const minCX = Math.floor((p.x - RADIUS) / ZELLE), maxCX = Math.ceil((p.x + RADIUS) / ZELLE);
  const minCZ = Math.floor((p.z - RADIUS) / ZELLE), maxCZ = Math.ceil((p.z + RADIUS) / ZELLE);
  const r2 = RADIUS * RADIUS;

  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cz = minCZ; cz <= maxCZ; cz++) {
      const wurf = hash2(cx * 1.317, cz * 2.731);
      const x0 = cx * ZELLE, z0 = cz * ZELLE;
      const dx = x0 - p.x, dz = z0 - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const zone = ZONEN[zoneIndexAn(x0, z0)];
      const dichte = DICHTE[zone.biom];
      if (wurf > dichte) continue;
      if (!istFreiFuerGras(x0, z0)) continue;
      const jx = (hash2(cx + 57.1, cz) - 0.5) * ZELLE;
      const jz = (hash2(cx, cz + 91.3) - 0.5) * ZELLE;
      const x = x0 + jx, z = z0 + jz;
      const h = hoeheAn(x, z);
      if (h < WELT.wasser + 0.35) continue;
      if ((zone.biom === 'berge' || zone.biom === 'frost')) {
        if (h > 26) continue;
        if (Math.abs(hoeheAn(x + 2, z) - h) > 0.9) continue; // keine Halme an Felswänden
      }
      // Am Rand sanft kleiner werden statt aufzuploppen
      const rand = 1 - glatt((Math.sqrt(d2) - (RADIUS - 9)) / 9);
      if (rand <= 0.05) continue;
      const istBlume = wurf < dichte * 0.05 && zone.biom !== 'frost';
      const skala = (0.8 + hash2(cx * 3.3, cz * 7.7) * 0.55) * rand;
      _e.set(0, wurf * 39.7, 0);
      _q.setFromEuler(_e);
      _v.set(x, h - 0.04, z);
      _s.set(skala, skala * (0.85 + hash2(cx, cz * 3.1) * 0.5), skala);
      _m4.compose(_v, _q, _s);
      if (istBlume && nb < MAX_BLUMEN) {
        blumenMesh.setMatrixAt(nb, _m4);
        _c.setHex(BLUMEN_FARBEN[Math.floor(hash2(cx * 9.1, cz * 4.7) * BLUMEN_FARBEN.length)]);
        blumenMesh.setColorAt(nb, _c);
        nb++;
      } else if (n < MAX_GRAS) {
        grasMesh.setMatrixAt(n, _m4);
        const pal = PALETTE[zone.biom];
        _c1.setHex(pal[0]); _c2.setHex(pal[1]);
        _c.copy(_c2).lerp(_c1, hash2(cx * 5.7, cz * 8.3));
        grasMesh.setColorAt(n, _c);
        n++;
      }
    }
  }
  grasMesh.count = n;
  grasMesh.instanceMatrix.needsUpdate = true;
  grasMesh.instanceColor.needsUpdate = true;
  blumenMesh.count = nb;
  blumenMesh.instanceMatrix.needsUpdate = true;
  blumenMesh.instanceColor.needsUpdate = true;
}

export function updateGras() {
  if (!grasMesh) return;
  for (const sh of shaderRefs) sh.uniforms.zeit.value = S.zeit;
  const p = S.rig.position;
  const dx = p.x - letzteX, dz = p.z - letzteZ;
  if (dx * dx + dz * dz > 9) baueTeppich();
}

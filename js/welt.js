// Die offene Welt: Gelände (6 Biome), Wasser, Himmel, Vegetation, Städte
import * as THREE from 'three';
import { S, WELT, rngFabrik, klemme, lerp, glatt } from './zustand.js';
import { ZONEN, ORTE, zonenMitte } from './daten.js';
import { teil, verschmelze, toonVertex, GEO, umriss } from './bau.js';

const kollisionsKreise = [];   // {x, z, r} — Gebäude usw.
const animierte = [];          // Meshes mit .userData.anim
let wasserMesh = null;
let ortHoehen = {}, stadtHoehen = {};
let pfade = [];                // [{ax,az,bx,bz,ha,hb}]

// ---------------------------------------------------------------- Höhen-Profile je Biom
function profil(zone, x, z) {
  const b = ZONEN[zone].biom;
  if (b === 'wald')
    return 10 + 5.5 * Math.sin(x * 0.018 + 1) * Math.sin(z * 0.021 + 2) + 2.2 * Math.sin(x * 0.05) * Math.sin(z * 0.043 + 1);
  if (b === 'kueste') {
    const t = klemme((z + 600) / 600, 0, 1);
    return lerp(-7, 13, glatt(t * 1.25)) + 1.6 * Math.sin(x * 0.04 + 2) * Math.sin(z * 0.05);
  }
  if (b === 'steppe')
    return 9 + 3 * Math.sin(x * 0.02 + 4) * Math.sin(z * 0.017 + 1) + 1.4 * Math.sin(x * 0.055 + z * 0.05);
  if (b === 'moor') {
    let h = 4.2 + 1.1 * Math.sin(x * 0.05 + 1) * Math.sin(z * 0.06 + 2) + 0.7 * Math.sin(x * 0.13);
    const p = Math.sin(x * 0.045 + 3) * Math.sin(z * 0.04 + 1);
    if (p > 0.55) h -= (p - 0.55) * 9; // Tümpel
    return h;
  }
  if (b === 'berge') {
    const r = (0.5 * (Math.sin(x * 0.013 + 2.1) + 1)) * (0.5 * (Math.sin(z * 0.016 + 0.7) + 1));
    return 9 + 30 * Math.pow(r, 1.5) + 2 * Math.sin(x * 0.05) * Math.sin(z * 0.06);
  }
  // frost
  const r = (0.5 * (Math.sin(x * 0.011 + 0.4) + 1)) * (0.5 * (Math.sin(z * 0.014 + 2.6) + 1));
  return 10 + 36 * Math.pow(r, 1.6) + 2 * Math.sin(x * 0.045 + 1) * Math.sin(z * 0.05 + 3);
}

function zonenIndexVon(gx, gz) {
  for (const z of ZONEN) if (z.gx === gx && z.gz === gz) return z.id;
  return 0;
}

export function zoneIndexAn(x, z) {
  const gx = klemme(Math.floor((x + 900) / 600), 0, 2);
  const gz = klemme(Math.floor((z + 600) / 600), 0, 1);
  return zonenIndexVon(gx, gz);
}

// Höhe ohne Stadt/Pfad-Glättung: weiche Überblendung der 4 nächsten Zonen
function rohHoehe(x, z) {
  const fx = klemme((x + 900) / 600 - 0.5, 0, 2);
  const fz = klemme((z + 600) / 600 - 0.5, 0, 1);
  const ix = Math.floor(klemme(fx, 0, 1.999)), iz = Math.floor(klemme(fz, 0, 0.999));
  const tx = glatt(fx - ix), tz = glatt(fz - iz);
  const h00 = profil(zonenIndexVon(ix, iz), x, z);
  const h10 = profil(zonenIndexVon(Math.min(ix + 1, 2), iz), x, z);
  const h01 = profil(zonenIndexVon(ix, Math.min(iz + 1, 1)), x, z);
  const h11 = profil(zonenIndexVon(Math.min(ix + 1, 2), Math.min(iz + 1, 1)), x, z);
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
}

function distZuSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = klemme(t, 0, 1);
  const qx = ax + dx * t, qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t };
}

export function hoeheAn(x, z) {
  let h = rohHoehe(x, z);
  // Boss-/Quest-Plätze einebnen
  for (const o of ORTE) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < 26) h = lerp(h, ortHoehen[o.id], glatt((26 - d) / 14));
  }
  // Straßen einebnen
  for (const p of pfade) {
    const { d, t } = distZuSegment(x, z, p.ax, p.az, p.bx, p.bz);
    if (d < 11) h = lerp(h, lerp(p.ha, p.hb, t), glatt((11 - d) / 7) * 0.85);
  }
  // Städte: flacher Platz
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < 75) h = lerp(h, stadtHoehen[i], glatt((75 - d) / 45));
  }
  return h;
}

export function kollidiere(pos, radius = 0.4) {
  // Weltgrenzen
  pos.x = klemme(pos.x, -890, 890);
  pos.z = klemme(pos.z, -590, 590);
  for (const k of kollisionsKreise) {
    const dx = pos.x - k.x, dz = pos.z - k.z;
    const d = Math.hypot(dx, dz), min = k.r + radius;
    if (d < min && d > 0.0001) {
      pos.x = k.x + (dx / d) * min;
      pos.z = k.z + (dz / d) * min;
    }
  }
}

// ---------------------------------------------------------------- Welt erschaffen
export function erschaffeWelt() {
  const szene = S.szene;
  // Stadt- und Ort-Höhen vorberechnen
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    stadtHoehen[i] = Math.max(rohHoehe(m.x, m.z), WELT.wasser + 2.5);
  }
  for (const o of ORTE) ortHoehen[o.id] = Math.max(rohHoehe(o.x, o.z), WELT.wasser + 1.5);
  // Straßen: Städte der Reihe nach verbinden
  pfade = [];
  for (let i = 0; i < 5; i++) {
    const a = zonenMitte(i), b = zonenMitte(i + 1);
    pfade.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ha: stadtHoehen[i], hb: stadtHoehen[i + 1] });
  }

  bauGelaende(szene);
  bauWasser(szene);
  bauHimmel(szene);
  bauVegetation(szene);
  for (let i = 0; i < 6; i++) bauStadt(szene, i);
  bauOrte(szene);
}

function bauGelaende(szene) {
  const geo = new THREE.PlaneGeometry(WELT.breite, WELT.tiefe, 330, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const farben = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), c2 = new THREE.Color();
  const sand = new THREE.Color(0xe9d9a4), fels = new THREE.Color(0x8d8d82),
    schnee = new THREE.Color(0xeef3f6), weg = new THREE.Color(0xc9b27a),
    platz = new THREE.Color(0xbcb29e);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = hoeheAn(x, z);
    pos.setY(i, h);
    // Grundfarbe: weiche Zonen-Überblendung
    const fx = klemme((x + 900) / 600 - 0.5, 0, 2), fz = klemme((z + 600) / 600 - 0.5, 0, 1);
    const ix = Math.floor(klemme(fx, 0, 1.999)), iz = Math.floor(klemme(fz, 0, 0.999));
    const tx = glatt(fx - ix), tz = glatt(fz - iz);
    c.setHex(ZONEN[zonenIndexVon(ix, iz)].bodenFarbe);
    c2.setHex(ZONEN[zonenIndexVon(Math.min(ix + 1, 2), iz)].bodenFarbe);
    c.lerp(c2, tx);
    c2.setHex(ZONEN[zonenIndexVon(ix, Math.min(iz + 1, 1))].bodenFarbe);
    const c3 = new THREE.Color(ZONEN[zonenIndexVon(Math.min(ix + 1, 2), Math.min(iz + 1, 1))].bodenFarbe);
    c2.lerp(c3, tx);
    c.lerp(c2, tz);
    // Hang = Fels, Höhe = Schnee, Ufer = Sand
    const steigung = Math.abs(hoeheAn(x + 4, z) - h) / 4 + Math.abs(hoeheAn(x, z + 4) - h) / 4;
    if (steigung > 0.4) c.lerp(fels, klemme((steigung - 0.4) * 2, 0, 0.8));
    if (h > 30) c.lerp(schnee, klemme((h - 30) / 8, 0, 1));
    if (h < WELT.wasser + 1.3) c.lerp(sand, 0.85);
    // Straßen & Stadtplätze einfärben
    for (const p of pfade) {
      const { d } = distZuSegment(x, z, p.ax, p.az, p.bx, p.bz);
      if (d < 5.5) { c.lerp(weg, 0.8); break; }
    }
    for (let zi = 0; zi < 6; zi++) {
      const m = zonenMitte(zi);
      if (Math.hypot(x - m.x, z - m.z) < 30) { c.lerp(platz, 0.7); break; }
    }
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonVertex());
  mesh.name = 'gelaende';
  szene.add(mesh);
}

function bauWasser(szene) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 1800),
    new THREE.MeshToonMaterial({ color: 0x3fb0d8, transparent: true, opacity: 0.82 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = WELT.wasser;
  szene.add(m);
  wasserMesh = m;
}

function bauHimmel(szene) {
  const geo = new THREE.SphereGeometry(700, 16, 10);
  const pos = geo.attributes.position;
  const farben = new Float32Array(pos.count * 3);
  const oben = new THREE.Color(0x4da6ff), unten = new THREE.Color(0xdff2ff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = klemme(pos.getY(i) / 700 * 0.5 + 0.5, 0, 1);
    c.copy(unten).lerp(oben, glatt(t));
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  const himmel = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  himmel.name = 'himmel';
  szene.add(himmel);
  S.himmel = himmel;
  // Sonne
  const sonne = new THREE.Mesh(new THREE.CircleGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
  sonne.position.set(300, 420, -350);
  sonne.lookAt(0, 0, 0);
  szene.add(sonne);
  S.sonne = sonne;
  // Wolken (gemütlich treibend)
  const rng = rngFabrik(777);
  const wolkenGeo = verschmelze([
    teil(GEO.kugel, 0xffffff, 0, 0, 0, 0, 0, 0, 7, 4, 5),
    teil(GEO.kugel, 0xffffff, 5, 1, 1, 0, 0, 0, 5, 3.4, 4),
    teil(GEO.kugel, 0xffffff, -5, 0.6, -1, 0, 0, 0, 4.6, 3, 4),
  ]);
  const wolken = new THREE.InstancedMesh(wolkenGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.92 }), 22);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 22; i++) {
    m4.makeTranslation(rng() * 1700 - 850, 120 + rng() * 80, rng() * 1100 - 550);
    wolken.setMatrixAt(i, m4);
  }
  szene.add(wolken);
  // Licht
  szene.add(new THREE.HemisphereLight(0xeaf7ff, 0x9a8a6a, 1.1));
  const sonnenLicht = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sonnenLicht.position.set(0.6, 1, -0.4);
  szene.add(sonnenLicht);
}

// ---------------------------------------------------------------- Vegetation (instanziert, Comic-Look)
function baumGeo(biom) {
  if (biom === 'wald')
    return verschmelze([
      teil(GEO.zylinder, 0x7a522e, 0, 1.2, 0, 0, 0, 0, 0.55, 2.4, 0.55),
      teil(GEO.kugel, 0x3e8e3a, 0, 3.1, 0, 0, 0, 0, 2.6),
      teil(GEO.kugel, 0x4da33f, 1.0, 2.5, 0.5, 0, 0, 0, 1.8),
      teil(GEO.kugel, 0x357a30, -0.9, 2.6, -0.4, 0, 0, 0, 1.7),
    ]);
  if (biom === 'kueste')
    return verschmelze([
      teil(GEO.zylinder, 0x9a7a4a, 0.2, 2.2, 0, 0, 0, 0.12, 0.4, 4.4, 0.4),
      teil(GEO.kugel, 0x4da354, 0.6, 4.5, 0, 0, 0, 0, 2.6, 0.7, 2.6),
      teil(GEO.kugel, 0x3e8e44, 0.6, 4.8, 0, 0, 0, 0, 1.6, 0.6, 1.6),
    ]);
  if (biom === 'steppe')
    return verschmelze([
      teil(GEO.zylinder, 0x8a6a3a, 0, 1.6, 0, 0, 0, 0.2, 0.35, 3.2, 0.35),
      teil(GEO.kugel, 0x7a9a3d, 0.4, 3.4, 0, 0, 0, 0, 3.2, 0.9, 3.2),
    ]);
  if (biom === 'moor')
    return verschmelze([
      teil(GEO.zylinder, 0x4a3a2a, 0, 1.8, 0, 0, 0, 0, 0.4, 3.6, 0.4),
      teil(GEO.zylinder, 0x4a3a2a, 0.8, 3.2, 0, 0, 0, -0.7, 0.2, 1.8, 0.2),
      teil(GEO.zylinder, 0x4a3a2a, -0.7, 3.5, 0.2, 0, 0, 0.6, 0.18, 1.6, 0.18),
      teil(GEO.kugel, 0x4a5d36, 0.2, 4.2, 0, 0, 0, 0, 1.4, 0.8, 1.4),
    ]);
  if (biom === 'berge')
    return verschmelze([
      teil(GEO.zylinder, 0x6a4a2a, 0, 0.8, 0, 0, 0, 0, 0.45, 1.6, 0.45),
      teil(GEO.kegel, 0x3a6b44, 0, 3.0, 0, 0, 0, 0, 2.6, 3.6, 2.6),
      teil(GEO.kegel, 0x2f5a38, 0, 4.6, 0, 0, 0, 0, 1.9, 2.6, 1.9),
    ]);
  // frost — verschneite Tanne
  return verschmelze([
    teil(GEO.zylinder, 0x5a4632, 0, 0.8, 0, 0, 0, 0, 0.45, 1.6, 0.45),
    teil(GEO.kegel, 0x3d7a55, 0, 2.8, 0, 0, 0, 0, 2.6, 3.4, 2.6),
    teil(GEO.kegel, 0xe8f0f4, 0, 4.5, 0, 0, 0, 0, 1.9, 2.4, 1.9),
  ]);
}

function deko2Geo(biom) {
  if (biom === 'moor') // Pilz
    return verschmelze([
      teil(GEO.zylinder, 0xd8c8a8, 0, 0.5, 0, 0, 0, 0, 0.3, 1.0, 0.3),
      teil(GEO.kugel, 0xa84a8a, 0, 1.0, 0, 0, 0, 0, 1.1, 0.7, 1.1),
    ]);
  if (biom === 'steppe') // Grasbüschel
    return verschmelze([
      teil(GEO.kegel, 0xb8a84a, 0, 0.5, 0, 0, 0, 0.15, 0.5, 1.1, 0.5),
      teil(GEO.kegel, 0xc8b85a, 0.3, 0.45, 0.1, 0, 0, -0.2, 0.4, 0.9, 0.4),
    ]);
  // Felsen
  const f = biom === 'frost' ? 0xc8d8e2 : 0x8d8d82;
  return verschmelze([
    teil(GEO.kugel, f, 0, 0.4, 0, 0.3, 0.5, 0, 1.5, 1.0, 1.2),
    teil(GEO.kugel, f, 0.8, 0.25, 0.3, 0.2, 1.2, 0, 0.9, 0.7, 0.8),
  ]);
}

function platzFrei(x, z) {
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    if (Math.hypot(x - m.x, z - m.z) < 42) return false;
  }
  for (const p of pfade) {
    if (distZuSegment(x, z, p.ax, p.az, p.bx, p.bz).d < 9) return false;
  }
  for (const o of ORTE) {
    if (Math.hypot(x - o.x, z - o.z) < 22) return false;
  }
  return true;
}

function streue(szene, zone, geo, anzahl, seed, minH = WELT.wasser + 0.6) {
  const rng = rngFabrik(seed + zone.id * 97);
  const mesh = new THREE.InstancedMesh(geo, toonVertex(), anzahl);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();
  const mx = zonenMitte(zone.id);
  let gesetzt = 0, versuche = 0;
  while (gesetzt < anzahl && versuche++ < anzahl * 14) {
    const x = mx.x + (rng() - 0.5) * 580;
    const z = mx.z + (rng() - 0.5) * 580;
    if (!platzFrei(x, z)) continue;
    const h = hoeheAn(x, z);
    if (h < minH) continue;
    const steigung = Math.abs(hoeheAn(x + 3, z) - h) / 3;
    if (steigung > 0.55) continue;
    const s = 0.75 + rng() * 0.6;
    e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
    v.set(x, h - 0.15, z); sk.set(s, s, s);
    m4.compose(v, q, sk);
    mesh.setMatrixAt(gesetzt++, m4);
  }
  mesh.count = gesetzt;
  szene.add(mesh);
}

function bauVegetation(szene) {
  const mengen = { wald: 420, kueste: 170, steppe: 110, moor: 200, berge: 240, frost: 220 };
  for (const zone of ZONEN) {
    streue(szene, zone, baumGeo(zone.biom), mengen[zone.biom], 1234);
    streue(szene, zone, deko2Geo(zone.biom), zone.biom === 'steppe' ? 220 : 90, 5678);
  }
}

// ---------------------------------------------------------------- Städte (Zeitalter!)
function gebaeude(era, rng) {
  // liefert {teile:[geo], r:KollisionsRadius, hoehe}
  if (era === 'steinzeit') {
    return { r: 3.2, teile: [
      teil(GEO.kegel, 0xb08254, 0, 2.2, 0, 0, 0, 0, 4.4, 4.4, 4.4),
      teil(GEO.zylinder, 0x6a4a2a, 0, 3.8, 0, 0, 0, 0.3, 0.15, 2.6, 0.15),
      teil(GEO.zylinder, 0x6a4a2a, 0.4, 3.8, 0.2, 0, 0, -0.3, 0.15, 2.6, 0.15),
    ] };
  }
  if (era === 'bronzezeit') {
    return { r: 3.4, teile: [
      teil(GEO.zylinder, 0xd8b88a, 0, 1.6, 0, 0, 0, 0, 5.4, 3.2, 5.4),
      teil(GEO.kugel, 0xc09a6a, 0, 3.4, 0, 0, 0, 0, 5.6, 3.4, 5.6),
      teil(GEO.box, 0x6a4a2a, 0, 1.0, 2.6, 0, 0, 0, 1.2, 2.0, 0.3),
    ] };
  }
  if (era === 'antike') {
    const t = [
      teil(GEO.box, 0xf0e8d8, 0, 0.4, 0, 0, 0, 0, 7, 0.8, 5.4),
      teil(GEO.box, 0xf0e8d8, 0, 4.4, 0, 0, 0, 0, 7, 0.7, 5.4),
      teil(GEO.kegel, 0xc06a4a, 0, 5.6, 0, 0, Math.PI / 4, 0, 5.4, 1.8, 5.4),
    ];
    for (let i = -1; i <= 1; i++) {
      t.push(teil(GEO.zylinder, 0xfaf2e2, i * 2.4, 2.4, 2.2, 0, 0, 0, 0.5, 3.4, 0.5));
      t.push(teil(GEO.zylinder, 0xfaf2e2, i * 2.4, 2.4, -2.2, 0, 0, 0, 0.5, 3.4, 0.5));
    }
    return { r: 4.4, teile: t };
  }
  if (era === 'mittelalter') {
    return { r: 3.6, teile: [
      teil(GEO.box, 0xf0e2c8, 0, 1.7, 0, 0, 0, 0, 5.2, 3.4, 4.6),
      teil(GEO.box, 0x6a4a2a, 0, 1.7, 2.31, 0, 0, 0.6, 0.3, 4.0, 0.05),
      teil(GEO.box, 0x6a4a2a, 0, 1.7, 2.31, 0, 0, -0.6, 0.3, 4.0, 0.05),
      teil(GEO.box, 0x6a4a2a, 0, 0.5, 2.31, 0, 0, 0, 5.2, 0.35, 0.05),
      teil(GEO.kegel, 0x8a3a2a, 0, 4.8, 0, 0, Math.PI / 4, 0, 4.4, 2.8, 4.4),
      teil(GEO.box, 0x5a3a22, 0, 1.0, 2.35, 0, 0, 0, 1.1, 2.0, 0.2),
    ] };
  }
  if (era === 'renaissance') {
    return { r: 3.8, teile: [
      teil(GEO.box, 0xe2dccc, 0, 2.2, 0, 0, 0, 0, 5.6, 4.4, 4.8),
      teil(GEO.box, 0xc8c2b2, 0, 4.7, 0, 0, 0, 0, 6.0, 0.5, 5.2),
      teil(GEO.kegel, 0x7a4a3a, 0, 6.0, 0, 0, Math.PI / 4, 0, 5.2, 2.4, 5.2),
      teil(GEO.box, 0x4a6a8a, 1.4, 2.4, 2.45, 0, 0, 0, 1.0, 1.4, 0.1),
      teil(GEO.box, 0x4a6a8a, -1.4, 2.4, 2.45, 0, 0, 0, 1.0, 1.4, 0.1),
      teil(GEO.box, 0x5a3a22, 0, 1.1, 2.45, 0, 0, 0, 1.2, 2.2, 0.2),
    ] };
  }
  // moderne — bunte Hochhäuser
  const hoehe = 7 + Math.floor(rng() * 3) * 3;
  const farben = [0x9ab0c0, 0xb0c0d0, 0x8aa0b8];
  const f = farben[Math.floor(rng() * 3)];
  return { r: 4.0, hoch: true, hoehe, teile: [
    teil(GEO.box, f, 0, hoehe / 2, 0, 0, 0, 0, 5.4, hoehe, 5.0),
    teil(GEO.box, 0x7a90a8, 0, hoehe + 0.25, 0, 0, 0, 0, 5.6, 0.5, 5.2),
  ] };
}

function bauStadt(szene, zi) {
  const zone = ZONEN[zi];
  const m = zonenMitte(zi);
  const h = stadtHoehen[zi];
  const rng = rngFabrik(40 + zi);
  const teileListe = [];
  const leuchtTeile = [];

  // Gebäude im Ring um den Platz
  const anzahl = 8;
  for (let i = 0; i < anzahl; i++) {
    const wink = (i / anzahl) * Math.PI * 2 + 0.35;
    const r = 34 + rng() * 12;
    const gx = m.x + Math.cos(wink) * r, gz = m.z + Math.sin(wink) * r;
    const gh = hoeheAn(gx, gz);
    const g = gebaeude(zone.era, rng);
    for (const t of g.teile) { t.rotateY(-wink + Math.PI / 2); t.translate(gx, gh - 0.1, gz); teileListe.push(t); }
    kollisionsKreise.push({ x: gx, z: gz, r: g.r });
    if (g.hoch) { // leuchtende Fenster der modernen Stadt
      for (let f = 0; f < g.hoehe - 2; f += 2) {
        leuchtTeile.push(teil(GEO.box, 0xfff2a8, gx + 2.78 * Math.cos(wink), gh + 1.6 + f, gz + 2.78 * Math.sin(wink), 0, -wink + Math.PI / 2, 0, 3.4, 0.9, 0.1));
      }
    }
  }

  // Herzstück der Stadt je Zeitalter
  if (zone.era === 'steinzeit') {
    teileListe.push(teil(GEO.zylinder, 0x8a6a4a, m.x, h + 1.6, m.z - 16, 0, 0, 0, 1.0, 3.2, 1.0));
    teileListe.push(teil(GEO.box, 0xa8845a, m.x, h + 3.6, m.z - 16, 0, 0, 0, 1.6, 1.6, 1.6));
    for (let i = 0; i < 6; i++) {
      const w = i / 6 * Math.PI * 2;
      teileListe.push(teil(GEO.kugel, 0x7a7a70, m.x + Math.cos(w) * 2.4, h + 0.3, m.z + Math.sin(w) * 2.4, 0, 0, 0, 0.8, 0.6, 0.8));
    }
    leuchtTeile.push(teil(GEO.kegel, 0xff9a3a, m.x, h + 1.0, m.z, 0, 0, 0, 1.0, 1.8, 1.0));
  } else if (zone.era === 'bronzezeit') {
    teileListe.push(teil(GEO.box, 0xc8b8a0, m.x, h + 0.6, m.z, 0, 0, 0, 2.6, 1.2, 2.6));
    teileListe.push(teil(GEO.kapsel, 0xc8862a, m.x, h + 2.6, m.z, 0, 0, 0, 1.0, 1.6, 1.0));
    teileListe.push(teil(GEO.kugel, 0xc8862a, m.x, h + 3.9, m.z, 0, 0, 0, 0.7));
  } else if (zone.era === 'antike') {
    for (let i = 0; i < 5; i++) {
      const w = i / 5 * Math.PI * 2;
      teileListe.push(teil(GEO.zylinder, 0xfaf2e2, m.x + Math.cos(w) * 4, h + 2.2, m.z + Math.sin(w) * 4, 0, 0, 0, 0.5, 4.4, 0.5));
    }
    teileListe.push(teil(GEO.zylinder, 0xf0e8d8, m.x, h + 4.6, m.z, 0, 0, 0, 5.4, 0.5, 5.4));
  } else if (zone.era === 'mittelalter') {
    teileListe.push(teil(GEO.zylinder, 0x9a9a92, m.x, h + 5, m.z - 18, 0, 0, 0, 3.4, 10, 3.4));
    teileListe.push(teil(GEO.kegel, 0x8a3a2a, m.x, h + 11.4, m.z - 18, 0, 0, 0, 4.2, 3.2, 4.2));
    teileListe.push(teil(GEO.box, 0xc03a2a, m.x + 1.4, h + 12.6, m.z - 18, 0, 0, 0, 2.4, 1.2, 0.1));
    teileListe.push(teil(GEO.ring, 0x9a9a92, m.x, h + 0.5, m.z, Math.PI / 2, 0, 0, 5.0, 5.0, 5.0));
    kollisionsKreise.push({ x: m.x, z: m.z - 18, r: 4 });
  } else if (zone.era === 'renaissance') {
    teileListe.push(teil(GEO.box, 0xd8d2c2, m.x, h + 6, m.z - 18, 0, 0, 0, 3.4, 12, 3.4));
    teileListe.push(teil(GEO.kegel, 0x4a6a8a, m.x, h + 13.4, m.z - 18, 0, Math.PI / 4, 0, 3.8, 3.0, 3.8));
    leuchtTeile.push(teil(GEO.zylinder, 0xfff8e0, m.x, h + 10.5, m.z - 16.2, Math.PI / 2, 0, 0, 1.2, 0.2, 1.2));
    teileListe.push(teil(GEO.ring, 0xb8b2a2, m.x, h + 0.4, m.z, Math.PI / 2, 0, 0, 4.4, 4.4, 4.4));
    kollisionsKreise.push({ x: m.x, z: m.z - 18, r: 3.4 });
  } else { // moderne
    teileListe.push(teil(GEO.zylinder, 0x8a9ab0, m.x, h + 8, m.z - 18, 0, 0, 0, 0.5, 16, 0.5));
    leuchtTeile.push(teil(GEO.kugel, 0x8ae8ff, m.x, h + 16.5, m.z - 18, 0, 0, 0, 1.4));
    // ✦-PICZEL-Denkmal mitten auf dem Platz
    leuchtTeile.push(teil(GEO.kugel, 0x4adfff, m.x, h + 4.2, m.z, 0, 0, 0, 1.0, 2.6, 1.0));
    leuchtTeile.push(teil(GEO.kugel, 0x4adfff, m.x, h + 4.2, m.z, 0, 0, 0, 2.6, 1.0, 0.6));
    teileListe.push(teil(GEO.box, 0xb0bcc8, m.x, h + 1.2, m.z, 0, 0, 0, 2.0, 2.4, 2.0));
    // Straßenlampen
    for (const w of [0.6, 2.2, 3.8, 5.4]) {
      const lx = m.x + Math.cos(w) * 22, lz = m.z + Math.sin(w) * 22;
      const lh = hoeheAn(lx, lz);
      teileListe.push(teil(GEO.zylinder, 0x5a626a, lx, lh + 2, lz, 0, 0, 0, 0.15, 4, 0.15));
      leuchtTeile.push(teil(GEO.kugel, 0xfff2a8, lx, lh + 4.2, lz, 0, 0, 0, 0.5));
    }
  }

  const geo = verschmelze(teileListe);
  const stadtMesh = new THREE.Mesh(geo, toonVertex());
  szene.add(stadtMesh);
  szene.add(umriss(geo, 0.04));
  if (leuchtTeile.length) {
    const lg = verschmelze(leuchtTeile);
    szene.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  kollisionsKreise.push({ x: m.x, z: m.z, r: 1.8 }); // Herzstück
}

function bauOrte(szene) {
  const teileListe = [];
  for (const o of ORTE) {
    const h = ortHoehen[o.id];
    for (let i = 0; i < 7; i++) {
      const w = i / 7 * Math.PI * 2;
      teileListe.push(teil(GEO.kugel, 0x9a9a8e, o.x + Math.cos(w) * 14, hoeheAn(o.x + Math.cos(w) * 14, o.z + Math.sin(w) * 14) + 0.3, o.z + Math.sin(w) * 14, 0, w, 0, 1.4, 1.0, 1.1));
    }
    // Besondere Wahrzeichen
    if (o.id === 'himmelsstein') {
      teileListe.push(teil(GEO.kugel, 0x6ad8ff, o.x, h + 1.6, o.z, 0.4, 0.3, 0, 2.2, 2.6, 2.2));
    } else if (o.id === 'steinkreis') {
      for (let i = 0; i < 5; i++) {
        const w = i / 5 * Math.PI * 2;
        teileListe.push(teil(GEO.box, 0x8a8a80, o.x + Math.cos(w) * 6, h + 1.6, o.z + Math.sin(w) * 6, 0, w, 0, 1.2, 3.2, 0.8));
      }
    } else if (o.id === 'leuchtfeuer') {
      teileListe.push(teil(GEO.zylinder, 0xd8d0c0, o.x, h + 4, o.z, 0, 0, 0, 2.2, 8, 1.6));
      teileListe.push(teil(GEO.kugel, 0xffd24a, o.x, h + 8.6, o.z, 0, 0, 0, 1.2));
    } else if (o.id === 'sonnentor') {
      teileListe.push(teil(GEO.box, 0xf0e8d8, o.x - 3, h + 3, o.z, 0, 0, 0, 1.4, 6, 1.4));
      teileListe.push(teil(GEO.box, 0xf0e8d8, o.x + 3, h + 3, o.z, 0, 0, 0, 1.4, 6, 1.4));
      teileListe.push(teil(GEO.box, 0xffd24a, o.x, h + 6.4, o.z, 0, 0, 0, 8, 1.2, 1.6));
    } else if (o.id === 'versunkener_turm') {
      teileListe.push(teil(GEO.zylinder, 0x7a8a7a, o.x, h + 2, o.z, 0.18, 0, 0.1, 2.6, 5, 2.6));
    } else if (o.id === 'silbermine') {
      teileListe.push(teil(GEO.box, 0x6a5a4a, o.x - 2, h + 1.5, o.z, 0, 0, 0, 0.8, 3.2, 0.8));
      teileListe.push(teil(GEO.box, 0x6a5a4a, o.x + 2, h + 1.5, o.z, 0, 0, 0, 0.8, 3.2, 0.8));
      teileListe.push(teil(GEO.box, 0x6a5a4a, o.x, h + 3.2, o.z, 0, 0, 0, 4.8, 0.8, 0.8));
    } else if (o.id === 'sternwarte') {
      teileListe.push(teil(GEO.zylinder, 0xd8e0e8, o.x, h + 2, o.z, 0, 0, 0, 3.0, 4, 3.0));
      teileListe.push(teil(GEO.kugel, 0xb8c8d8, o.x, h + 4.4, o.z, 0, 0, 0, 3.2, 2.4, 3.2));
      teileListe.push(teil(GEO.zylinder, 0x5a6a7a, o.x + 1, h + 5.6, o.z, 0, 0, -0.6, 0.5, 2.6, 0.5));
    } else if (o.id === 'eisthron' || o.id === 'koenig_platz') {
      teileListe.push(teil(GEO.box, 0x9ad8e8, o.x, h + 1.4, o.z - 6, 0, 0, 0, 4, 2.8, 1.6));
      teileListe.push(teil(GEO.box, 0x9ad8e8, o.x, h + 3.6, o.z - 6.6, 0, 0, 0, 4, 4.4, 0.6));
      for (const s of [-3, 3]) teileListe.push(teil(GEO.kegel, 0xbae8f8, o.x + s, h + 3.2, o.z - 6, 0, 0, 0, 1.0, 4.4, 1.0));
    } else if (o.id === 'wrack') {
      teileListe.push(teil(GEO.box, 0x6a4a2a, o.x, h + 1.2, o.z, 0.3, 0.6, 0.25, 7, 2.2, 2.6));
      teileListe.push(teil(GEO.zylinder, 0x5a3e22, o.x, h + 3.6, o.z, 0, 0, 0.5, 0.25, 5, 0.25));
    } else if (o.id === 'arena_ruine') {
      for (let i = 0; i < 8; i++) {
        const w = i / 8 * Math.PI * 2;
        if (i % 3 === 0) continue;
        teileListe.push(teil(GEO.box, 0xd8cdb4, o.x + Math.cos(w) * 9, h + 1.4, o.z + Math.sin(w) * 9, 0, w, 0, 2.6, 2.8, 1.0));
      }
    } else if (o.id === 'aussichtsfels') {
      teileListe.push(teil(GEO.kugel, 0x8d8d82, o.x, h + 2, o.z, 0, 0, 0, 4.4, 3.2, 3.6));
    } else if (o.id === 'hexenhuette') {
      teileListe.push(teil(GEO.box, 0x4a3a2a, o.x, h + 1.4, o.z + 8, 0, 0.4, 0, 3.6, 2.8, 3.2));
      teileListe.push(teil(GEO.kegel, 0x3a2e22, o.x, h + 3.8, o.z + 8, 0, 0.4, 0, 3.2, 2.2, 3.2));
    }
  }
  const geo = verschmelze(teileListe);
  szene.add(new THREE.Mesh(geo, toonVertex()));
  szene.add(umriss(geo, 0.04));
}

// ---------------------------------------------------------------- Laufende Updates
export function updateWelt(dt) {
  if (wasserMesh) wasserMesh.position.y = WELT.wasser + Math.sin(S.zeit * 0.7) * 0.12;
  if (S.himmel && S.rig) S.himmel.position.copy(S.rig.position);
  // Nebelfarbe an Zone anpassen
  if (S.szene.fog && S.rig) {
    const zi = zoneIndexAn(S.rig.position.x, S.rig.position.z);
    const ziel = new THREE.Color(ZONEN[zi].nebel);
    S.szene.fog.color.lerp(ziel, Math.min(1, dt * 0.5));
  }
}

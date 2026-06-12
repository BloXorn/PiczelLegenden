// Die offene Welt — Grafik-Ausbau: weiches Gelände mit eingebackenem Licht,
// Himmel-Shader mit Sonne & Horizont-Bergen, Glitzer-Wasser, üppige Vegetation
// mit Boden-Schatten, detailreiche Städte je Zeitalter.
import * as THREE from 'three';
import { S, WELT, rngFabrik, klemme, lerp, glatt } from './zustand.js';
import { ZONEN, ORTE, zonenMitte } from './daten.js';
import { teil, verschmelze, toonVertex, GEO, umriss, fbm, blobTextur, bodenTexturen, gradientKarte } from './bau.js';

const kollisionsKreise = [];
let wasserMesh = null;
let ortHoehen = {}, stadtHoehen = {};
let pfade = [];
let wolkenHalter = null;
const animierteFlammen = [];   // {mesh, takt}
const leuchtPulse = [];        // {mesh, takt} z. B. Antennen
let himmelsstein = null;

// Für die Partikel-Effekte (effekte.js liest diese Listen)
export const rauchQuellen = [];  // {x, y, z}
export const feuerQuellen = [];  // {x, y, z, groesse}

// ---------------------------------------------------------------- Höhen-Profile je Biom (weiches fbm-Rauschen)
function profil(zone, x, z) {
  const b = ZONEN[zone].biom;
  if (b === 'wald') {
    return 9 + 11 * (fbm(x * 0.008, z * 0.008, 4) - 0.5) * 2
      + 1.2 * (fbm(x * 0.05 + 7, z * 0.05, 2) - 0.5);
  }
  if (b === 'kueste') {
    const t = klemme((z + 600) / 600, 0, 1);
    return lerp(-7, 14, glatt(klemme(t * 1.3, 0, 1)))
      + 3.5 * (fbm(x * 0.012, z * 0.012, 3) - 0.5) * 2
      + 0.8 * (fbm(x * 0.06, z * 0.06 + 3, 2) - 0.5);
  }
  if (b === 'steppe') {
    let h = 8 + 6 * (fbm(x * 0.007 + 11, z * 0.007, 4) - 0.5) * 2;
    const mesa = fbm(x * 0.004 + 30, z * 0.004 + 9, 3);
    if (mesa > 0.58) h += glatt(klemme((mesa - 0.58) / 0.12, 0, 1)) * 7; // Tafelberge
    return h;
  }
  if (b === 'moor') {
    let h = 4.2 + 2.4 * (fbm(x * 0.015 + 5, z * 0.015, 4) - 0.5) * 2;
    const p = fbm(x * 0.01 + 77, z * 0.01 + 13, 3);
    if (p > 0.56) h -= glatt(klemme((p - 0.56) / 0.14, 0, 1)) * 5.5; // dunkle Tümpel
    return h;
  }
  if (b === 'berge') {
    const grob = fbm(x * 0.0045 + 2, z * 0.0045 + 8, 4);
    const grat = 1 - Math.abs(2 * grob - 1);
    const maske = glatt(klemme((fbm(x * 0.003 + 50, z * 0.003, 2) - 0.35) / 0.3, 0, 1));
    return 9 + 34 * grat * grat * maske + 3 * (fbm(x * 0.02 + 9, z * 0.02, 3) - 0.5);
  }
  // frost
  const grob = fbm(x * 0.004 + 21, z * 0.004 + 33, 4);
  const grat = 1 - Math.abs(2 * grob - 1);
  const maske = glatt(klemme((fbm(x * 0.0028 + 4, z * 0.0028 + 60, 2) - 0.32) / 0.3, 0, 1));
  return 10 + 40 * grat * grat * maske + 3.5 * (fbm(x * 0.018 + 3, z * 0.018 + 44, 3) - 0.5);
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
  for (const o of ORTE) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < 26) h = lerp(h, ortHoehen[o.id], glatt((26 - d) / 14));
  }
  for (const p of pfade) {
    const { d, t } = distZuSegment(x, z, p.ax, p.az, p.bx, p.bz);
    if (d < 11) h = lerp(h, lerp(p.ha, p.hb, t), glatt((11 - d) / 7) * 0.85);
  }
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < 75) h = lerp(h, stadtHoehen[i], glatt((75 - d) / 45));
  }
  return h;
}

const _normal = new THREE.Vector3();
function gelaendeNormal(x, z) {
  const e = 1.6;
  _normal.set(hoeheAn(x - e, z) - hoeheAn(x + e, z), 2 * e, hoeheAn(x, z - e) - hoeheAn(x, z + e));
  return _normal.normalize();
}

// Schnelle Prüfung für den Gras-Teppich: kein Halm auf Plätzen, Wegen, Boss-Ringen
export function istFreiFuerGras(x, z) {
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    const dx = x - m.x, dz = z - m.z;
    if (dx * dx + dz * dz < 31 * 31) return false;
  }
  for (const p of pfade) {
    if (distZuSegment(x, z, p.ax, p.az, p.bx, p.bz).d < 6.5) return false;
  }
  for (const o of ORTE) {
    const dx = x - o.x, dz = z - o.z;
    if (dx * dx + dz * dz < 15 * 15) return false;
  }
  return true;
}

export function kollidiere(pos, radius = 0.4) {
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
  for (let i = 0; i < 6; i++) {
    const m = zonenMitte(i);
    stadtHoehen[i] = Math.max(rohHoehe(m.x, m.z), WELT.wasser + 2.5);
  }
  for (const o of ORTE) ortHoehen[o.id] = Math.max(rohHoehe(o.x, o.z), WELT.wasser + 1.5);
  pfade = [];
  for (let i = 0; i < 5; i++) {
    const a = zonenMitte(i), b = zonenMitte(i + 1);
    pfade.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ha: stadtHoehen[i], hb: stadtHoehen[i + 1] });
  }

  bauGelaende(szene);
  bauWasser(szene);
  bauHimmel(szene);
  bauVegetation(szene);
  bauWegRand(szene);
  for (let i = 0; i < 6; i++) bauStadt(szene, i);
  bauOrte(szene);
}

// Gelände-Material: Vertex-Farben + Detail-Texturen (Pflaster, Sand, Fels, Schnee, Gras-Erde)
function bodenMaterial() {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientKarte() });
  const tex = bodenTexturen();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.grasErdeMap = { value: tex.grasErde };
    shader.uniforms.pflasterMap = { value: tex.pflaster };
    shader.uniforms.sandMap = { value: tex.sand };
    shader.uniforms.felsMap = { value: tex.fels };
    shader.uniforms.schneeMap = { value: tex.schnee };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 misch;
        varying vec4 vMisch;
        varying vec2 vBodenUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMisch = misch;
        vBodenUv = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D grasErdeMap, pflasterMap, sandMap, felsMap, schneeMap;
        varying vec4 vMisch;
        varying vec2 vBodenUv;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float rest = max(0.0, 1.0 - vMisch.x - vMisch.y - vMisch.z - vMisch.w);
          vec3 detail =
            texture2D(pflasterMap, vBodenUv * 0.42).rgb * vMisch.x +
            texture2D(sandMap, vBodenUv * 0.55).rgb * vMisch.y +
            texture2D(felsMap, vBodenUv * 0.16).rgb * vMisch.z +
            texture2D(schneeMap, vBodenUv * 0.28).rgb * vMisch.w +
            texture2D(grasErdeMap, vBodenUv * 0.21).rgb * rest;
          diffuseColor.rgb *= detail * 1.08;
        }`);
  };
  return mat;
}

// ---------------------------------------------------------------- Gelände (mit eingebackenem Licht)
function bauGelaende(szene) {
  const SEGX = 360, SEGZ = 240;
  const geo = new THREE.PlaneGeometry(WELT.breite, WELT.tiefe, SEGX, SEGZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const n = pos.count;

  // 1. Durchgang: Höhen in ein Gitter
  const hoehen = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const h = hoeheAn(pos.getX(i), pos.getZ(i));
    hoehen[i] = h;
    pos.setY(i, h);
  }
  const idx = (ix, iz) => klemme(iz, 0, SEGZ) * (SEGX + 1) + klemme(ix, 0, SEGX);

  // 2. Durchgang: Farben (Zonen-Mischung, Flecken, Hang-Fels, Schnee, Sand, AO, Wege, Plätze)
  const farben = new Float32Array(n * 3);
  const mischArr = new Float32Array(n * 4); // x Pflaster, y Sand, z Fels, w Schnee
  const c = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();
  const sand = new THREE.Color(0xecdca8), sandTief = new THREE.Color(0xb8a87a),
    fels = new THREE.Color(0x8d8d82), schnee = new THREE.Color(0xf0f5f8),
    weg = new THREE.Color(0xcdb67e), platz = new THREE.Color(0xbeb4a0),
    platzDunkel = new THREE.Color(0xb3a994);
  const PATCH = { wald: 0x83b850, kueste: 0xa3cc74, steppe: 0xdcc873, moor: 0x4d6a3c, berge: 0x90a07c, frost: 0xdde8f0 };
  const dx = WELT.breite / SEGX, dz = WELT.tiefe / SEGZ;

  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = hoehen[i];
    const ix = i % (SEGX + 1), iz = Math.floor(i / (SEGX + 1));

    // Zonen-Grundfarbe weich gemischt
    const fx = klemme((x + 900) / 600 - 0.5, 0, 2), fz = klemme((z + 600) / 600 - 0.5, 0, 1);
    const zx = Math.floor(klemme(fx, 0, 1.999)), zz = Math.floor(klemme(fz, 0, 0.999));
    const tx = glatt(fx - zx), tz = glatt(fz - zz);
    c.setHex(ZONEN[zonenIndexVon(zx, zz)].bodenFarbe);
    c2.setHex(ZONEN[zonenIndexVon(Math.min(zx + 1, 2), zz)].bodenFarbe);
    c.lerp(c2, tx);
    c2.setHex(ZONEN[zonenIndexVon(zx, Math.min(zz + 1, 1))].bodenFarbe);
    c3.setHex(ZONEN[zonenIndexVon(Math.min(zx + 1, 2), Math.min(zz + 1, 1))].bodenFarbe);
    c2.lerp(c3, tx);
    c.lerp(c2, tz);

    const zoneHier = zoneIndexAn(x, z);

    // Frost-Anteil weich über die Zonen-Mischung (für die Schnee-Textur)
    const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz), w01 = (1 - tx) * tz, w11 = tx * tz;
    let frostW = 0;
    if (ZONEN[zonenIndexVon(zx, zz)].biom === 'frost') frostW += w00;
    if (ZONEN[zonenIndexVon(Math.min(zx + 1, 2), zz)].biom === 'frost') frostW += w10;
    if (ZONEN[zonenIndexVon(zx, Math.min(zz + 1, 1))].biom === 'frost') frostW += w01;
    if (ZONEN[zonenIndexVon(Math.min(zx + 1, 2), Math.min(zz + 1, 1))].biom === 'frost') frostW += w11;

    // Lebendige Farb-Variation + Wiesen-Flecken
    const variation = fbm(x * 0.045 + 9, z * 0.045, 2);
    c.multiplyScalar(0.92 + 0.16 * variation);
    const fleck = fbm(x * 0.016 + 200, z * 0.016, 2);
    if (fleck > 0.58) {
      c2.setHex(PATCH[ZONEN[zoneHier].biom]);
      c.lerp(c2, klemme((fleck - 0.58) / 0.1, 0, 1) * 0.55);
    }

    // Hang → Fels, Höhe → Schnee, Ufer → Sand
    const hx = (hoehen[idx(ix + 1, iz)] - hoehen[idx(ix - 1, iz)]) / (2 * dx);
    const hz = (hoehen[idx(ix, iz + 1)] - hoehen[idx(ix, iz - 1)]) / (2 * dz);
    const steigung = Math.hypot(hx, hz);
    const felsW = klemme((steigung - 0.38) * 2.2, 0, 0.85);
    if (felsW > 0) c.lerp(fels, felsW);
    const schneeHoehenW = klemme((h - 27) / 7, 0, 1);
    if (schneeHoehenW > 0) c.lerp(schnee, schneeHoehenW);
    const sandW = klemme((WELT.wasser + 1.4 - h) / 0.9, 0, 1) * 0.9;
    if (h < WELT.wasser + 1.4) c.lerp(sand, 0.85);
    if (h < WELT.wasser - 0.6) c.lerp(sandTief, 0.6);

    // Eingebackene Verschattung: Senken leicht dunkler (wie weiches AO)
    const lap = 4 * h - hoehen[idx(ix + 1, iz)] - hoehen[idx(ix - 1, iz)] - hoehen[idx(ix, iz + 1)] - hoehen[idx(ix, iz - 1)];
    if (lap < 0) c.multiplyScalar(1 - Math.min(0.16, -lap * 0.10));
    else c.multiplyScalar(1 + Math.min(0.06, lap * 0.04));

    // Wege mit unregelmäßigem Rand
    let wegW = 0;
    for (const p of pfade) {
      const { d } = distZuSegment(x, z, p.ax, p.az, p.bx, p.bz);
      const rand = 5 + 1.6 * fbm(x * 0.12, z * 0.12, 2);
      if (d < rand) { c.lerp(weg, 0.82); wegW = 1; break; }
      if (d < rand + 2) { const a = 1 - (d - rand) / 2; c.lerp(weg, 0.4 * a); wegW = a; break; }
    }
    // Stadt-Plätze: Pflaster-Muster
    let platzW = 0;
    for (let zi = 0; zi < 6; zi++) {
      const m = zonenMitte(zi);
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < 30) {
        const winkel = Math.atan2(z - m.z, x - m.x);
        const muster = (Math.floor(d * 0.7) + Math.floor((winkel + Math.PI) * 2.2)) % 2;
        c.lerp(muster ? platz : platzDunkel, 0.75);
        if (d > 27.6) c.lerp(platzDunkel, 0.5); // Rand-Ring
        platzW = klemme((30 - d) / 2.5, 0, 1);
        break;
      }
    }

    // Textur-Mischung: Pflaster gewinnt, dann Sand, dann Schnee, dann Fels
    let mPflaster = Math.max(wegW, platzW);
    let mSand = sandW * (1 - mPflaster);
    let mSchnee = Math.max(schneeHoehenW, frostW * 0.8) * (1 - mPflaster) * (1 - mSand);
    let mFels = felsW * (1 - mPflaster) * (1 - mSand) * (1 - mSchnee * 0.5);
    const summe = mPflaster + mSand + mSchnee + mFels;
    if (summe > 1) { mPflaster /= summe; mSand /= summe; mSchnee /= summe; mFels /= summe; }
    mischArr[i * 4] = mPflaster;
    mischArr[i * 4 + 1] = mSand;
    mischArr[i * 4 + 2] = mFels;
    mischArr[i * 4 + 3] = mSchnee;

    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  geo.setAttribute('misch', new THREE.BufferAttribute(mischArr, 4));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, bodenMaterial());
  mesh.name = 'gelaende';
  szene.add(mesh);
}

// ---------------------------------------------------------------- Wasser (Shader: Wellen, Glitzer, Sonnen-Glanz)
const SONNEN_RICHTUNG = new THREE.Vector3(0.55, 0.62, -0.45).normalize();

function bauWasser(szene) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        zeit: { value: 0 },
        flach: { value: new THREE.Color(0x7fdcec) },
        tief: { value: new THREE.Color(0x2878b8) },
        sonnenRichtung: { value: SONNEN_RICHTUNG.clone() },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float zeit;
      varying vec3 vWelt;
      void main() {
        vec4 welt = modelMatrix * vec4(position, 1.0);
        welt.y += sin(welt.x * 0.22 + zeit * 1.1) * 0.07 + sin(welt.z * 0.19 + zeit * 0.8) * 0.07;
        vWelt = welt.xyz;
        vec4 mvPosition = viewMatrix * welt;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 flach, tief, sonnenRichtung;
      uniform float zeit;
      varying vec3 vWelt;
      void main() {
        vec3 blick = normalize(cameraPosition - vWelt);
        float fresnel = pow(1.0 - max(blick.y, 0.0), 2.0);
        vec3 farbe = mix(tief, flach, 0.25 + 0.6 * fresnel);
        // Glitzer-Punkte, die langsam wandern
        vec2 zelle = floor(vWelt.xz * 1.8 + vec2(zeit * 0.7, zeit * 0.45));
        float funkel = fract(sin(dot(zelle, vec2(127.1, 311.7))) * 43758.5);
        if (funkel > 0.986) farbe += vec3(0.45);
        // Sonnen-Glanzstraße
        vec3 r = reflect(-blick, vec3(0.0, 1.0, 0.0));
        farbe += vec3(1.0, 0.95, 0.78) * pow(max(dot(r, sonnenRichtung), 0.0), 90.0) * 0.7;
        gl_FragColor = vec4(farbe, 0.88);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1800, 40, 30), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = WELT.wasser;
  szene.add(m);
  wasserMesh = m;
}

// ---------------------------------------------------------------- Himmel: Shader-Kuppel, Sonne, Horizont-Berge, Wolken
function bauHimmel(szene) {
  const halter = new THREE.Group();
  szene.add(halter);
  S.himmel = halter;

  const himmelMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      oben: { value: new THREE.Color(0x3a86e8) },
      horizont: { value: new THREE.Color(0xcfeaff) },
      unten: { value: new THREE.Color(0xdef0fa) },
      sonnenRichtung: { value: SONNEN_RICHTUNG.clone() },
      sonnenFarbe: { value: new THREE.Color(0xfff3c4) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 oben, horizont, unten, sonnenRichtung, sonnenFarbe;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 farbe = h > 0.0
          ? mix(horizont, oben, pow(h, 0.55))
          : mix(horizont, unten, min(1.0, -h * 3.0));
        float s = max(dot(vDir, sonnenRichtung), 0.0);
        farbe += sonnenFarbe * (pow(s, 600.0) * 1.4 + pow(s, 80.0) * 0.35 + pow(s, 8.0) * 0.10);
        gl_FragColor = vec4(farbe, 1.0);
      }`,
  });
  const kuppel = new THREE.Mesh(new THREE.SphereGeometry(720, 24, 14), himmelMat);
  kuppel.renderOrder = -3;
  halter.add(kuppel);

  // Horizont-Berge (zwei Silhouetten-Ringe für Tiefe)
  halter.add(bergRing(660, 110, 0xb4cfe8, 0x9cbcdc, 1));
  halter.add(bergRing(620, 70, 0x9cb8d4, 0x86a8c8, 2));

  // Wolken: flauschige Häufchen mit hellem Rücken & sanftem Schattenbauch
  wolkenHalter = new THREE.Group();
  halter.add(wolkenHalter);
  const rng = rngFabrik(777);
  const wolkenGeo = verschmelze([
    teil(GEO.kugelGrob, [0xffffff, 0xd8e4f0], 0, 0.5, 0, 0, 0, 0, 8, 4.6, 6),
    teil(GEO.kugelGrob, [0xffffff, 0xd8e4f0], 5.5, 1.6, 1, 0, 0, 0, 5.5, 3.6, 4.5),
    teil(GEO.kugelGrob, [0xffffff, 0xd8e4f0], -5.5, 1.2, -1, 0, 0, 0, 5, 3.2, 4.2),
    teil(GEO.kugelGrob, [0xffffff, 0xdce8f2], 1, 2.6, -2, 0, 0, 0, 4.4, 3, 4),
  ]);
  const wolken = new THREE.InstancedMesh(wolkenGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.96 }), 20);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();
  for (let i = 0; i < 20; i++) {
    const wink = rng() * Math.PI * 2, r = 180 + rng() * 380;
    e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
    v.set(Math.cos(wink) * r, 130 + rng() * 90, Math.sin(wink) * r);
    const s = 0.8 + rng() * 1.6;
    sk.set(s, s * 0.8, s);
    m4.compose(v, q, sk);
    wolken.setMatrixAt(i, m4);
  }
  halter.add(wolken);

  // Licht: warme Sonne, kühle Schatten (Walkabout-Kontrast)
  szene.add(new THREE.HemisphereLight(0xfff4e0, 0x7a8fb8, 1.05));
  const sonnenLicht = new THREE.DirectionalLight(0xffeec8, 1.7);
  sonnenLicht.position.copy(SONNEN_RICHTUNG);
  szene.add(sonnenLicht);
}

function bergRing(radius, hoeheMax, farbeSpitzeHex, farbeBasisHex, seed) {
  const rng = rngFabrik(900 + seed);
  const punkte = [], farben = [];
  const basis = new THREE.Color(farbeBasisHex), spitze = new THREE.Color(farbeSpitzeHex);
  const anzahl = 42;
  for (let k = 0; k < anzahl; k++) {
    const a0 = (k / anzahl) * Math.PI * 2;
    const breite = (1.2 + rng() * 1.6) * (Math.PI * 2 / anzahl);
    const mitte = a0 + breite / 2;
    const h = hoeheMax * (0.35 + rng() * 0.65);
    const y0 = -14;
    const p = (a, y) => [Math.cos(a) * radius, y, Math.sin(a) * radius];
    punkte.push(...p(a0, y0), ...p(a0 + breite, y0), ...p(mitte, h));
    farben.push(basis.r, basis.g, basis.b, basis.r, basis.g, basis.b, spitze.r, spitze.g, spitze.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(punkte, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  mesh.renderOrder = -2;
  return mesh;
}

// ---------------------------------------------------------------- Vegetation (Varianten + Boden-Schatten)
function gv(geoListe) { return Array.isArray(geoListe) ? geoListe : [geoListe]; }

// — Pflanzen-Baukasten (alle mit senkrechtem Farbverlauf = weiches Licht)
function laubbaum(rng) {
  const stamm = [0x9a6b3e, 0x5e3c20];
  const kroneHell = 0x55a843, kroneDunkel = 0x2f6e2a;
  const t = [
    teil(GEO.zylinderGrob, stamm, 0, 1.2, 0, 0, 0, (rng() - 0.5) * 0.16, 0.5, 2.4, 0.5),
    teil(GEO.kugelGrob, [kroneHell, kroneDunkel], 0, 3.3, 0, 0, 0, 0, 2.8, 2.5, 2.8),
    teil(GEO.kugelGrob, [0x66b850, 0x3a7a32], 1.2, 2.6, 0.5, 0, 0, 0, 1.9),
    teil(GEO.kugelGrob, [0x4a9a3c, 0x2a6326], -1.1, 2.7, -0.4, 0, 0, 0, 1.8),
  ];
  if (rng() < 0.35) for (let i = 0; i < 3; i++)
    t.push(teil(GEO.kugelGrob, 0xe84a3a, (rng() - 0.5) * 2.6, 2.4 + rng() * 1.6, (rng() - 0.5) * 2.6, 0, 0, 0, 0.22));
  return verschmelze(t);
}
function busch() {
  return verschmelze([
    teil(GEO.kugelGrob, [0x5fae4c, 0x2f6e2a], 0, 0.55, 0, 0, 0, 0, 1.5, 1.0, 1.5),
    teil(GEO.kugelGrob, [0x6fbe58, 0x3a7a32], 0.6, 0.45, 0.3, 0, 0, 0, 1.0, 0.8, 1.0),
  ]);
}
function blume(farbeKopf) {
  return verschmelze([
    teil(GEO.kegelSpitz, [0x5fae4c, 0x3a7a32], 0, 0.35, 0, Math.PI, 0, 0, 0.1, 0.7, 0.1),
    teil(GEO.kugelGrob, [farbeKopf, farbeKopf], 0, 0.72, 0, 0, 0, 0, 0.42, 0.3, 0.42),
    teil(GEO.kugelGrob, 0xffe070, 0, 0.78, 0, 0, 0, 0, 0.16),
  ]);
}
function grasBueschel(hell, dunkel) {
  const t = [];
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * Math.PI * 2;
    t.push(teil(GEO.kegelSpitz, [hell, dunkel], Math.cos(w) * 0.16, 0.42, Math.sin(w) * 0.16, Math.PI, 0, (i % 2 ? 0.22 : -0.18), 0.13, 0.85, 0.13));
  }
  return verschmelze(t);
}
function pilz(kopfFarbe, gross = 1) {
  return verschmelze([
    teil(GEO.zylinderGrob, [0xe8dcc0, 0xc0b090], 0, 0.45 * gross, 0, 0, 0, 0, 0.3 * gross, 0.9 * gross, 0.3 * gross),
    teil(GEO.kugelGrob, [kopfFarbe, 0x7a3a64], 0, 0.95 * gross, 0, 0, 0, 0, 1.1 * gross, 0.7 * gross, 1.1 * gross),
    teil(GEO.kugelGrob, 0xfae8f0, 0.3 * gross, 1.1 * gross, 0.2 * gross, 0, 0, 0, 0.18 * gross),
  ]);
}
function stein(hell, dunkel, rng) {
  return verschmelze([
    teil(GEO.kugelGrob, [hell, dunkel], 0, 0.4, 0, 0.3, rng() * 3, 0.2, 1.5, 1.0, 1.2),
    teil(GEO.kugelGrob, [hell, dunkel], 0.8, 0.22, 0.3, 0.2, rng() * 3, 0, 0.9, 0.6, 0.8),
  ]);
}
function baumstumpf() {
  return verschmelze([
    teil(GEO.zylinderGrob, [0x8a5f36, 0x4e3018], 0, 0.35, 0, 0, 0, 0, 0.7, 0.7, 0.7),
    teil(GEO.zylinderGrob, [0xc8a878, 0xc8a878], 0, 0.71, 0, 0, 0, 0, 0.6, 0.04, 0.6),
  ]);
}
function liegenderStamm(rng) {
  return verschmelze([
    teil(GEO.zylinderGrob, [0x7a5230, 0x4e3018], 0, 0.35, 0, 0, 0, Math.PI / 2, 0.55, 3.4, 0.55),
    teil(GEO.kugelGrob, [0x5fae4c, 0x3a7a32], 0.8, 0.62, 0.1, 0, 0, 0, 0.55, 0.35, 0.55),
  ]);
}
function palme(rng) {
  const t = [];
  let px = 0;
  for (let s = 0; s < 3; s++) {
    px += s * 0.16;
    t.push(teil(GEO.zylinderGrob, [0xab8454, 0x6e5230], px, 0.8 + s * 1.5, 0, 0, 0, 0.12 + s * 0.06, 0.42 - s * 0.06, 1.6, 0.42 - s * 0.06));
  }
  const kx = px + 0.3;
  for (let i = 0; i < 6; i++) {
    const w = (i / 6) * Math.PI * 2;
    t.push(teil(GEO.kegelGrob, [0x4fae5c, 0x2e7a3c], kx + Math.cos(w) * 1.5, 4.7, Math.sin(w) * 1.5, Math.cos(w) * 0.5, 0, -Math.sin(w) * 0.5 - 0.9, 0.85, 2.8, 0.3));
  }
  t.push(teil(GEO.kugelGrob, [0x7a5230, 0x4e3018], kx, 4.55, 0.3, 0, 0, 0, 0.3));
  t.push(teil(GEO.kugelGrob, [0x7a5230, 0x4e3018], kx + 0.3, 4.5, -0.2, 0, 0, 0, 0.3));
  return verschmelze(t);
}
function seestern() {
  const t = [];
  for (let i = 0; i < 5; i++) {
    const w = (i / 5) * Math.PI * 2;
    t.push(teil(GEO.kegelGrob, [0xf09a5a, 0xd8784a], Math.cos(w) * 0.3, 0.07, Math.sin(w) * 0.3, Math.PI / 2 * 0.94, -w, 0, 0.3, 0.7, 0.12));
  }
  t.push(teil(GEO.kugelGrob, [0xf0aa6a, 0xd8784a], 0, 0.1, 0, 0, 0, 0, 0.35, 0.16, 0.35));
  return verschmelze(t);
}
function muschel() {
  return verschmelze([
    teil(GEO.kugelGrob, [0xfaf0e0, 0xd8c0a8], 0, 0.16, 0, 0.5, 0, 0, 0.5, 0.3, 0.45),
    teil(GEO.kugelGrob, [0xf0d8e8, 0xd8b8c8], 0.1, 0.2, 0.1, 0.4, 0.6, 0, 0.2),
  ]);
}
function akazie() {
  return verschmelze([
    teil(GEO.zylinderGrob, [0x8a6a42, 0x4e3a20], 0, 1.7, 0, 0, 0, 0.2, 0.32, 3.4, 0.32),
    teil(GEO.zylinderGrob, [0x8a6a42, 0x4e3a20], 0.7, 2.9, 0.2, 0, 0, -0.7, 0.2, 1.6, 0.2),
    teil(GEO.kugelGrob, [0x84a848, 0x55702c], 0.4, 3.9, 0, 0, 0, 0, 3.6, 0.9, 3.6),
    teil(GEO.kugelGrob, [0x94b855, 0x60803a], -0.8, 3.6, 0.6, 0, 0, 0, 1.8, 0.55, 1.8),
  ]);
}
function dornbusch(rng) {
  const t = [];
  for (let i = 0; i < 5; i++) {
    const w = rng() * Math.PI * 2;
    t.push(teil(GEO.kegelSpitz, [0x6a5a3a, 0x3e3220], Math.cos(w) * 0.2, 0.5, Math.sin(w) * 0.2, Math.PI + (rng() - 0.5) * 0.9, w, (rng() - 0.5) * 0.9, 0.08, 1.1 + rng() * 0.5, 0.08));
  }
  return verschmelze(t);
}
function moorbaum(rng) {
  const t = [
    teil(GEO.zylinderGrob, [0x5e4a34, 0x32261a], 0, 1.9, 0, 0, 0, (rng() - 0.5) * 0.2, 0.42, 3.8, 0.42),
    teil(GEO.kegelSpitz, [0x5e4a34, 0x3a2e1e], 0.7, 3.6, 0.1, 0, 0, -0.85, 0.16, 2.0, 0.16),
    teil(GEO.kegelSpitz, [0x5e4a34, 0x3a2e1e], -0.6, 3.9, -0.2, 0, 0, 0.75, 0.14, 1.7, 0.14),
    teil(GEO.kegelSpitz, [0x5e4a34, 0x3a2e1e], 0.1, 4.3, 0.5, 0.7, 0, 0.1, 0.12, 1.4, 0.12),
  ];
  if (rng() < 0.5) t.push(teil(GEO.kugelGrob, [0x57713f, 0x35492a], 0.5, 4.4, 0, 0, 0, 0, 1.3, 0.6, 1.3));
  return verschmelze(t);
}
function schilf(rng) {
  const t = [];
  for (let i = 0; i < 3; i++) {
    const ox = (rng() - 0.5) * 0.5, oz = (rng() - 0.5) * 0.5;
    const hoch = 1.4 + rng() * 0.8;
    t.push(teil(GEO.kegelSpitz, [0x8aa858, 0x55703a], ox, hoch / 2, oz, Math.PI, 0, (rng() - 0.5) * 0.2, 0.08, hoch, 0.08));
    t.push(teil(GEO.kapsel, [0x7a5a38, 0x5e4226], ox, hoch + 0.18, oz, 0, 0, 0, 0.14, 0.3, 0.14));
  }
  return verschmelze(t);
}
function seerose() {
  return verschmelze([
    teil(GEO.scheibe, [0x4f9e44, 0x3a7a32], 0, 0.02, 0, -Math.PI / 2, 0, 0, 1.3, 1.3, 1),
    teil(GEO.kugelGrob, [0xf8b8d8, 0xe88ab8], 0.2, 0.14, 0.1, 0, 0, 0, 0.4, 0.26, 0.4),
    teil(GEO.kugelGrob, 0xffe070, 0.2, 0.24, 0.1, 0, 0, 0, 0.12),
  ]);
}
function nadelbaum(schneeig, rng) {
  const gruenH = schneeig ? 0x4a8a5e : 0x4a8a48, gruenD = schneeig ? 0x2c5a3c : 0x2a5a2c;
  const t = [
    teil(GEO.zylinderGrob, [0x7a5230, 0x4a3018], 0, 0.7, 0, 0, 0, 0, 0.42, 1.4, 0.42),
    teil(GEO.kegelGrob, [gruenH, gruenD], 0, 2.4, 0, 0, 0, 0, 2.7, 2.6, 2.7),
    teil(GEO.kegelGrob, [gruenH, gruenD], 0, 3.9, 0, 0, 0, 0, 2.1, 2.2, 2.1),
    teil(GEO.kegelGrob, [gruenH, gruenD], 0, 5.2, 0, 0, 0, 0, 1.4, 1.9, 1.4),
  ];
  if (schneeig) {
    t.push(teil(GEO.kegelGrob, [0xffffff, 0xd8e6f0], 0, 5.65, 0, 0, 0, 0, 1.0, 1.0, 1.0));
    t.push(teil(GEO.kegelGrob, [0xffffff, 0xdfe9f2], 0, 4.35, 0, 0, 0, 0, 1.7, 0.7, 1.7));
    t.push(teil(GEO.kegelGrob, [0xffffff, 0xdfe9f2], 0, 2.95, 0, 0, 0, 0, 2.2, 0.7, 2.2));
  }
  return verschmelze(t);
}
function felsBrocken(hell, dunkel, rng) {
  return verschmelze([
    teil(GEO.kugelGrob, [hell, dunkel], 0, 0.8, 0, 0.4, rng() * 3, 0.25, 2.6, 1.9, 2.2),
    teil(GEO.kugelGrob, [hell, dunkel], 1.4, 0.45, 0.5, 0.2, rng() * 3, 0, 1.4, 1.0, 1.2),
    teil(GEO.kugelGrob, [hell, dunkel], -1.2, 0.4, -0.4, 0.5, rng() * 3, 0.3, 1.1, 0.8, 1.0),
  ]);
}
function kristall(farbeHell, farbeDunkel, rng) {
  const t = [];
  for (let i = 0; i < 4; i++) {
    const w = rng() * Math.PI * 2, r = rng() * 0.4;
    t.push(teil(GEO.kegelGrob, [0xffffff, farbeDunkel],
      Math.cos(w) * r, 0.7 + rng() * 0.5, Math.sin(w) * r,
      (rng() - 0.5) * 0.5, w, (rng() - 0.5) * 0.5,
      0.3 + rng() * 0.2, 1.4 + rng() * 1.2, 0.3 + rng() * 0.2));
  }
  t.push(teil(GEO.kugelGrob, [farbeHell, farbeDunkel], 0, 0.2, 0, 0, 0, 0, 1.0, 0.5, 1.0));
  return verschmelze(t);
}
function schneehaufen() {
  return verschmelze([teil(GEO.kugelGrob, [0xffffff, 0xdce8f2], 0, 0.25, 0, 0, 0, 0, 1.8, 0.7, 1.5)]);
}
function toterBusch(rng) {
  const t = [];
  for (let i = 0; i < 4; i++) {
    const w = rng() * Math.PI * 2;
    t.push(teil(GEO.kegelSpitz, [0x6a5a48, 0x3e3428], Math.cos(w) * 0.15, 0.4, Math.sin(w) * 0.15, Math.PI + (rng() - 0.5) * 0.8, w, (rng() - 0.5) * 0.8, 0.07, 0.9, 0.07));
  }
  return verschmelze(t);
}
function farn(rng) {
  const t = [];
  for (let i = 0; i < 6; i++) {
    const w = (i / 6) * Math.PI * 2 + rng() * 0.5;
    t.push(teil(GEO.kegelGrob, [0x5fae4c, 0x2e6e2a],
      Math.cos(w) * 0.5, 0.42, Math.sin(w) * 0.5,
      Math.cos(w) * 1.05, -w, -Math.sin(w) * 1.05,
      0.4, 1.3, 0.1));
  }
  return verschmelze(t);
}
function treibholz(rng) {
  return verschmelze([
    teil(GEO.zylinderGrob, [0xcdbb9e, 0x96866a], 0, 0.28, 0, 0, 0, Math.PI / 2, 0.4, 2.8, 0.4),
    teil(GEO.zylinderGrob, [0xc2b094, 0x8a7a5e], 0.7, 0.4, 0.2, 0.7, 0, 1.2, 0.18, 1.2, 0.18),
  ]);
}
function steinhaufen(hell, dunkel, rng) {
  const t = [];
  for (let i = 0; i < 5; i++) {
    const w = rng() * Math.PI * 2, r = rng() * 0.45;
    t.push(teil(GEO.kugelGrob, [hell, dunkel], Math.cos(w) * r, 0.16 + rng() * 0.1, Math.sin(w) * r, rng(), rng() * 3, rng(), 0.4 + rng() * 0.3, 0.3 + rng() * 0.2, 0.35 + rng() * 0.25));
  }
  return verschmelze(t);
}
function buschTrocken() {
  return verschmelze([
    teil(GEO.kugelGrob, [0xa8a058, 0x6e6838], 0, 0.5, 0, 0, 0, 0, 1.4, 0.9, 1.4),
    teil(GEO.kugelGrob, [0xb8b068, 0x7e7848], 0.55, 0.4, 0.25, 0, 0, 0, 0.9, 0.7, 0.9),
  ]);
}
function schneeBusch() {
  return verschmelze([
    teil(GEO.kugelGrob, [0x7a9a6e, 0x4a6a44], 0, 0.45, 0, 0, 0, 0, 1.3, 0.85, 1.3),
    teil(GEO.kugelGrob, [0xffffff, 0xdfe9f2], 0, 0.78, 0, 0, 0, 0, 1.0, 0.4, 1.0),
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

// Streut einen Pflanzen-Typ in einer Zone; sammelt Boden-Schatten ein
function streueTyp(szene, zone, varianten, anzahl, seed, opt, schattenListe) {
  const rng = rngFabrik(seed + zone.id * 131);
  const geos = gv(varianten);
  const proVariante = Math.ceil(anzahl / geos.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();
  const mx = zonenMitte(zone.id);
  for (const geo of geos) {
    const mesh = new THREE.InstancedMesh(geo, toonVertex(), proVariante);
    let gesetzt = 0, versuche = 0;
    while (gesetzt < proVariante && versuche++ < proVariante * 16) {
      const x = mx.x + (rng() - 0.5) * 580;
      const z = mx.z + (rng() - 0.5) * 580;
      if (!platzFrei(x, z)) continue;
      const h = hoeheAn(x, z);
      if (opt.imWasser) {
        if (h > WELT.wasser - 0.25) continue;
      } else {
        if (h < (opt.minH ?? WELT.wasser + 0.5)) continue;
        if (opt.maxH !== undefined && h > opt.maxH) continue;
      }
      const steigung = Math.abs(hoeheAn(x + 2.5, z) - h) / 2.5;
      if (steigung > (opt.maxSteigung ?? 0.5)) continue;
      const s = (opt.skala?.[0] ?? 0.8) + rng() * ((opt.skala?.[1] ?? 1.3) - (opt.skala?.[0] ?? 0.8));
      e.set(0, rng() * 6.28, 0); q.setFromEuler(e);
      const y = opt.imWasser ? WELT.wasser + 0.06 : h - 0.12;
      v.set(x, y, z); sk.set(s, s, s);
      m4.compose(v, q, sk);
      mesh.setMatrixAt(gesetzt++, m4);
      if (opt.schatten && !opt.imWasser) schattenListe.push({ x, y: h, z, groesse: opt.schatten * s });
    }
    mesh.count = gesetzt;
    szene.add(mesh);
  }
}

function bauVegetation(szene) {
  const rngB = rngFabrik(31);
  for (const zone of ZONEN) {
    const schatten = [];
    const b = zone.biom;
    if (b === 'wald') {
      streueTyp(szene, zone, [laubbaum(rngB), laubbaum(rngB), laubbaum(rngB), laubbaum(rngB)], 560, 100, { schatten: 2.4, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, busch(), 460, 101, { schatten: 1.1 }, schatten);
      streueTyp(szene, zone, farn(rngB), 240, 108, { skala: [0.7, 1.3] }, schatten);
      streueTyp(szene, zone, [blume(0xe85a8a), blume(0xf0f0f8), blume(0x6a8af5)], 420, 102, { skala: [0.7, 1.1] }, schatten);
      streueTyp(szene, zone, grasBueschel(0x76c258, 0x3f8a36), 1500, 103, { skala: [0.8, 1.6] }, schatten);
      streueTyp(szene, zone, pilz(0xc84a3a), 90, 104, { skala: [0.5, 0.9] }, schatten);
      streueTyp(szene, zone, [stein(0x9a9a8e, 0x6a6a60, rngB), steinhaufen(0x9a9a8e, 0x6a6a60, rngB)], 160, 105, { schatten: 1.2 }, schatten);
      streueTyp(szene, zone, baumstumpf(), 50, 106, {}, schatten);
      streueTyp(szene, zone, liegenderStamm(rngB), 40, 107, { schatten: 1.6 }, schatten);
    } else if (b === 'kueste') {
      streueTyp(szene, zone, [palme(rngB), palme(rngB), palme(rngB)], 170, 110, { schatten: 2.0, minH: WELT.wasser + 0.8, skala: [0.8, 1.3] }, schatten);
      streueTyp(szene, zone, grasBueschel(0x9ed070, 0x5f9a48), 900, 111, {}, schatten);
      streueTyp(szene, zone, muschel(), 110, 112, { maxH: WELT.wasser + 1.6, skala: [0.6, 1.1] }, schatten);
      streueTyp(szene, zone, seestern(), 70, 113, { maxH: WELT.wasser + 1.2, skala: [0.7, 1.2] }, schatten);
      streueTyp(szene, zone, treibholz(rngB), 80, 116, { maxH: WELT.wasser + 2.2, skala: [0.7, 1.3] }, schatten);
      streueTyp(szene, zone, [felsBrocken(0xb8b0a0, 0x7a7264, rngB), steinhaufen(0xc2b8a4, 0x8a8070, rngB)], 150, 114, { schatten: 2.2, skala: [0.5, 1.1] }, schatten);
      streueTyp(szene, zone, busch(), 240, 115, { schatten: 1.1, minH: WELT.wasser + 1.5 }, schatten);
      streueTyp(szene, zone, [blume(0xf06a9a), blume(0xf0c84a)], 200, 117, { minH: WELT.wasser + 1.5 }, schatten);
    } else if (b === 'steppe') {
      streueTyp(szene, zone, [akazie(), akazie()], 130, 120, { schatten: 2.8, skala: [0.9, 1.6] }, schatten);
      streueTyp(szene, zone, dornbusch(rngB), 260, 121, { skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, buschTrocken(), 280, 125, { schatten: 1.0 }, schatten);
      streueTyp(szene, zone, grasBueschel(0xd8c46a, 0x9a8a44), 1800, 122, { skala: [0.8, 1.7] }, schatten);
      streueTyp(szene, zone, blume(0xf0c84a), 300, 123, {}, schatten);
      streueTyp(szene, zone, [felsBrocken(0xc2b294, 0x8a7a5c, rngB), steinhaufen(0xc2b294, 0x8a7a5c, rngB)], 170, 124, { schatten: 2.2, skala: [0.4, 1.1] }, schatten);
      streueTyp(szene, zone, treibholz(rngB), 60, 126, { skala: [0.6, 1.0] }, schatten);
    } else if (b === 'moor') {
      streueTyp(szene, zone, [moorbaum(rngB), moorbaum(rngB), moorbaum(rngB)], 280, 130, { schatten: 1.8, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, schilf(rngB), 1100, 131, { minH: WELT.wasser - 0.1, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, farn(rngB), 280, 136, { skala: [0.7, 1.4] }, schatten);
      streueTyp(szene, zone, pilz(0xa84a8a, 1.4), 140, 132, { skala: [0.6, 1.3] }, schatten);
      streueTyp(szene, zone, seerose(), 130, 133, { imWasser: true, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, [stein(0x7a8272, 0x4e5648, rngB), steinhaufen(0x7a8272, 0x4e5648, rngB)], 120, 134, { schatten: 1.2 }, schatten);
      streueTyp(szene, zone, grasBueschel(0x6a9a4c, 0x3f6a34), 800, 135, {}, schatten);
      streueTyp(szene, zone, busch(), 220, 137, { schatten: 1.0 }, schatten);
    } else if (b === 'berge') {
      streueTyp(szene, zone, [nadelbaum(false, rngB), nadelbaum(false, rngB), nadelbaum(false, rngB)], 360, 140, { schatten: 2.0, maxH: 26, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, [felsBrocken(0x9a9a90, 0x62625a, rngB), felsBrocken(0x8a8a80, 0x55554d, rngB), steinhaufen(0x9a9a90, 0x62625a, rngB)], 280, 141, { schatten: 2.6, maxSteigung: 0.8, skala: [0.5, 1.5] }, schatten);
      streueTyp(szene, zone, grasBueschel(0x8ab060, 0x55703a), 700, 142, { maxH: 24 }, schatten);
      streueTyp(szene, zone, busch(), 260, 145, { schatten: 1.0, maxH: 24 }, schatten);
      streueTyp(szene, zone, kristall(0xbae8ff, 0x4a9ad8, rngB), 50, 143, { skala: [0.7, 1.5] }, schatten);
      streueTyp(szene, zone, blume(0xf8f8ff), 160, 144, { maxH: 24 }, schatten);
      streueTyp(szene, zone, baumstumpf(), 50, 146, { maxH: 24 }, schatten);
    } else { // frost
      streueTyp(szene, zone, [nadelbaum(true, rngB), nadelbaum(true, rngB), nadelbaum(true, rngB)], 330, 150, { schatten: 2.0, maxH: 30, skala: [0.8, 1.5] }, schatten);
      streueTyp(szene, zone, [felsBrocken(0xd8e2ea, 0x9ab0c0, rngB), steinhaufen(0xd8e2ea, 0x9ab0c0, rngB)], 200, 151, { schatten: 2.4, maxSteigung: 0.8, skala: [0.5, 1.3] }, schatten);
      streueTyp(szene, zone, kristall(0xc0f0ff, 0x4ab8e8, rngB), 70, 152, { skala: [0.8, 1.9] }, schatten);
      streueTyp(szene, zone, schneehaufen(), 180, 153, { skala: [0.8, 2.0] }, schatten);
      streueTyp(szene, zone, toterBusch(rngB), 150, 154, {}, schatten);
      streueTyp(szene, zone, schneeBusch(), 180, 155, { schatten: 1.0 }, schatten);
    }
    bauSchattenScheiben(szene, schatten);
  }
}

// Alle Boden-Schatten einer Zone in EINEM InstancedMesh
let schattenGeo = null, schattenMat = null;
function bauSchattenScheiben(szene, liste) {
  if (!liste.length) return;
  if (!schattenGeo) {
    schattenGeo = new THREE.PlaneGeometry(2, 2);
    schattenGeo.rotateX(-Math.PI / 2);
    schattenMat = new THREE.MeshBasicMaterial({ map: blobTextur(), transparent: true, depthWrite: false, opacity: 0.85 });
  }
  const mesh = new THREE.InstancedMesh(schattenGeo, schattenMat, liste.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sk = new THREE.Vector3();
  const oben = new THREE.Vector3(0, 1, 0);
  liste.forEach((s, i) => {
    const n = gelaendeNormal(s.x, s.z);
    q.setFromUnitVectors(oben, n);
    v.set(s.x, s.y + 0.07, s.z);
    sk.set(s.groesse, 1, s.groesse);
    m4.compose(v, q, sk);
    mesh.setMatrixAt(i, m4);
  });
  mesh.renderOrder = 1;
  szene.add(mesh);
}

// Steinchen am Wegesrand
function bauWegRand(szene) {
  const rng = rngFabrik(555);
  const geo = verschmelze([teil(GEO.kugelGrob, [0xb0a890, 0x7a7260], 0, 0.14, 0, 0.3, 0, 0.2, 0.5, 0.3, 0.4)]);
  const positionen = [];
  for (const p of pfade) {
    const laenge = Math.hypot(p.bx - p.ax, p.bz - p.az);
    const schritte = Math.floor(laenge / 14);
    for (let s = 1; s < schritte; s++) {
      const t = s / schritte;
      const x = lerp(p.ax, p.bx, t), z = lerp(p.az, p.bz, t);
      const nx = -(p.bz - p.az) / laenge, nz = (p.bx - p.ax) / laenge;
      for (const seite of [-1, 1]) {
        if (rng() < 0.55) continue;
        const ox = x + nx * seite * (6 + rng() * 1.5), oz = z + nz * seite * (6 + rng() * 1.5);
        const h = hoeheAn(ox, oz);
        if (h < WELT.wasser + 0.3) continue;
        positionen.push({ x: ox, y: h, z: oz, s: 0.7 + rng() * 0.9, w: rng() * 6.28 });
      }
    }
  }
  const mesh = new THREE.InstancedMesh(geo, toonVertex(), positionen.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();
  positionen.forEach((p, i) => {
    e.set(0, p.w, 0); q.setFromEuler(e);
    v.set(p.x, p.y, p.z); sk.set(p.s, p.s, p.s);
    m4.compose(v, q, sk);
    mesh.setMatrixAt(i, m4);
  });
  szene.add(mesh);
}

// ---------------------------------------------------------------- Städte (Zeitalter, jetzt mit viel mehr Leben)
function gebaeude(era, rng) {
  if (era === 'steinzeit') {
    return { r: 3.2, teile: [
      teil(GEO.kegel, [0xc89868, 0x8a6038], 0, 2.2, 0, 0, 0, 0, 4.4, 4.4, 4.4),
      teil(GEO.zylinderGrob, [0x6a4a2a, 0x4a3018], 0, 3.8, 0, 0, 0, 0.3, 0.15, 2.6, 0.15),
      teil(GEO.zylinderGrob, [0x6a4a2a, 0x4a3018], 0.4, 3.8, 0.2, 0, 0, -0.3, 0.15, 2.6, 0.15),
      teil(GEO.box, [0x4e3a26, 0x32241a], 0, 0.9, 2.0, 0, 0, 0, 1.2, 1.8, 0.3),
    ] };
  }
  if (era === 'bronzezeit') {
    return { r: 3.4, teile: [
      teil(GEO.zylinder, [0xe2c498, 0xb89068], 0, 1.6, 0, 0, 0, 0, 5.4, 3.2, 5.4),
      teil(GEO.kugel, [0xd8b080, 0xa88050], 0, 3.4, 0, 0, 0, 0, 5.6, 3.4, 5.6),
      teil(GEO.box, [0x6a4a2a, 0x46301a], 0, 1.0, 2.6, 0, 0, 0, 1.2, 2.0, 0.3),
      teil(GEO.box, [0x5a7a9a, 0x3e5870], -1.6, 1.7, 2.55, 0, 0, 0, 0.9, 0.9, 0.15),
      teil(GEO.box, [0x5a7a9a, 0x3e5870], 1.6, 1.7, 2.55, 0, 0, 0, 0.9, 0.9, 0.15),
    ] };
  }
  if (era === 'antike') {
    const t = [
      teil(GEO.box, [0xfaf2e0, 0xd8ccb0], 0, 0.4, 0, 0, 0, 0, 7, 0.8, 5.4),
      teil(GEO.box, [0xfaf2e0, 0xe0d4b8], 0, 4.4, 0, 0, 0, 0, 7, 0.7, 5.4),
      teil(GEO.kegel, [0xd8845a, 0xa85a3a], 0, 5.6, 0, 0, Math.PI / 4, 0, 5.4, 1.8, 5.4),
    ];
    for (let i = -1; i <= 1; i++) {
      t.push(teil(GEO.zylinderGrob, [0xfffaf0, 0xd8ccb0], i * 2.4, 2.4, 2.2, 0, 0, 0, 0.5, 3.4, 0.5));
      t.push(teil(GEO.zylinderGrob, [0xfffaf0, 0xd8ccb0], i * 2.4, 2.4, -2.2, 0, 0, 0, 0.5, 3.4, 0.5));
    }
    return { r: 4.4, teile: t };
  }
  if (era === 'mittelalter') {
    const t = [
      teil(GEO.box, [0x9a8a72, 0x6e6250], 0, 0.8, 0, 0, 0, 0, 5.4, 1.6, 4.8),       // Steinsockel
      teil(GEO.box, [0xfaf0d8, 0xe0d2b0], 0, 2.5, 0, 0, 0, 0, 5.2, 1.9, 4.6),       // Fachwerk-Stock
      teil(GEO.box, [0x5e4630, 0x3e2e1e], 0, 2.5, 2.31, 0, 0, 0.6, 0.28, 2.4, 0.06),
      teil(GEO.box, [0x5e4630, 0x3e2e1e], 0, 2.5, 2.31, 0, 0, -0.6, 0.28, 2.4, 0.06),
      teil(GEO.box, [0x5e4630, 0x3e2e1e], 0, 1.62, 2.31, 0, 0, 0, 5.2, 0.3, 0.06),
      teil(GEO.box, [0x5e4630, 0x3e2e1e], 0, 3.4, 2.31, 0, 0, 0, 5.2, 0.3, 0.06),
      teil(GEO.kegel, [0xa84a36, 0x6e2e22], 0, 4.9, 0, 0, Math.PI / 4, 0, 4.6, 2.6, 4.6),
      teil(GEO.box, [0x4e3a26, 0x32241a], 0, 1.1, 2.42, 0, 0, 0, 1.1, 2.0, 0.2),
      teil(GEO.box, [0x6a8ab0, 0x46608a], -1.6, 2.6, 2.36, 0, 0, 0, 0.8, 0.9, 0.1),
      teil(GEO.box, [0x6a8ab0, 0x46608a], 1.6, 2.6, 2.36, 0, 0, 0, 0.8, 0.9, 0.1),
      teil(GEO.box, [0x8a8a82, 0x5e5e56], 1.5, 5.6, -1.0, 0, 0, 0, 0.7, 1.6, 0.7),  // Kamin
    ];
    return { r: 3.6, kamin: { x: 1.5, y: 6.5, z: -1.0 }, teile: t };
  }
  if (era === 'renaissance') {
    const t = [
      teil(GEO.box, [0xeae2d0, 0xc4baa4], 0, 2.2, 0, 0, 0, 0, 5.6, 4.4, 4.8),
      teil(GEO.box, [0xd2c8b4, 0xa89e8a], 0, 4.7, 0, 0, 0, 0, 6.0, 0.5, 5.2),
      teil(GEO.kegel, [0x8a5a44, 0x5e3a2c], 0, 6.0, 0, 0, Math.PI / 4, 0, 5.2, 2.4, 5.2),
      teil(GEO.box, [0x6a92b8, 0x44688e], 1.4, 2.6, 2.45, 0, 0, 0, 1.0, 1.4, 0.1),
      teil(GEO.box, [0x6a92b8, 0x44688e], -1.4, 2.6, 2.45, 0, 0, 0, 1.0, 1.4, 0.1),
      teil(GEO.box, [0xfaf2e0, 0xd8ccb0], 1.4, 1.85, 2.5, 0, 0, 0, 1.3, 0.12, 0.2),
      teil(GEO.box, [0xfaf2e0, 0xd8ccb0], -1.4, 1.85, 2.5, 0, 0, 0, 1.3, 0.12, 0.2),
      teil(GEO.box, [0x4e3a26, 0x32241a], 0, 1.2, 2.45, 0, 0, 0, 1.2, 2.2, 0.2),
      teil(GEO.box, [0x9a9a92, 0x6e6e66], -1.6, 5.6, -1.2, 0, 0, 0, 0.7, 1.6, 0.7), // Kamin
    ];
    return { r: 3.8, kamin: { x: -1.6, y: 6.5, z: -1.2 }, teile: t };
  }
  // moderne
  const hoehe = 7 + Math.floor(rng() * 3) * 3;
  const farben = [[0xaec4d6, 0x7e94aa], [0xc0d0de, 0x90a4b6], [0x9ab4c8, 0x6e88a0]];
  const f = farben[Math.floor(rng() * 3)];
  return { r: 4.0, hoch: true, hoehe, teile: [
    teil(GEO.box, f, 0, hoehe / 2, 0, 0, 0, 0, 5.4, hoehe, 5.0),
    teil(GEO.box, [0x8aa0b4, 0x607890], 0, hoehe + 0.25, 0, 0, 0, 0, 5.6, 0.5, 5.2),
    teil(GEO.box, [0x46586a, 0x32414f], 0, 1.1, 2.55, 0, 0, 0, 2.2, 2.2, 0.1),
  ] };
}

// — Stadt-Deko-Baukasten
function fass(x, y, z) {
  return [
    teil(GEO.zylinderGrob, [0x9a6e44, 0x66462a], x, y + 0.45, z, 0, 0, 0, 0.65, 0.9, 0.65),
    teil(GEO.zylinderGrob, [0x6e4e30, 0x4a341e], x, y + 0.62, z, 0, 0, 0, 0.68, 0.08, 0.68),
    teil(GEO.zylinderGrob, [0x6e4e30, 0x4a341e], x, y + 0.25, z, 0, 0, 0, 0.68, 0.08, 0.68),
  ];
}
function kiste(x, y, z, w) {
  return [
    teil(GEO.box, [0xb08a58, 0x7a5e3a], x, y + 0.4, z, 0, w, 0, 0.85, 0.8, 0.85),
    teil(GEO.box, [0x8a6a42, 0x5e4628], x, y + 0.81, z, 0, w, 0, 0.9, 0.06, 0.9),
  ];
}
function marktstand(x, y, z, w, farbe) {
  const t = [];
  for (const [ox, oz] of [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]])
    t.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x5e4628], x + ox, y + 1.0, z + oz, 0, 0, 0, 0.12, 2.0, 0.12));
  t.push(teil(GEO.box, [0xc8a878, 0x9a7e54], x, y + 0.85, z, 0, 0, 0, 2.4, 0.14, 1.5));
  // gestreiftes Dach
  for (let s = 0; s < 5; s++)
    t.push(teil(GEO.box, s % 2 ? [0xfaf5ea, 0xe0d8c8] : [farbe, farbe], x - 1.2 + 0.6 * s + 0.3, y + 2.15, z, 0, 0, 0.1, 0.6, 0.08, 2.2));
  t.push(teil(GEO.kugelGrob, [0xe8b84a, 0xc89a32], x - 0.5, y + 1.05, z + 0.2, 0, 0, 0, 0.3));
  t.push(teil(GEO.kugelGrob, [0xd86a3a, 0xb04e26], x + 0.4, y + 1.05, z - 0.1, 0, 0, 0, 0.28));
  return t;
}
function banner(x, y, z, farbe, w = 0) {
  return [
    teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], x, y + 1.9, z, 0, 0, 0, 0.16, 3.8, 0.16),
    teil(GEO.kugelGrob, [0xffd24a, 0xc8962a], x, y + 3.85, z, 0, 0, 0, 0.18),
    teil(GEO.box, [farbe, farbe], x, y + 3.05, z, 0, w, 0, 0.12, 1.4, 0.9),
  ];
}
function zaun(x1, z1, x2, z2, y) {
  const t = [];
  const laenge = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(2, Math.round(laenge / 1.4));
  for (let i = 0; i <= n; i++) {
    const tt = i / n;
    t.push(teil(GEO.zylinderGrob, [0x9a7a4e, 0x66492a], lerp(x1, x2, tt), y + 0.5, lerp(z1, z2, tt), 0, 0, 0, 0.1, 1.0, 0.1));
  }
  const w = Math.atan2(x2 - x1, z2 - z1);
  t.push(teil(GEO.box, [0xab8a5c, 0x755636], (x1 + x2) / 2, y + 0.75, (z1 + z2) / 2, 0, w, 0, 0.08, 0.12, laenge));
  return t;
}
function feuerstelle(x, y, z, gross, teileListe, leuchtTeile) {
  for (let i = 0; i < 7; i++) {
    const w = (i / 7) * Math.PI * 2;
    teileListe.push(teil(GEO.kugelGrob, [0x9a9a8e, 0x62625a], x + Math.cos(w) * 1.1 * gross, y + 0.2, z + Math.sin(w) * 1.1 * gross, 0, w, 0, 0.5 * gross, 0.4 * gross, 0.45 * gross));
  }
  teileListe.push(teil(GEO.zylinderGrob, [0x6e4e30, 0x3a2818], x - 0.3 * gross, y + 0.25, z, 0.4, 0.4, 1.2, 0.16 * gross, 1.4 * gross, 0.16 * gross));
  teileListe.push(teil(GEO.zylinderGrob, [0x6e4e30, 0x3a2818], x + 0.3 * gross, y + 0.25, z, -0.5, 1.2, 1.2, 0.16 * gross, 1.4 * gross, 0.16 * gross));
  // Flamme als eigenes (animierbares) Mesh
  const flamme = new THREE.Mesh(
    verschmelze([
      teil(GEO.kegelGrob, 0xffa83a, 0, 0.55 * gross, 0, 0, 0, 0, 0.8 * gross, 1.3 * gross, 0.8 * gross),
      teil(GEO.kegelGrob, 0xffe070, 0, 0.45 * gross, 0, 0, 0, 0, 0.45 * gross, 0.9 * gross, 0.45 * gross),
    ]),
    new THREE.MeshBasicMaterial({ vertexColors: true })
  );
  flamme.position.set(x, y + 0.15, z);
  S.szene.add(flamme);
  animierteFlammen.push({ mesh: flamme, takt: Math.random() * 9 });
  feuerQuellen.push({ x, y: y + 0.8 * gross, z, groesse: gross });
}
function laterne(x, y, z, era, teileListe, leuchtTeile) {
  if (era === 'steinzeit' || era === 'bronzezeit' || era === 'antike') {
    // Fackel
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], x, y + 0.9, z, 0, 0, 0, 0.09, 1.8, 0.09));
    leuchtTeile.push(teil(GEO.kugelGrob, 0xffb84a, x, y + 1.95, z, 0, 0, 0, 0.3, 0.42, 0.3));
  } else if (era === 'moderne') {
    teileListe.push(teil(GEO.zylinderGrob, [0x6a7682, 0x46525e], x, y + 2, z, 0, 0, 0, 0.13, 4, 0.13));
    teileListe.push(teil(GEO.box, [0x6a7682, 0x46525e], x + 0.35, y + 3.95, z, 0, 0, -0.4, 0.9, 0.1, 0.1));
    leuchtTeile.push(teil(GEO.kugelGrob, 0xfff2b0, x + 0.7, y + 3.8, z, 0, 0, 0, 0.32, 0.2, 0.32));
  } else {
    // Mittelalter/Renaissance: Laternenpfahl
    teileListe.push(teil(GEO.zylinderGrob, [0x4e4640, 0x322c26], x, y + 1.3, z, 0, 0, 0, 0.1, 2.6, 0.1));
    teileListe.push(teil(GEO.box, [0x4e4640, 0x322c26], x, y + 2.75, z, 0, 0.78, 0, 0.5, 0.55, 0.5));
    leuchtTeile.push(teil(GEO.kugelGrob, 0xffd87a, x, y + 2.72, z, 0, 0, 0, 0.26));
  }
}

function bauStadt(szene, zi) {
  const zone = ZONEN[zi];
  const m = zonenMitte(zi);
  const h = stadtHoehen[zi];
  const rng = rngFabrik(40 + zi);
  const teileListe = [];
  const leuchtTeile = [];
  const era = zone.era;
  const BANNER_FARBEN = { steinzeit: 0xc88a4a, bronzezeit: 0x3a8a9a, antike: 0xc03a2a, mittelalter: 0x8a2a3a, renaissance: 0x2a5a8a, moderne: 0x4adfff };

  // Gebäude im Ring
  const anzahl = 8;
  for (let i = 0; i < anzahl; i++) {
    const wink = (i / anzahl) * Math.PI * 2 + 0.35;
    const r = 34 + rng() * 12;
    const gx = m.x + Math.cos(wink) * r, gz = m.z + Math.sin(wink) * r;
    const gh = hoeheAn(gx, gz);
    const g = gebaeude(era, rng);
    const dreh = -wink + Math.PI / 2;
    for (const t of g.teile) { t.rotateY(dreh); t.translate(gx, gh - 0.1, gz); teileListe.push(t); }
    kollisionsKreise.push({ x: gx, z: gz, r: g.r });
    if (g.kamin) {
      const kx = g.kamin.x * Math.cos(dreh) + g.kamin.z * Math.sin(dreh);
      const kz = -g.kamin.x * Math.sin(dreh) + g.kamin.z * Math.cos(dreh);
      rauchQuellen.push({ x: gx + kx, y: gh + g.kamin.y, z: gz + kz });
    }
    if (g.hoch) {
      for (let f = 2; f < g.hoehe - 1.2; f += 1.6) {
        leuchtTeile.push(teil(GEO.box, f % 3.2 < 1.6 ? 0xfff2a8 : 0xbfe8ff, gx + 2.78 * Math.cos(wink), gh + f, gz + 2.78 * Math.sin(wink), 0, dreh, 0, 3.6, 0.7, 0.1));
      }
    }
  }

  // Deko rund um den Platz: Stände, Fässer, Kisten, Banner, Zaun, Laternen
  const standWinkel = 0.9;
  const sx = m.x + Math.cos(standWinkel) * 20, sz = m.z + Math.sin(standWinkel) * 20;
  teileListe.push(...marktstand(sx, hoeheAn(sx, sz), sz, 0, BANNER_FARBEN[era]));
  kollisionsKreise.push({ x: sx, z: sz, r: 1.8 });
  const fx = m.x + Math.cos(2.3) * 17, fz = m.z + Math.sin(2.3) * 17;
  teileListe.push(...fass(fx, hoeheAn(fx, fz), fz));
  teileListe.push(...fass(fx + 0.9, hoeheAn(fx, fz), fz + 0.4));
  teileListe.push(...kiste(fx + 0.4, hoeheAn(fx, fz), fz - 0.9, 0.4));
  for (const bw of [0.2, 1.8, 3.4, 5.0]) {
    const bx = m.x + Math.cos(bw) * 27, bz = m.z + Math.sin(bw) * 27;
    teileListe.push(...banner(bx, hoeheAn(bx, bz), bz, BANNER_FARBEN[era], bw));
  }
  const zx = m.x + Math.cos(4.1) * 22, zz = m.z + Math.sin(4.1) * 22;
  teileListe.push(...zaun(zx - 4, zz, zx + 4, zz + 2, hoeheAn(zx, zz)));
  for (const lw of [0.6, 2.2, 3.8, 5.4]) {
    const lx = m.x + Math.cos(lw) * 13, lz = m.z + Math.sin(lw) * 13;
    laterne(lx, hoeheAn(lx, lz), lz, era, teileListe, leuchtTeile);
  }

  // Herzstück je Zeitalter
  if (era === 'steinzeit') {
    teileListe.push(teil(GEO.zylinderGrob, [0xa8845a, 0x6e5234], m.x, h + 1.6, m.z - 16, 0, 0, 0, 1.0, 3.2, 1.0));
    teileListe.push(teil(GEO.box, [0xc8a070, 0x8a6a42], m.x, h + 3.6, m.z - 16, 0, 0.5, 0, 1.6, 1.6, 1.6));
    teileListe.push(teil(GEO.box, [0xc8a070, 0x8a6a42], m.x, h + 4.6, m.z - 16, 0, 0.5, 0, 2.2, 0.5, 0.6));
    feuerstelle(m.x, h, m.z, 1.4, teileListe, leuchtTeile);
    // Trockengestell
    const tx = m.x - 14, tz = m.z + 8, th = hoeheAn(tx, tz);
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], tx - 1, th + 0.9, tz, 0, 0, 0, 0.1, 1.8, 0.1));
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], tx + 1, th + 0.9, tz, 0, 0, 0, 0.1, 1.8, 0.1));
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], tx, th + 1.7, tz, 0, 0, Math.PI / 2, 0.07, 2.2, 0.07));
    teileListe.push(teil(GEO.box, [0xc09a6a, 0x8a6a42], tx - 0.3, th + 1.35, tz, 0, 0, 0, 0.5, 0.7, 0.06));
    teileListe.push(teil(GEO.box, [0xb08a5a, 0x7a5e3a], tx + 0.4, th + 1.4, tz, 0, 0, 0, 0.5, 0.6, 0.06));
  } else if (era === 'bronzezeit') {
    teileListe.push(teil(GEO.box, [0xd8c8a8, 0xa89878], m.x, h + 0.6, m.z, 0, 0, 0, 2.6, 1.2, 2.6));
    teileListe.push(teil(GEO.kapsel, [0xe8a83a, 0xb87a1a], m.x, h + 2.6, m.z, 0, 0, 0, 1.0, 1.6, 1.0));
    teileListe.push(teil(GEO.kugel, [0xffd24a, 0xc8962a], m.x, h + 3.9, m.z, 0, 0, 0, 0.7));
    // Amphoren
    for (const [ax, az] of [[8, -12], [9, -11], [8.5, -13]]) {
      const ah = hoeheAn(m.x + ax, m.z + az);
      teileListe.push(teil(GEO.kugelGrob, [0xc88a52, 0x96622e], m.x + ax, ah + 0.55, m.z + az, 0, 0, 0, 0.7, 1.1, 0.7));
      teileListe.push(teil(GEO.zylinderGrob, [0xb87a42, 0x86521e], m.x + ax, ah + 1.2, m.z + az, 0, 0, 0, 0.25, 0.3, 0.25));
    }
  } else if (era === 'antike') {
    for (let i = 0; i < 5; i++) {
      const w = i / 5 * Math.PI * 2;
      teileListe.push(teil(GEO.zylinderGrob, [0xfffaf0, 0xd8ccb0], m.x + Math.cos(w) * 4, h + 2.2, m.z + Math.sin(w) * 4, 0, 0, 0, 0.5, 4.4, 0.5));
      teileListe.push(teil(GEO.box, [0xfffaf0, 0xe0d4b8], m.x + Math.cos(w) * 4, h + 4.5, m.z + Math.sin(w) * 4, 0, w, 0, 0.8, 0.25, 0.8));
    }
    teileListe.push(teil(GEO.zylinder, [0xfaf2e0, 0xe0d4b8], m.x, h + 4.75, m.z, 0, 0, 0, 5.4, 0.5, 5.4));
    // Statue
    const stx = m.x - 18, stz = m.z + 4, sth = hoeheAn(stx, stz);
    teileListe.push(teil(GEO.box, [0xe8e0d0, 0xb8b0a0], stx, sth + 0.6, stz, 0, 0.4, 0, 1.6, 1.2, 1.6));
    teileListe.push(teil(GEO.kapsel, [0xf8f2e8, 0xc8c0b0], stx, sth + 2.2, stz, 0, 0.4, 0, 0.8, 0.9, 0.6));
    teileListe.push(teil(GEO.kugelGrob, [0xf8f2e8, 0xd8d0c0], stx, sth + 3.2, stz, 0, 0, 0, 0.55));
    teileListe.push(teil(GEO.box, [0xf8f2e8, 0xc8c0b0], stx + 0.6, sth + 2.6, stz, 0, 0, -1.0, 0.2, 0.9, 0.2));
  } else if (era === 'mittelalter') {
    teileListe.push(teil(GEO.zylinder, [0xb0b0a8, 0x787870], m.x, h + 5, m.z - 18, 0, 0, 0, 3.4, 10, 3.4));
    teileListe.push(teil(GEO.kegel, [0xa84a36, 0x6e2e22], m.x, h + 11.4, m.z - 18, 0, 0, 0, 4.2, 3.2, 4.2));
    teileListe.push(teil(GEO.box, [0xd83a2a, 0x982618], m.x + 1.4, h + 13.0, m.z - 18, 0, 0, 0, 2.4, 1.2, 0.1));
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], m.x, h + 13.2, m.z - 18, 0, 0, 0, 0.08, 2.6, 0.08));
    // Brunnen
    teileListe.push(teil(GEO.zylinder, [0xb0b0a8, 0x787870], m.x, h + 0.5, m.z, 0, 0, 0, 4.4, 1.0, 4.4));
    teileListe.push(teil(GEO.zylinder, [0x4a9ad8, 0x2a6aa8], m.x, h + 0.85, m.z, 0, 0, 0, 3.8, 0.3, 3.8));
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], m.x - 1.6, h + 1.6, m.z, 0, 0, 0, 0.12, 2.4, 0.12));
    teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], m.x + 1.6, h + 1.6, m.z, 0, 0, 0, 0.12, 2.4, 0.12));
    teileListe.push(teil(GEO.kegel, [0x8a5a44, 0x5e3a2c], m.x, h + 3.1, m.z, 0, 0, 0, 4.6, 1.0, 2.0));
    kollisionsKreise.push({ x: m.x, z: m.z - 18, r: 4 });
  } else if (era === 'renaissance') {
    teileListe.push(teil(GEO.box, [0xe8e2d2, 0xb8b2a2], m.x, h + 6, m.z - 18, 0, 0, 0, 3.4, 12, 3.4));
    teileListe.push(teil(GEO.kegel, [0x4a7aa8, 0x2e5478], m.x, h + 13.4, m.z - 18, 0, Math.PI / 4, 0, 3.8, 3.0, 3.8));
    leuchtTeile.push(teil(GEO.zylinder, 0xfff8e0, m.x, h + 10.5, m.z - 16.2, Math.PI / 2, 0, 0, 1.2, 0.2, 1.2));
    teileListe.push(teil(GEO.box, [0x4e4640, 0x322c26], m.x, h + 10.5, m.z - 16.1, 0, 0, 0, 1.4, 1.4, 0.08));
    // Springbrunnen
    teileListe.push(teil(GEO.zylinder, [0xd8d2c2, 0xa8a292], m.x, h + 0.5, m.z, 0, 0, 0, 4.4, 1.0, 4.4));
    teileListe.push(teil(GEO.zylinder, [0x5ab8e8, 0x3a88c8], m.x, h + 0.85, m.z, 0, 0, 0, 3.8, 0.3, 3.8));
    teileListe.push(teil(GEO.zylinderGrob, [0xd8d2c2, 0xa8a292], m.x, h + 1.5, m.z, 0, 0, 0, 0.5, 1.6, 0.5));
    teileListe.push(teil(GEO.zylinder, [0x8adcf8, 0x4aa8e0], m.x, h + 2.3, m.z, 0, 0, 0, 1.6, 0.2, 1.6));
    // Blumenbeete
    for (const [bx, bz] of [[10, 14], [-12, 12]]) {
      const bh = hoeheAn(m.x + bx, m.z + bz);
      teileListe.push(teil(GEO.box, [0x9a7a52, 0x6a522f], m.x + bx, bh + 0.25, m.z + bz, 0, 0.3, 0, 2.6, 0.5, 1.4));
      for (let f = 0; f < 5; f++)
        teileListe.push(teil(GEO.kugelGrob, [[0xe85a8a, 0xc83a6a], [0xf0c84a, 0xd0a82a], [0x6a8af5, 0x4a6ad5]][f % 3], m.x + bx - 1 + f * 0.5, bh + 0.62, m.z + bz + (f % 2 ? 0.3 : -0.2), 0, 0, 0, 0.3, 0.24, 0.3));
    }
    kollisionsKreise.push({ x: m.x, z: m.z - 18, r: 3.4 });
  } else { // moderne
    teileListe.push(teil(GEO.zylinderGrob, [0x9aaabc, 0x6a7a8c], m.x, h + 8, m.z - 18, 0, 0, 0, 0.5, 16, 0.5));
    const antenne = new THREE.Mesh(GEO.kugelGrob.clone(), new THREE.MeshBasicMaterial({ color: 0xff4a4a }));
    antenne.position.set(m.x, h + 16.5, m.z - 18);
    antenne.scale.setScalar(0.9);
    szene.add(antenne);
    leuchtPulse.push({ mesh: antenne, takt: 0 });
    // ✦-PICZEL-Denkmal
    leuchtTeile.push(teil(GEO.kugel, 0x4adfff, m.x, h + 4.2, m.z, 0, 0, 0, 1.0, 2.6, 1.0));
    leuchtTeile.push(teil(GEO.kugel, 0x4adfff, m.x, h + 4.2, m.z, 0, 0, 0, 2.6, 1.0, 0.6));
    teileListe.push(teil(GEO.box, [0xc2ccd6, 0x8a99a8], m.x, h + 1.2, m.z, 0, 0, 0, 2.0, 2.4, 2.0));
    teileListe.push(teil(GEO.box, [0x46586a, 0x32414f], m.x, h + 2.45, m.z, 0, 0, 0, 2.2, 0.1, 2.2));
    // Parkbänke + Schwebe-Gleiter
    for (const [bx, bz, bw] of [[9, 9, 0.7], [-9, 10, -0.6]]) {
      const bh = hoeheAn(m.x + bx, m.z + bz);
      teileListe.push(teil(GEO.box, [0xb08a58, 0x7a5e3a], m.x + bx, bh + 0.45, m.z + bz, 0, bw, 0, 1.8, 0.1, 0.5));
      teileListe.push(teil(GEO.box, [0xb08a58, 0x7a5e3a], m.x + bx, bh + 0.85, m.z + bz - 0.2, -0.25, bw, 0, 1.8, 0.5, 0.08));
      teileListe.push(teil(GEO.box, [0x6a7682, 0x46525e], m.x + bx - 0.7, bh + 0.22, m.z + bz, 0, bw, 0, 0.1, 0.45, 0.4));
      teileListe.push(teil(GEO.box, [0x6a7682, 0x46525e], m.x + bx + 0.7, bh + 0.22, m.z + bz, 0, bw, 0, 0.1, 0.45, 0.4));
    }
    const gx = m.x + 16, gz = m.z + 12, gh = hoeheAn(gx, gz);
    teileListe.push(teil(GEO.kugel, [0xe84a5a, 0xb02a3a], gx, gh + 0.9, gz, 0, 0.5, 0, 2.6, 0.9, 1.4));
    teileListe.push(teil(GEO.kugel, [0xbfe8ff, 0x8ac8e8], gx + 0.3, gh + 1.35, gz, 0, 0.5, 0, 1.2, 0.7, 1.0));
    kollisionsKreise.push({ x: gx, z: gz, r: 1.8 });
  }

  const geo = verschmelze(teileListe);
  szene.add(new THREE.Mesh(geo, toonVertex()));
  szene.add(umriss(geo, 0.035));
  if (leuchtTeile.length) {
    const lg = verschmelze(leuchtTeile);
    szene.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  kollisionsKreise.push({ x: m.x, z: m.z, r: era === 'mittelalter' || era === 'renaissance' ? 4.6 : 1.8 });
}

// ---------------------------------------------------------------- Orte & Boss-Plätze
function bauOrte(szene) {
  const teileListe = [];
  const leuchtTeile = [];
  const BOSS_PLAETZE = new Set(['urgroll_platz', 'salzzahn_platz', 'ferrox_platz', 'grielda_platz', 'granit_platz', 'koenig_platz']);
  for (const o of ORTE) {
    const h = ortHoehen[o.id];
    for (let i = 0; i < 7; i++) {
      const w = i / 7 * Math.PI * 2;
      teileListe.push(teil(GEO.kugelGrob, [0xa8a89c, 0x6e6e64], o.x + Math.cos(w) * 14, hoeheAn(o.x + Math.cos(w) * 14, o.z + Math.sin(w) * 14) + 0.3, o.z + Math.sin(w) * 14, 0, w, 0, 1.4, 1.0, 1.1));
    }
    if (BOSS_PLAETZE.has(o.id)) {
      // Leucht-Runenring + Banner
      leuchtTeile.push(teil(GEO.ring, 0xff6a4a, o.x, h + 0.25, o.z, Math.PI / 2, 0, 0, 16, 16, 4));
      for (const w of [0.5, 2.1, 3.7, 5.3]) {
        teileListe.push(...banner(o.x + Math.cos(w) * 11, hoeheAn(o.x + Math.cos(w) * 11, o.z + Math.sin(w) * 11), o.z + Math.sin(w) * 11, 0x3a2e3e, w));
      }
    }
    if (o.id === 'himmelsstein') {
      himmelsstein = new THREE.Mesh(
        verschmelze([
          teil(GEO.kugelGrob, [0xbae8ff, 0x4a9ad8], 0, 0, 0, 0.4, 0.3, 0, 2.2, 2.8, 2.2),
          teil(GEO.kegelGrob, [0xffffff, 0x6ab8e8], 0, 1.8, 0, 0, 0, 0, 0.8, 1.4, 0.8),
          teil(GEO.kegelGrob, [0xffffff, 0x6ab8e8], 0, -1.8, 0, Math.PI, 0, 0, 0.8, 1.4, 0.8),
        ]),
        toonVertex()
      );
      himmelsstein.position.set(o.x, h + 2.6, o.z);
      szene.add(himmelsstein);
      leuchtTeile.push(teil(GEO.ring, 0x8ae8ff, o.x, h + 0.3, o.z, Math.PI / 2, 0, 0, 7, 7, 2.5));
    } else if (o.id === 'steinkreis') {
      for (let i = 0; i < 5; i++) {
        const w = i / 5 * Math.PI * 2;
        teileListe.push(teil(GEO.box, [0x9a9a90, 0x62625a], o.x + Math.cos(w) * 6, h + 1.6, o.z + Math.sin(w) * 6, 0, w, 0.08, 1.2, 3.2, 0.8));
        teileListe.push(teil(GEO.box, [0xa8a89e, 0x6e6e64], o.x + Math.cos(w) * 6, h + 3.3, o.z + Math.sin(w) * 6, 0, w, 0, 1.5, 0.5, 0.9));
      }
    } else if (o.id === 'leuchtfeuer') {
      teileListe.push(teil(GEO.zylinder, [0xe8e0d0, 0xb0a890], o.x, h + 4, o.z, 0, 0, 0, 2.2, 8, 1.6));
      teileListe.push(teil(GEO.box, [0xc03a2a, 0x8a2618], o.x, h + 2, o.z, 0, 0, 0, 2.4, 1.4, 1.8));
      teileListe.push(teil(GEO.box, [0xc03a2a, 0x8a2618], o.x, h + 5.5, o.z, 0, 0, 0, 2.4, 1.4, 1.8));
      leuchtTeile.push(teil(GEO.kugel, 0xffd24a, o.x, h + 8.6, o.z, 0, 0, 0, 1.2));
      teileListe.push(teil(GEO.kegel, [0x8a5a44, 0x5e3a2c], o.x, h + 9.8, o.z, 0, 0, 0, 2.6, 1.4, 2.6));
    } else if (o.id === 'sonnentor') {
      teileListe.push(teil(GEO.box, [0xfaf2e0, 0xd0c4a8], o.x - 3, h + 3, o.z, 0, 0, 0, 1.4, 6, 1.4));
      teileListe.push(teil(GEO.box, [0xfaf2e0, 0xd0c4a8], o.x + 3, h + 3, o.z, 0, 0, 0, 1.4, 6, 1.4));
      leuchtTeile.push(teil(GEO.box, 0xffd24a, o.x, h + 6.4, o.z, 0, 0, 0, 8, 1.2, 1.6));
    } else if (o.id === 'versunkener_turm') {
      teileListe.push(teil(GEO.zylinder, [0x8a9a8a, 0x5e6e5e], o.x, h + 2, o.z, 0.18, 0, 0.1, 2.6, 5, 2.6));
      teileListe.push(teil(GEO.kugelGrob, [0x57713f, 0x35492a], o.x + 1, h + 3.4, o.z + 0.5, 0, 0, 0, 1.6, 0.8, 1.2));
    } else if (o.id === 'silbermine') {
      teileListe.push(teil(GEO.box, [0x8a6a42, 0x5e4628], o.x - 2, h + 1.5, o.z, 0, 0, 0, 0.8, 3.2, 0.8));
      teileListe.push(teil(GEO.box, [0x8a6a42, 0x5e4628], o.x + 2, h + 1.5, o.z, 0, 0, 0, 0.8, 3.2, 0.8));
      teileListe.push(teil(GEO.box, [0x8a6a42, 0x5e4628], o.x, h + 3.2, o.z, 0, 0, 0, 4.8, 0.8, 0.8));
      teileListe.push(teil(GEO.box, [0x2a2622, 0x14120e], o.x, h + 1.4, o.z - 0.5, 0, 0, 0, 3.2, 2.8, 0.3));
      teileListe.push(...kiste(o.x + 3.5, h, o.z + 1, 0.3));
      teileListe.push(...fass(o.x - 3.6, h, o.z + 1.2));
    } else if (o.id === 'sternwarte') {
      teileListe.push(teil(GEO.zylinder, [0xe8eef4, 0xb0bcc8], o.x, h + 2, o.z, 0, 0, 0, 3.0, 4, 3.0));
      teileListe.push(teil(GEO.kugel, [0xc8d4e0, 0x90a0b0], o.x, h + 4.4, o.z, 0, 0, 0, 3.2, 2.4, 3.2));
      teileListe.push(teil(GEO.zylinderGrob, [0x6a7682, 0x46525e], o.x + 1, h + 5.6, o.z, 0, 0, -0.6, 0.5, 2.6, 0.5));
      leuchtTeile.push(teil(GEO.kugelGrob, 0xbfe8ff, o.x + 1.6, h + 6.6, o.z, 0, 0, 0, 0.4));
    } else if (o.id === 'eisthron' || o.id === 'koenig_platz') {
      teileListe.push(teil(GEO.box, [0xc0ecf8, 0x6ab0d0], o.x, h + 1.4, o.z - 6, 0, 0, 0, 4, 2.8, 1.6));
      teileListe.push(teil(GEO.box, [0xd0f2fa, 0x7ac0e0], o.x, h + 3.6, o.z - 6.6, 0, 0, 0, 4, 4.4, 0.6));
      for (const s of [-3, 3]) teileListe.push(teil(GEO.kegelGrob, [0xe0f6fc, 0x8ad0e8], o.x + s, h + 3.2, o.z - 6, 0, 0, 0, 1.0, 4.4, 1.0));
      for (const s of [-7, 7]) teileListe.push(teil(GEO.kegelGrob, [0xd0f0fa, 0x7ac0e0], o.x + s, h + 2.6, o.z - 2, 0, 0, s > 0 ? -0.15 : 0.15, 1.4, 5.2, 1.4));
    } else if (o.id === 'wrack') {
      teileListe.push(teil(GEO.box, [0x8a6240, 0x553a22], o.x, h + 1.2, o.z, 0.3, 0.6, 0.25, 7, 2.2, 2.6));
      teileListe.push(teil(GEO.zylinderGrob, [0x755230, 0x4a341e], o.x, h + 3.6, o.z, 0, 0, 0.5, 0.25, 5, 0.25));
      teileListe.push(teil(GEO.box, [0xe8e0d0, 0xb8b0a0], o.x + 0.8, h + 3.8, o.z + 0.2, 0, 0, 0.5, 2.2, 1.6, 0.1));
      teileListe.push(...kiste(o.x + 4, h, o.z + 2, 0.8));
    } else if (o.id === 'arena_ruine') {
      for (let i = 0; i < 8; i++) {
        const w = i / 8 * Math.PI * 2;
        if (i % 3 === 0) continue;
        teileListe.push(teil(GEO.box, [0xe8dcc0, 0xb0a484], o.x + Math.cos(w) * 9, h + 1.4, o.z + Math.sin(w) * 9, 0, w, 0, 2.6, 2.8, 1.0));
        teileListe.push(teil(GEO.zylinderGrob, [0xf0e6cc, 0xc0b494], o.x + Math.cos(w) * 9, h + 3.2, o.z + Math.sin(w) * 9, 0, 0, 0, 0.4, 1.0, 0.4));
      }
    } else if (o.id === 'aussichtsfels') {
      teileListe.push(teil(GEO.kugelGrob, [0x9a9a90, 0x62625a], o.x, h + 2, o.z, 0, 0, 0, 4.4, 3.2, 3.6));
      teileListe.push(teil(GEO.zylinderGrob, [0x8a6a42, 0x55401f], o.x + 1, h + 4.4, o.z, 0, 0, 0, 0.08, 2.0, 0.08));
      teileListe.push(teil(GEO.box, 0xe8362a, o.x + 1.45, h + 5.1, o.z, 0, 0, 0, 0.9, 0.5, 0.06));
    } else if (o.id === 'hexenhuette') {
      teileListe.push(teil(GEO.box, [0x5e4a34, 0x3a2e1e], o.x, h + 1.4, o.z + 8, 0, 0.4, 0, 3.6, 2.8, 3.2));
      teileListe.push(teil(GEO.kegel, [0x46362a, 0x2c2218], o.x, h + 3.9, o.z + 8, 0, 0.4, 0, 3.4, 2.4, 3.4));
      leuchtTeile.push(teil(GEO.box, 0x9af59a, o.x + 1.2, h + 1.6, o.z + 6.6, 0, 0.4, 0, 0.7, 0.7, 0.1));
      rauchQuellen.push({ x: o.x - 0.8, y: h + 5.4, z: o.z + 8.4 });
    }
  }
  const geo = verschmelze(teileListe);
  szene.add(new THREE.Mesh(geo, toonVertex()));
  szene.add(umriss(geo, 0.035));
  if (leuchtTeile.length) {
    const lg = verschmelze(leuchtTeile);
    szene.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })));
  }
}

// ---------------------------------------------------------------- Laufende Updates
export function updateWelt(dt) {
  if (wasserMesh) {
    wasserMesh.material.uniforms.zeit.value = S.zeit;
  }
  if (S.himmel && S.rig) {
    S.himmel.position.copy(S.rig.position);
    if (wolkenHalter) wolkenHalter.rotation.y += dt * 0.004;
  }
  for (const f of animierteFlammen) {
    f.takt += dt * 9;
    f.mesh.scale.set(1 + Math.sin(f.takt) * 0.12, 1 + Math.sin(f.takt * 1.3 + 1) * 0.2, 1 + Math.cos(f.takt) * 0.12);
  }
  for (const l of leuchtPulse) {
    l.takt += dt;
    l.mesh.visible = Math.sin(l.takt * 2.5) > -0.3;
  }
  if (himmelsstein) {
    himmelsstein.rotation.y += dt * 0.4;
    himmelsstein.position.y += Math.sin(S.zeit * 0.9) * dt * 0.3;
  }
  if (S.szene.fog && S.rig) {
    const zi = zoneIndexAn(S.rig.position.x, S.rig.position.z);
    S.zoneIndex = zi;
    const ziel = new THREE.Color(ZONEN[zi].nebel);
    S.szene.fog.color.lerp(ziel, Math.min(1, dt * 0.5));
  }
}

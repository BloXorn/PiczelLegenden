// Stimmungs-Partikel: Schnee, Pollen/Glühstaub, fallende Blätter, Kaminrauch, Feuerfunken
import * as THREE from 'three';
import { S } from './zustand.js';
import { punktTextur } from './bau.js';
import { rauchQuellen, feuerQuellen } from './welt.js';

const systeme = [];

function punkteSystem(anzahl, farbe, groesse, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(anzahl * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: farbe, size: groesse, map: punktTextur(),
    transparent: true, opacity, depthWrite: false, sizeAttenuation: true,
  });
  const punkte = new THREE.Points(geo, mat);
  punkte.frustumCulled = false;
  S.szene.add(punkte);
  return { punkte, pos, daten: new Float32Array(anzahl * 4), anzahl };
}

let schnee = null, staub = null, blaetter = null, rauch = null, funken = null;

export function initEffekte() {
  // Schnee (Frostgipfel): fällt in einer 60-m-Blase um den Spieler
  schnee = punkteSystem(420, 0xffffff, 0.32);
  for (let i = 0; i < schnee.anzahl; i++) neuerSchnee(i, true);

  // Goldener Glühstaub / Pollen (Wald, Steppe, Moor)
  staub = punkteSystem(140, 0xffe8a0, 0.16, 0.75);
  for (let i = 0; i < staub.anzahl; i++) neuerStaub(i, true);

  // Fallende Blätter (Wald)
  blaetter = punkteSystem(90, 0x7ac255, 0.26, 0.95);
  for (let i = 0; i < blaetter.anzahl; i++) neuesBlatt(i, true);

  // Kaminrauch
  rauch = punkteSystem(160, 0xdcdcdc, 1.0, 0.4);
  for (let i = 0; i < rauch.anzahl; i++) neuerRauch(i, Math.random() * 6);

  // Feuerfunken
  funken = punkteSystem(90, 0xffb84a, 0.22, 0.95);
  for (let i = 0; i < funken.anzahl; i++) neuerFunke(i, Math.random() * 1.4);
}

function spielerPos() { return S.rig.position; }

function neuerSchnee(i, sofort = false) {
  const p = spielerPos();
  schnee.pos[i * 3] = p.x + (Math.random() - 0.5) * 60;
  schnee.pos[i * 3 + 1] = p.y + (sofort ? Math.random() * 24 : 18 + Math.random() * 8);
  schnee.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 60;
  schnee.daten[i * 4] = 1.6 + Math.random() * 1.6;       // Fallgeschwindigkeit
  schnee.daten[i * 4 + 1] = Math.random() * 6.28;        // Pendel-Phase
}
function neuerStaub(i) {
  const p = spielerPos();
  staub.pos[i * 3] = p.x + (Math.random() - 0.5) * 40;
  staub.pos[i * 3 + 1] = p.y + 0.4 + Math.random() * 4;
  staub.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 40;
  staub.daten[i * 4] = Math.random() * 6.28;
  staub.daten[i * 4 + 1] = 0.2 + Math.random() * 0.5;
}
function neuesBlatt(i, sofort = false) {
  const p = spielerPos();
  blaetter.pos[i * 3] = p.x + (Math.random() - 0.5) * 50;
  blaetter.pos[i * 3 + 1] = p.y + (sofort ? 1 + Math.random() * 8 : 6 + Math.random() * 4);
  blaetter.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 50;
  blaetter.daten[i * 4] = 0.7 + Math.random() * 0.7;
  blaetter.daten[i * 4 + 1] = Math.random() * 6.28;
}
function neuerRauch(i, alter = 0) {
  if (!rauchQuellen.length) { rauch.pos[i * 3 + 1] = -999; return; }
  const q = rauchQuellen[i % rauchQuellen.length];
  rauch.pos[i * 3] = q.x + (Math.random() - 0.5) * 0.4;
  rauch.pos[i * 3 + 1] = q.y + alter * 0.9;
  rauch.pos[i * 3 + 2] = q.z + (Math.random() - 0.5) * 0.4;
  rauch.daten[i * 4] = alter;                             // Lebenszeit
  rauch.daten[i * 4 + 1] = Math.random() * 6.28;
  rauch.daten[i * 4 + 2] = i % rauchQuellen.length;       // Quelle
}
function neuerFunke(i, alter = 0) {
  if (!feuerQuellen.length) { funken.pos[i * 3 + 1] = -999; return; }
  const q = feuerQuellen[i % feuerQuellen.length];
  funken.pos[i * 3] = q.x + (Math.random() - 0.5) * 0.5 * q.groesse;
  funken.pos[i * 3 + 1] = q.y + alter * 1.6;
  funken.pos[i * 3 + 2] = q.z + (Math.random() - 0.5) * 0.5 * q.groesse;
  funken.daten[i * 4] = alter;
  funken.daten[i * 4 + 1] = i % feuerQuellen.length;
}

export function updateEffekte(dt) {
  if (!schnee) return;
  const p = spielerPos();
  const zone = S.zoneIndex ?? 0;

  // Schnee nur am Frostgipfel
  schnee.punkte.visible = zone === 5;
  if (schnee.punkte.visible) {
    for (let i = 0; i < schnee.anzahl; i++) {
      schnee.daten[i * 4 + 1] += dt;
      schnee.pos[i * 3] += Math.sin(schnee.daten[i * 4 + 1]) * dt * 0.8;
      schnee.pos[i * 3 + 1] -= schnee.daten[i * 4] * dt;
      if (schnee.pos[i * 3 + 1] < p.y - 4 || Math.abs(schnee.pos[i * 3] - p.x) > 40 || Math.abs(schnee.pos[i * 3 + 2] - p.z) > 40) neuerSchnee(i);
    }
    schnee.punkte.geometry.attributes.position.needsUpdate = true;
  }

  // Glühstaub in Wald/Steppe/Moor
  staub.punkte.visible = zone === 0 || zone === 2 || zone === 3;
  if (staub.punkte.visible) {
    for (let i = 0; i < staub.anzahl; i++) {
      staub.daten[i * 4] += dt * staub.daten[i * 4 + 1];
      staub.pos[i * 3] += Math.sin(staub.daten[i * 4]) * dt * 0.4;
      staub.pos[i * 3 + 1] += Math.cos(staub.daten[i * 4] * 0.7) * dt * 0.25;
      staub.pos[i * 3 + 2] += Math.cos(staub.daten[i * 4]) * dt * 0.4;
      if (Math.abs(staub.pos[i * 3] - p.x) > 28 || Math.abs(staub.pos[i * 3 + 2] - p.z) > 28
        || Math.abs(staub.pos[i * 3 + 1] - p.y) > 6) neuerStaub(i);
    }
    staub.punkte.geometry.attributes.position.needsUpdate = true;
  }

  // Blätter im Wald
  blaetter.punkte.visible = zone === 0;
  if (blaetter.punkte.visible) {
    for (let i = 0; i < blaetter.anzahl; i++) {
      blaetter.daten[i * 4 + 1] += dt * 2;
      blaetter.pos[i * 3] += Math.sin(blaetter.daten[i * 4 + 1]) * dt * 1.2;
      blaetter.pos[i * 3 + 1] -= blaetter.daten[i * 4] * dt;
      blaetter.pos[i * 3 + 2] += Math.cos(blaetter.daten[i * 4 + 1] * 0.8) * dt * 0.8;
      if (blaetter.pos[i * 3 + 1] < p.y - 2 || Math.abs(blaetter.pos[i * 3] - p.x) > 35 || Math.abs(blaetter.pos[i * 3 + 2] - p.z) > 35) neuesBlatt(i);
    }
    blaetter.punkte.geometry.attributes.position.needsUpdate = true;
  }

  // Rauch steigt gemächlich
  for (let i = 0; i < rauch.anzahl; i++) {
    rauch.daten[i * 4] += dt;
    rauch.daten[i * 4 + 1] += dt;
    rauch.pos[i * 3] += Math.sin(rauch.daten[i * 4 + 1]) * dt * 0.3 + dt * 0.3;
    rauch.pos[i * 3 + 1] += dt * 0.9;
    if (rauch.daten[i * 4] > 6) neuerRauch(i);
  }
  rauch.punkte.geometry.attributes.position.needsUpdate = true;

  // Funken tanzen schnell nach oben
  for (let i = 0; i < funken.anzahl; i++) {
    funken.daten[i * 4] += dt;
    funken.pos[i * 3] += (Math.random() - 0.5) * dt * 1.6;
    funken.pos[i * 3 + 1] += dt * (1.4 + Math.random());
    funken.pos[i * 3 + 2] += (Math.random() - 0.5) * dt * 1.6;
    if (funken.daten[i * 4] > 1.4) neuerFunke(i);
  }
  funken.punkte.geometry.attributes.position.needsUpdate = true;
}

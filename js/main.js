// PICZEL Legenden — Hauptprogramm: Renderer, VR- & Desktop-Steuerung, Spielschleife
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { S, WELT, klemme } from './zustand.js';
import { ZONEN, zonenMitte, STORY, KLASSEN } from './daten.js';
import { erschaffeWelt, updateWelt, hoeheAn } from './welt.js';
import { erschaffeBevoelkerung, updateWesen, alleKaempfer } from './wesen.js';
import { erschaffeSpieler, updateSpieler, greifAn, nutzeFaehigkeit, bindeWaffenNeu, benutzeItem } from './spieler.js';
import { initUI, updateUI, oeffneMenue, schliesseTafel, oeffneDialog, tafelKlick, istTafelOffen, meldung, zeigeGrossText } from './ui.js';
import { updateQuests, questsFuerNpc, nimmAn, gebeAb, questStand } from './quests.js';
import { heuereGefaehrtenAn } from './wesen.js';
import { speichere, lade, loesche, wendeQuestStandAn, updateSpeicher } from './speicher.js';
import { initEffekte, updateEffekte } from './effekte.js';
import { weckeAudio, piczelKlang } from './klang.js';
import { blobSchatten } from './bau.js';

let renderer, uhr;
const tasten = {};
let mausGesperrt = false;
let kameraNick = 0;
const knopfVorher = { links: {}, rechts: {} };
let snapBereit = true;
const raycaster = new THREE.Raycaster();
const tmpMatrix = new THREE.Matrix4();

// ---------------------------------------------------------------- Start-Bildschirm
const startScreen = document.getElementById('start');
const spielstand = lade();

function baueStartScreen() {
  const halter = document.getElementById('klassen');
  if (spielstand) {
    const k = KLASSEN[spielstand.spieler.klasseId];
    const btn = document.createElement('button');
    btn.className = 'klasse weiter';
    btn.innerHTML = `<b>▶ Weiterspielen</b><br>${k.symbol} ${k.name} — Level ${spielstand.spieler.lvl}`;
    btn.onclick = () => starteSpiel(spielstand.spieler.klasseId, spielstand);
    halter.appendChild(btn);
    const neu = document.createElement('button');
    neu.className = 'klasse neu';
    neu.textContent = '🗑 Neues Abenteuer beginnen (alter Held wird gelöscht)';
    neu.onclick = () => { loesche(); location.reload(); };
    halter.appendChild(neu);
    return;
  }
  for (const [id, k] of Object.entries(KLASSEN)) {
    const btn = document.createElement('button');
    btn.className = 'klasse';
    btn.innerHTML = `<span class="symbol">${k.symbol}</span><b>${k.name}</b><i>${k.rolle}</i><small>${k.text}</small>`;
    btn.onclick = () => starteSpiel(id, null);
    halter.appendChild(btn);
  }
}
document.getElementById('intro').textContent = STORY.einleitung;
baueStartScreen();

// ---------------------------------------------------------------- Spiel starten
function starteSpiel(klasseId, gespeichert) {
  startScreen.style.display = 'none';
  weckeAudio();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.xr.enabled = true;
  renderer.xr.setFoveation(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // satter, filmischer Look
  renderer.toneMappingExposure = 1.15;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));
  S.renderer = renderer;

  S.szene = new THREE.Scene();
  S.szene.fog = new THREE.Fog(0xbfe6ff, 80, 280);

  S.kamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 800);
  S.rig = new THREE.Group();
  S.rig.add(S.kamera);
  S.kamera.position.y = 1.65;
  S.szene.add(S.rig);
  S.rig.add(blobSchatten(0.5));

  erschaffeWelt();
  initEffekte();
  initUI();
  erschaffeBevoelkerung();

  const sp = erschaffeSpieler(klasseId, gespeichert?.spieler ?? null);
  wendeQuestStandAn(gespeichert);

  // Startposition: gespeichert oder Steinfurt
  const start = gespeichert?.spieler?.pos ?? (() => { const m = zonenMitte(0); return { x: m.x + 4, z: m.z + 6 }; })();
  S.rig.position.set(start.x, hoeheAn(start.x, start.z), start.z);
  if (gespeichert?.spieler?.gefaehrten) for (const id of gespeichert.spieler.gefaehrten) heuereGefaehrtenAn(id);

  richteVrEin();
  richteDesktopEin();

  uhr = new THREE.Clock();
  renderer.setAnimationLoop(schleife);

  window.addEventListener('beforeunload', speichere);
  document.addEventListener('visibilitychange', () => { if (document.hidden) speichere(); });
  window.addEventListener('resize', () => {
    S.kamera.aspect = window.innerWidth / window.innerHeight;
    S.kamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (!gespeichert) {
    zeigeGrossText('Willkommen in Piczelia!', '#4adfff');
    meldung('Sprich mit Älteste Mora (gelbes ! über dem Kopf).');
    meldung(S.modus === 'vr' ? '' : 'Klicke ins Bild, dann: WASD = laufen, Maus = umsehen.');
  } else {
    meldung('Willkommen zurück, Splitterwanderer!');
  }

  // Test-Haken für automatische Prüfungen
  window.__rpg = { S, greifAn, nutzeFaehigkeit, oeffneMenue, oeffneDialog, hoeheAn, alleKaempfer, speichere, questsFuerNpc, nimmAn, gebeAb, questStand, heuereGefaehrtenAn };
}

// ---------------------------------------------------------------- VR-Steuerung (Quest 3)
function richteVrEin() {
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('connected', (e) => {
      controller.userData.hand = e.data.handedness;
      controller.userData.gamepad = e.data.gamepad;
      if (e.data.handedness === 'left') S.hand.links = controller;
      else S.hand.rechts = controller;
      bindeWaffenNeu();
    });
    S.rig.add(controller);
    S.controller[i] = controller;
    // Zeige-Strahl (sichtbar wenn Tafel offen)
    const linie = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]),
      new THREE.LineBasicMaterial({ color: 0x4adfff })
    );
    linie.name = 'strahl';
    linie.visible = false;
    controller.add(linie);
  }
  renderer.xr.addEventListener('sessionstart', () => {
    S.modus = 'vr';
    weckeAudio();
    bindeWaffenNeu();
    meldung('Linker Stick: laufen · Rechter Stick: drehen · Trigger: angreifen/auswählen');
    meldung('A/B/X/Y: Fähigkeiten · Linker Griff: Menü');
  });
  renderer.xr.addEventListener('sessionend', () => {
    S.modus = 'desktop';
    bindeWaffenNeu();
  });
}

function knopfNeu(seite, index, gedrueckt) {
  const vorher = knopfVorher[seite][index] ?? false;
  knopfVorher[seite][index] = gedrueckt;
  return gedrueckt && !vorher;
}

function vrEingabe(dt, eingabe) {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const quelle of session.inputSources) {
    const gp = quelle.gamepad;
    if (!gp) continue;
    const hand = quelle.handedness;
    const achsen = gp.axes;
    if (hand === 'left') {
      // Laufen relativ zur Blickrichtung
      const x = achsen[2] ?? 0, y = achsen[3] ?? 0;
      const staerke = Math.hypot(x, y);
      if (staerke > 0.12) {
        const blick = new THREE.Vector3();
        S.kamera.getWorldDirection(blick);
        blick.y = 0; blick.normalize();
        const rechts = new THREE.Vector3(-blick.z, 0, blick.x);
        eingabe.richtung.copy(blick).multiplyScalar(-y).addScaledVector(rechts, x).normalize();
        eingabe.staerke = Math.min(1, staerke);
      }
      if (knopfNeu('links', 0, gp.buttons[0]?.pressed)) interagiere(S.hand.links);   // Trigger
      if (knopfNeu('links', 1, gp.buttons[1]?.pressed)) {                            // Griff = Menü
        if (istTafelOffen()) schliesseTafel(); else oeffneMenue();
      }
      if (knopfNeu('links', 4, gp.buttons[4]?.pressed)) nutzeFaehigkeit(2);          // X
      if (knopfNeu('links', 5, gp.buttons[5]?.pressed)) nutzeFaehigkeit(3);          // Y
    } else if (hand === 'right') {
      const x = achsen[2] ?? 0;
      if (Math.abs(x) > 0.6 && snapBereit) {
        S.rig.rotation.y -= Math.sign(x) * Math.PI / 4;
        snapBereit = false;
      }
      if (Math.abs(x) < 0.3) snapBereit = true;
      if (knopfNeu('rechts', 0, gp.buttons[0]?.pressed)) {                           // Trigger
        if (istTafelOffen()) klickeMitController(S.hand.rechts);
        else if (!interagiere(S.hand.rechts, true)) greifAn();
      }
      if (knopfNeu('rechts', 4, gp.buttons[4]?.pressed)) nutzeFaehigkeit(0);         // A
      if (knopfNeu('rechts', 5, gp.buttons[5]?.pressed)) nutzeFaehigkeit(1);         // B
    }
  }
  // Strahlen nur zeigen, wenn die Tafel offen ist
  for (const c of S.controller) {
    if (!c) continue;
    const strahl = c.getObjectByName('strahl');
    if (strahl) strahl.visible = istTafelOffen();
  }
}

function klickeMitController(controller) {
  if (!controller) return;
  tmpMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix);
  tafelKlick(raycaster);
}

// NPC ansprechen (in der Nähe). Gibt true zurück, wenn jemand da war.
function interagiere(controller, nurNah = false) {
  if (istTafelOffen()) { if (controller) klickeMitController(controller); return true; }
  let bester = null, besteD = 4.2;
  for (const n of S.npcListe) {
    const d = n.pos.distanceTo(S.rig.position);
    if (d < besteD) { besteD = d; bester = n; }
  }
  if (bester) { oeffneDialog(bester); return true; }
  return false;
}

// ---------------------------------------------------------------- Desktop-Steuerung (zum Testen am Mac)
function richteDesktopEin() {
  const leinwand = renderer.domElement;
  leinwand.addEventListener('click', () => {
    if (S.modus === 'vr') return;
    if (!mausGesperrt && !istTafelOffen()) leinwand.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    mausGesperrt = document.pointerLockElement === leinwand;
    document.getElementById('fadenkreuz').style.display = mausGesperrt ? 'block' : 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!mausGesperrt || S.modus === 'vr') return;
    S.rig.rotation.y -= e.movementX * 0.0024;
    kameraNick = klemme(kameraNick - e.movementY * 0.0024, -1.45, 1.45);
    S.kamera.rotation.x = kameraNick;
  });
  document.addEventListener('mousedown', (e) => {
    if (S.modus === 'vr' || e.button !== 0) return;
    if (istTafelOffen()) {
      // Klick auf die Tafel: Strahl aus Bildschirmmitte (gesperrt) oder Mausposition
      if (mausGesperrt) raycaster.setFromCamera(new THREE.Vector2(0, 0), S.kamera);
      else {
        const r = renderer.domElement.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), S.kamera);
      }
      tafelKlick(raycaster);
      return;
    }
    if (!mausGesperrt) return;
    // NPC in Reichweite? Sonst angreifen.
    let npcNah = null;
    for (const n of S.npcListe) if (n.pos.distanceTo(S.rig.position) < 3.6) { npcNah = n; break; }
    if (npcNah) oeffneDialog(npcNah);
    else greifAn();
  });
  document.addEventListener('keydown', (e) => {
    tasten[e.code] = true;
    if (S.modus === 'vr') return;
    if (e.code === 'KeyE') interagiere(null);
    if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); if (istTafelOffen()) schliesseTafel(); else oeffneMenue(); }
    if (e.code === 'KeyM') { if (istTafelOffen()) schliesseTafel(); else oeffneMenue('karte'); }
    if (e.code === 'Digit1') nutzeFaehigkeit(0);
    if (e.code === 'Digit2') nutzeFaehigkeit(1);
    if (e.code === 'Digit3') nutzeFaehigkeit(2);
    if (e.code === 'Digit4') nutzeFaehigkeit(3);
    if (e.code === 'Digit5') {
      const trank = S.spieler?.inventar.find(i => i.art === 'heiltrank');
      if (trank) benutzeItem(trank); else meldung('Kein Heiltrank im Beutel.');
    }
  });
  document.addEventListener('keyup', (e) => { tasten[e.code] = false; });
}

function desktopEingabe(eingabe) {
  if (S.modus === 'vr') return;
  let x = 0, z = 0;
  if (tasten.KeyW || tasten.ArrowUp) z -= 1;
  if (tasten.KeyS || tasten.ArrowDown) z += 1;
  if (tasten.KeyA || tasten.ArrowLeft) x -= 1;
  if (tasten.KeyD || tasten.ArrowRight) x += 1;
  if (x || z) {
    const blick = new THREE.Vector3();
    S.kamera.getWorldDirection(blick);
    blick.y = 0; blick.normalize();
    const rechts = new THREE.Vector3(-blick.z, 0, blick.x);
    eingabe.richtung.copy(blick).multiplyScalar(-z).addScaledVector(rechts, x).normalize();
    eingabe.staerke = 1;
  }
}

// ---------------------------------------------------------------- Spielschleife
const eingabe = { richtung: new THREE.Vector3(), staerke: 0 };
function schleife() {
  const dt = Math.min(uhr.getDelta(), 0.05);
  S.zeit += dt;

  eingabe.richtung.set(0, 0, 0);
  eingabe.staerke = 0;
  vrEingabe(dt, eingabe);
  desktopEingabe(eingabe);

  updateSpieler(dt, eingabe);
  updateWesen(dt);
  updateWelt(dt);
  updateEffekte(dt);
  updateQuests(dt);
  updateUI(dt);
  updateSpeicher(dt);

  renderer.render(S.szene, S.kamera);
}

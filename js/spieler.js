// Der Spieler: Klassen, Werte, Fähigkeiten, Ausrüstung, Kampf
import * as THREE from 'three';
import { S, WELT, klemme } from './zustand.js';
import { KLASSEN, xpFuerLevel, zonenMitte, SLOTS } from './daten.js';
import { hoeheAn, kollidiere, zoneIndexAn } from './welt.js';
import { gegnerInUmkreis, schadeGegner, feuerGeschoss, beschwoereTier } from './wesen.js';
import { meldung, schadensZahl, zeigeGrossText } from './ui.js';
import * as klang from './klang.js';
import { teil, comicMesh, GEO, blobSchatten } from './bau.js';

const PICZEL_SCHLUESSEL = 'piczelLegendenPiczel';

export function erschaffeSpieler(klasseId, gespeichert = null) {
  const k = KLASSEN[klasseId];
  const sp = {
    klasseId, klasse: k,
    lvl: 1, xp: 0,
    gold: 25,
    piczel: parseInt(localStorage.getItem(PICZEL_SCHLUESSEL) || '0'),
    inventar: [], ausruestung: { waffe: null, kopf: null, brust: null, beine: null, fuesse: null },
    leben: 0, mana: 0, maxLeben: 0, maxMana: 0,
    cds: {}, globalCd: 0,
    buffs: {},                  // name -> Ablaufzeit
    hotTick: 0,
    kritBoost: false,
    totBis: 0,
    kaempfer: null,
    statistik: { kills: 0, tode: 0, quests: 0 },
  };
  if (gespeichert) {
    Object.assign(sp, {
      lvl: gespeichert.lvl, xp: gespeichert.xp, gold: gespeichert.gold,
      inventar: gespeichert.inventar ?? [], ausruestung: gespeichert.ausruestung ?? sp.ausruestung,
      statistik: gespeichert.statistik ?? sp.statistik,
    });
  }
  sp.kaempfer = {
    pos: S.rig.position,
    istSpieler: true,
    lebt: () => sp.leben > 0,
    nimmSchaden: (n) => nimmSchaden(sp, n),
  };
  sp.gibXp = (n) => gibXp(sp, n);
  sp.gibGold = (n) => { sp.gold += n; };
  sp.gibPiczel = (n) => { sp.piczel += n; localStorage.setItem(PICZEL_SCHLUESSEL, String(sp.piczel)); };
  sp.gibItem = (item) => {
    if (sp.inventar.length >= 30) { meldung('🎒 Dein Beutel ist voll!'); return false; }
    sp.inventar.push(item);
    return true;
  };
  sp.heile = (n) => {
    if (sp.leben <= 0) return;
    sp.leben = Math.min(sp.maxLeben, sp.leben + n);
    schadensZahl(S.rig.position.clone().add(new THREE.Vector3(0, 2, 0)), `+${Math.round(n)}`, '#6af56a');
  };
  sp.gesamtAngriff = () => wert(sp, 'angriff');
  berechneWerte(sp, true);
  S.spieler = sp;
  baueWaffen(sp);
  return sp;
}

function wert(sp, name) {
  const k = sp.klasse;
  let w = k.basis[name] + k.proLevel[name] * (sp.lvl - 1);
  for (const slot of SLOTS) {
    const item = sp.ausruestung[slot];
    if (item?.stats[name]) w += item.stats[name];
  }
  return Math.round(w);
}

export function berechneWerte(sp, auffuellen = false) {
  const lebenAnteil = sp.maxLeben ? sp.leben / sp.maxLeben : 1;
  const manaAnteil = sp.maxMana ? sp.mana / sp.maxMana : 1;
  sp.maxLeben = wert(sp, 'leben');
  sp.maxMana = wert(sp, 'mana');
  sp.leben = auffuellen ? sp.maxLeben : Math.round(sp.maxLeben * lebenAnteil);
  sp.mana = auffuellen ? sp.maxMana : Math.round(sp.maxMana * manaAnteil);
}

function gibXp(sp, n) {
  if (sp.lvl >= 60) return;
  sp.xp += n;
  meldung(`+${n} Erfahrung`);
  while (sp.xp >= xpFuerLevel(sp.lvl) && sp.lvl < 60) {
    sp.xp -= xpFuerLevel(sp.lvl);
    sp.lvl++;
    berechneWerte(sp, true);
    klang.levelAuf();
    zeigeGrossText(`LEVEL ${sp.lvl}!`, '#ffd24a');
    sp.gibPiczel(2);
    meldung(`🎉 Level ${sp.lvl}! Du fühlst dich stärker. (+2 ✦)`);
  }
}

function nimmSchaden(sp, n) {
  if (sp.leben <= 0) return;
  let schaden = n;
  const abwehr = wert(sp, 'abwehr');
  schaden *= 1 - abwehr / (abwehr + 30 + 6 * sp.lvl);
  if (S.zeit < (sp.buffs.schild ?? 0)) schaden *= 0.4;
  schaden = Math.max(1, Math.round(schaden));
  sp.leben -= schaden;
  klang.aua();
  schadensZahl(S.rig.position.clone().add(new THREE.Vector3(0.3, 1.6, 0)), `-${schaden}`, '#ff6a5a');
  if (sp.leben <= 0) stirb(sp);
}

function stirb(sp) {
  sp.leben = 0;
  sp.statistik.tode++;
  sp.totBis = S.zeit + 4;
  klang.tod();
  zeigeGrossText('Du bist gefallen …', '#ff6a5a');
  meldung('💫 Du wachst in der nächsten Stadt wieder auf.');
}

function wiederbelebe(sp) {
  const zi = zoneIndexAn(S.rig.position.x, S.rig.position.z);
  const m = zonenMitte(zi);
  S.rig.position.set(m.x + 3, hoeheAn(m.x + 3, m.z + 3), m.z + 3);
  berechneWerte(sp, true);
  // Gegner beruhigen
  for (const g of S.gegnerListe) { g.bedrohung.delete(sp.kaempfer); if (g.zustand === 'jagd') g.zustand = 'rueckzug'; }
}

// ---------------------------------------------------------------- Ziel-Wahl
const _vorn = new THREE.Vector3(), _zuGegner = new THREE.Vector3();
export function zielWaehlen(maxDist = 30) {
  S.kamera.getWorldDirection(_vorn);
  _vorn.y = 0; _vorn.normalize();
  let bester = null, besteWertung = -1;
  for (const g of S.gegnerListe) {
    if (g.tot) continue;
    const d = g.pos.distanceTo(S.rig.position);
    if (d > maxDist) continue;
    _zuGegner.subVectors(g.pos, S.rig.position); _zuGegner.y = 0; _zuGegner.normalize();
    const blick = _vorn.dot(_zuGegner);
    if (blick < 0.5) continue;
    const wertung = blick * 2 - d / maxDist;
    if (wertung > besteWertung) { besteWertung = wertung; bester = g; }
  }
  S.ziel = bester;
  return bester;
}

// ---------------------------------------------------------------- Angriffe
export function greifAn() {
  const sp = S.spieler;
  if (!sp || sp.leben <= 0 || sp.globalCd > 0 || S.menueOffen || S.dialogOffen) return;
  const fern = sp.klasse.waffe === 'stab' || sp.klasse.waffe === 'bogen';
  sp.globalCd = 0.7;
  schwingeWaffe(sp);
  if (fern) {
    const ziel = (S.ziel && !S.ziel.tot && S.ziel.pos.distanceTo(S.rig.position) < 32) ? S.ziel : zielWaehlen(32);
    if (!ziel) { meldung('Kein Ziel in Sicht.'); return; }
    const start = waffenWeltPos(sp);
    const krit = Math.random() < (sp.klasseId === 'schurke' ? 0.2 : 0.1);
    feuerGeschoss(start, ziel, Math.round(wert(sp, 'angriff') * (krit ? 1.7 : 1)), {
      vonSpieler: true, quelle: sp.kaempfer, tempo: 30,
      farbe: sp.klasse.waffe === 'bogen' ? 0xd8b88a : 0x8ab8ff, pfeil: sp.klasse.waffe === 'bogen',
    });
    if (sp.klasse.waffe === 'bogen') klang.bogen(); else klang.zauber();
  } else {
    nahkampfTreffer(sp, 1, null);
  }
}

function nahkampfTreffer(sp, faktor, rueckenFaktor) {
  S.kamera.getWorldDirection(_vorn); _vorn.y = 0; _vorn.normalize();
  let getroffen = false;
  for (const g of S.gegnerListe) {
    if (g.tot) continue;
    const reichweite = 3.0 + g.def.groesse;
    if (g.pos.distanceTo(S.rig.position) > reichweite) continue;
    _zuGegner.subVectors(g.pos, S.rig.position); _zuGegner.y = 0; _zuGegner.normalize();
    if (_vorn.dot(_zuGegner) < 0.25) continue;
    let f = faktor;
    if (rueckenFaktor) {
      const gegnerBlick = new THREE.Vector3(Math.sin(g.mesh.rotation.y), 0, Math.cos(g.mesh.rotation.y));
      if (gegnerBlick.dot(_zuGegner) > 0.3) f = rueckenFaktor; // wir stehen hinter ihm
    }
    let krit = Math.random() < (sp.klasseId === 'schurke' ? 0.2 : 0.1);
    if (sp.kritBoost) { krit = true; sp.kritBoost = false; }
    schadeGegner(g, wert(sp, 'angriff') * f * (krit ? 1.7 : 1), { quelle: sp.kaempfer, krit });
    S.ziel = g;
    getroffen = true;
    klang.treffer();
    break;
  }
  if (!getroffen) klang.schwung();
  return getroffen;
}

export function nutzeFaehigkeit(index) {
  const sp = S.spieler;
  if (!sp || sp.leben <= 0 || S.menueOffen || S.dialogOffen) return;
  const f = sp.klasse.faehigkeiten[index];
  if (!f) return;
  if ((sp.cds[f.id] ?? 0) > S.zeit) { return; }
  if (sp.mana < f.kosten) { meldung('Nicht genug Mana!'); return; }

  const brauchtZiel = ['geschoss', 'dot', 'schattenschritt'].includes(f.art);
  let ziel = null;
  if (brauchtZiel) {
    ziel = (S.ziel && !S.ziel.tot && S.ziel.pos.distanceTo(S.rig.position) < 32) ? S.ziel : zielWaehlen(32);
    if (!ziel) { meldung('Kein Ziel in Sicht.'); return; }
  }
  if (f.art === 'nahkampf') {
    // erst prüfen, ob jemand in Reichweite ist
    if (!gegnerInUmkreis(S.rig.position, 4.5).length) { meldung('Kein Gegner in Reichweite.'); return; }
  }

  sp.mana -= f.kosten;
  sp.cds[f.id] = S.zeit + f.cd;
  schwingeWaffe(sp);
  const angriff = wert(sp, 'angriff');

  switch (f.art) {
    case 'nahkampf':
      nahkampfTreffer(sp, f.faktor, f.rueckenFaktor ?? null);
      break;
    case 'geschoss':
      feuerGeschoss(waffenWeltPos(sp), ziel, Math.round(angriff * f.faktor), {
        vonSpieler: true, quelle: sp.kaempfer, tempo: 26, farbe: f.farbe ?? 0xffe08a, vampir: f.vampir ?? 0,
      });
      klang.zauber();
      break;
    case 'faecher': {
      const ziele = gegnerInUmkreis(S.rig.position, 26)
        .sort((a, b) => a.pos.distanceTo(S.rig.position) - b.pos.distanceTo(S.rig.position))
        .slice(0, f.anzahl);
      if (!ziele.length) { meldung('Kein Ziel in Sicht.'); break; }
      for (const z of ziele) feuerGeschoss(waffenWeltPos(sp), z, Math.round(angriff * f.faktor), { vonSpieler: true, quelle: sp.kaempfer, tempo: 28, farbe: f.farbe, pfeil: true });
      klang.bogen();
      break;
    }
    case 'aoe': {
      const ziele = gegnerInUmkreis(S.rig.position, f.radius);
      for (const z of ziele) {
        schadeGegner(z, angriff * f.faktor, { quelle: sp.kaempfer });
        if (f.wurzel) z.wurzelBis = S.zeit + f.wurzel;
        if (f.verlangsamung) z.verlangsamtBis = S.zeit + f.verlangsamung;
      }
      klang.zauber();
      if (!ziele.length) meldung('Kein Gegner im Umkreis.');
      break;
    }
    case 'heilung':
      sp.heile(sp.maxLeben * f.anteil);
      klang.heilung();
      break;
    case 'hot':
      sp.buffs.hot = S.zeit + f.dauer;
      sp.buffs.hotAnteil = f.anteil;
      klang.heilung();
      break;
    case 'gruppenheilung':
      sp.heile(sp.maxLeben * f.anteil);
      for (const gf of S.gefaehrten) if (gf.lebt()) gf.hp = Math.min(gf.maxHp, gf.hp + gf.maxHp * f.anteil);
      klang.heilung();
      break;
    case 'buff':
      sp.buffs[f.buff] = S.zeit + f.dauer;
      klang.zauber();
      break;
    case 'spott':
      for (const g of gegnerInUmkreis(S.rig.position, f.radius)) {
        g.bedrohung.set(sp.kaempfer, (g.bedrohung.get(sp.kaempfer) || 0) + 1000);
        if (g.zustand === 'ruhe') g.zustand = 'jagd';
      }
      meldung('„HIERHER, IHR FEIGLINGE!"');
      klang.aua();
      break;
    case 'dot':
      ziel.dots.push({ schaden: Math.max(1, Math.round(angriff * f.faktor)), rest: f.dauer, quelle: sp.kaempfer });
      schadeGegner(ziel, angriff * 0.3, { quelle: sp.kaempfer });
      klang.zauber();
      break;
    case 'teleport': {
      S.kamera.getWorldDirection(_vorn); _vorn.y = 0; _vorn.normalize();
      const neu = S.rig.position.clone().addScaledVector(_vorn, f.weite);
      if (hoeheAn(neu.x, neu.z) > WELT.wasser + 0.2) {
        S.rig.position.x = neu.x; S.rig.position.z = neu.z;
        kollidiere(S.rig.position, 0.4);
      }
      klang.zauber();
      break;
    }
    case 'schattenschritt': {
      const hinter = ziel.pos.clone().add(new THREE.Vector3(Math.sin(ziel.mesh.rotation.y), 0, Math.cos(ziel.mesh.rotation.y)).multiplyScalar(-1.8));
      if (hoeheAn(hinter.x, hinter.z) > WELT.wasser + 0.2) { S.rig.position.x = hinter.x; S.rig.position.z = hinter.z; }
      sp.kritBoost = true;
      klang.zauber();
      break;
    }
    case 'begleiter':
      beschwoereTier(sp.klasseId === 'jaeger' ? 'wolf' : 'wichtel', f.dauer);
      klang.zauber();
      break;
  }
}

// ---------------------------------------------------------------- Tränke / Ausrüstung / Handel
export function benutzeItem(item) {
  const sp = S.spieler;
  const idx = sp.inventar.indexOf(item);
  if (item.slot === 'trank') {
    if (item.art === 'heiltrank') { sp.heile(sp.maxLeben * 0.4); klang.heilung(); }
    else { sp.mana = Math.min(sp.maxMana, sp.mana + sp.maxMana * 0.5); klang.zauber(); }
    sp.inventar.splice(idx, 1);
    return;
  }
  // Anlegen (Waffen nur passend zur Klasse)
  if (item.slot === 'waffe' && item.art !== sp.klasse.waffe) { meldung(`Als ${sp.klasse.name} kämpfst du mit: ${sp.klasse.waffe}.`); return; }
  if (item.slot !== 'waffe' && item.art !== sp.klasse.ruestung) { meldung(`Deine Klasse trägt ${sp.klasse.ruestung}-Rüstung.`); return; }
  const alt = sp.ausruestung[item.slot];
  sp.ausruestung[item.slot] = item;
  sp.inventar.splice(idx, 1);
  if (alt) sp.inventar.push(alt);
  berechneWerte(sp);
  baueWaffen(sp);
  meldung(`Angelegt: ${item.name}`);
  klang.beuteKlang();
}

export function verkaufeItem(item) {
  const sp = S.spieler;
  const idx = sp.inventar.indexOf(item);
  if (idx < 0) return;
  sp.inventar.splice(idx, 1);
  const erloes = Math.max(1, Math.round(item.wert * 0.4));
  sp.gold += erloes;
  klang.muenze();
  meldung(`Verkauft: ${item.name} (+${erloes} Gold)`);
}

// ---------------------------------------------------------------- Waffen-Optik
function waffenGeo(art, sp) {
  const guete = sp.ausruestung.waffe ? sp.ausruestung.waffe.seltenheit : 0;
  const glanz = [0x9aa0a6, 0x3ddc84, 0x4aa8ff, 0xc06bff, 0xffa726][guete];
  if (art === 'schwert') return [
    teil(GEO.box, 0xd8d8e0, 0, 0.45, 0, 0, 0, 0, 0.07, 0.7, 0.02),
    teil(GEO.kegel, 0xd8d8e0, 0, 0.85, 0, 0, 0, 0, 0.07, 0.12, 0.02),
    teil(GEO.box, glanz, 0, 0.1, 0, 0, 0, 0, 0.2, 0.05, 0.05),
    teil(GEO.zylinder, 0x6a4a2a, 0, -0.02, 0, 0, 0, 0, 0.04, 0.2, 0.04),
  ];
  if (art === 'kolben') return [
    teil(GEO.zylinder, 0x8a6a4a, 0, 0.25, 0, 0, 0, 0, 0.04, 0.5, 0.04),
    teil(GEO.kugel, glanz, 0, 0.55, 0, 0, 0, 0, 0.18, 0.2, 0.18),
  ];
  if (art === 'stab') return [
    teil(GEO.zylinder, 0x6a4a2a, 0, 0.35, 0, 0, 0, 0, 0.035, 0.85, 0.035),
    teil(GEO.kugel, glanz, 0, 0.82, 0, 0, 0, 0, 0.12),
  ];
  if (art === 'bogen') return [
    teil(GEO.ring, 0x6a4a2a, 0, 0.3, 0, 0, Math.PI / 2, 0, 0.8, 0.8, 0.5),
    teil(GEO.box, glanz, 0, 0.3, 0, 0, 0, 0, 0.04, 0.1, 0.06),
  ];
  // dolch
  return [
    teil(GEO.box, 0xd8d8e0, 0, 0.25, 0, 0, 0, 0, 0.05, 0.3, 0.02),
    teil(GEO.kegel, 0xd8d8e0, 0, 0.45, 0, 0, 0, 0, 0.05, 0.1, 0.02),
    teil(GEO.box, glanz, 0, 0.08, 0, 0, 0, 0, 0.14, 0.04, 0.04),
  ];
}

let waffeRechts = null, waffeLinks = null;
function baueWaffen(sp) {
  const elternR = S.modus === 'vr' ? S.hand.rechts : S.kamera;
  const elternL = S.modus === 'vr' ? S.hand.links : S.kamera;
  if (waffeRechts) waffeRechts.parent?.remove(waffeRechts);
  if (waffeLinks) waffeLinks.parent?.remove(waffeLinks);
  waffeRechts = comicMesh(waffenGeo(sp.klasse.waffe, sp), 0.012);
  if (S.modus === 'vr') {
    waffeRechts.rotation.x = -0.6;
    waffeRechts.position.set(0, -0.02, -0.05);
  } else {
    waffeRechts.position.set(0.32, -0.32, -0.6);
    waffeRechts.rotation.set(0.3, -0.2, 0);
  }
  elternR.add(waffeRechts);
  if (sp.klasseId === 'schurke') {
    waffeLinks = comicMesh(waffenGeo('dolch', sp), 0.012);
    if (S.modus === 'vr') { waffeLinks.rotation.x = -0.6; waffeLinks.position.set(0, -0.02, -0.05); }
    else { waffeLinks.position.set(-0.32, -0.32, -0.6); waffeLinks.rotation.set(0.3, 0.2, 0); }
    elternL.add(waffeLinks);
  } else {
    waffeLinks = null;
  }
}
export function bindeWaffenNeu() { if (S.spieler) baueWaffen(S.spieler); }

let schwingZeit = 0;
function schwingeWaffe() { schwingZeit = 0.25; }
function waffenWeltPos(sp) {
  const v = new THREE.Vector3();
  if (waffeRechts) waffeRechts.getWorldPosition(v);
  else S.kamera.getWorldPosition(v);
  return v;
}

// ---------------------------------------------------------------- VR-Schwung (Waffe körperlich schwingen!)
let letzteHandPos = new THREE.Vector3();
let handTempo = 0, schwungCd = 0;
function pruefeKoerperSchwung(sp, dt) {
  if (S.modus !== 'vr' || !S.hand.rechts) return;
  const fern = sp.klasse.waffe === 'stab' || sp.klasse.waffe === 'bogen';
  if (fern) return;
  const p = new THREE.Vector3();
  S.hand.rechts.getWorldPosition(p);
  handTempo = p.distanceTo(letzteHandPos) / Math.max(dt, 0.001);
  letzteHandPos.copy(p);
  schwungCd -= dt;
  if (handTempo > 2.3 && schwungCd <= 0) {
    const nahe = gegnerInUmkreis(S.rig.position, 3.4);
    if (nahe.length) { schwungCd = 0.5; sp.globalCd = 0; nahkampfTreffer(sp, 1, null); }
  }
}

// ---------------------------------------------------------------- Update
export function updateSpieler(dt, eingabe) {
  const sp = S.spieler;
  if (!sp) return;

  if (sp.leben <= 0) {
    if (S.zeit > sp.totBis) wiederbelebe(sp);
    return;
  }

  sp.globalCd = Math.max(0, sp.globalCd - dt);

  // Bewegung (eingabe.richtung = Weltrichtung, bereits normiert)
  if (eingabe.richtung.lengthSq() > 0.001) {
    let tempo = 5.4;
    if (S.zeit < (sp.buffs.tempo ?? 0)) tempo *= 1.9;
    const neu = S.rig.position.clone().addScaledVector(eingabe.richtung, tempo * dt * eingabe.staerke);
    const h = hoeheAn(neu.x, neu.z);
    if (h > WELT.wasser - 0.5) {  // nicht ins tiefe Wasser laufen
      // sanfte Hänge erlauben, steile Wände nicht
      const dh = h - hoeheAn(S.rig.position.x, S.rig.position.z);
      if (dh < 1.4) { S.rig.position.x = neu.x; S.rig.position.z = neu.z; }
    }
    kollidiere(S.rig.position, 0.4);
  }
  S.rig.position.y = hoeheAn(S.rig.position.x, S.rig.position.z);

  // Erholung
  const imKampf = S.gegnerListe.some(g => !g.tot && g.zustand === 'jagd' && g.bedrohung.has(sp.kaempfer) && g.pos.distanceTo(S.rig.position) < 50);
  sp.leben = Math.min(sp.maxLeben, sp.leben + sp.maxLeben * (imKampf ? 0.002 : 0.03) * dt);
  sp.mana = Math.min(sp.maxMana, sp.mana + sp.maxMana * (imKampf ? 0.015 : 0.05) * dt);
  sp.imKampf = imKampf;

  // Heilung über Zeit
  if (S.zeit < (sp.buffs.hot ?? 0)) {
    sp.hotTick -= dt;
    if (sp.hotTick <= 0) { sp.hotTick = 1; sp.heile(sp.maxLeben * (sp.buffs.hotAnteil ?? 0.05)); }
  }

  // Ziel verlieren, wenn tot oder weit weg
  if (S.ziel && (S.ziel.tot || S.ziel.pos.distanceTo(S.rig.position) > 45)) S.ziel = null;

  pruefeKoerperSchwung(sp, dt);

  // Waffenschwung-Animation
  if (schwingZeit > 0) {
    schwingZeit -= dt;
    const t = Math.sin((0.25 - schwingZeit) / 0.25 * Math.PI);
    if (waffeRechts) waffeRechts.rotation.x = (S.modus === 'vr' ? -0.6 : 0.3) - t * 1.2;
  }
}

// ---------------------------------------------------------------- Speichern
export function exportiereSpieler() {
  const sp = S.spieler;
  return {
    klasseId: sp.klasseId, lvl: sp.lvl, xp: sp.xp, gold: sp.gold,
    inventar: sp.inventar, ausruestung: sp.ausruestung, statistik: sp.statistik,
    pos: { x: S.rig.position.x, z: S.rig.position.z },
    gefaehrten: S.gefaehrten.filter(g => !g.istTier).map(g => g.typ.id),
  };
}

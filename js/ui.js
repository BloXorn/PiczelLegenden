// HUD, Schwebe-Texte, Menü-Tafel, Dialoge, Händler, Karte
import * as THREE from 'three';
import { S, klemme } from './zustand.js';
import { ZONEN, zonenMitte, SELTENHEITEN, SLOTS, SLOT_NAMEN, heiltrank, manatrank, zufallsItem, GEFAEHRTEN_TYPEN, QUESTS_NACH_ID, NPCS_NACH_ID } from './daten.js';
import { rngFabrik } from './zustand.js';
import * as klang from './klang.js';
import { questsFuerNpc, nimmAn, gebeAb, aktiveQuestListe, questZielPos, istBereit } from './quests.js';
import { benutzeItem, verkaufeItem, exportiereSpieler } from './spieler.js';
import { heuereGefaehrtenAn, entlasseGefaehrten } from './wesen.js';

// ---------------------------------------------------------------- Text-Sprites
export function textSprite(text, opt = {}) {
  const groesse = opt.groesse ?? 44;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${groesse}px 'Trebuchet MS', sans-serif`;
  const breite = Math.min(1024, Math.ceil(ctx.measureText(text).width) + 40);
  c.width = breite; c.height = groesse + 40;
  const ctx2 = c.getContext('2d');
  ctx2.font = `bold ${groesse}px 'Trebuchet MS', sans-serif`;
  ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
  ctx2.lineWidth = Math.max(6, groesse * 0.16);
  ctx2.strokeStyle = 'rgba(20,12,4,0.95)';
  ctx2.strokeText(text, c.width / 2, c.height / 2);
  ctx2.fillStyle = opt.farbe ?? '#ffffff';
  ctx2.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: !opt.immerVorn, transparent: true, toneMapped: false }));
  const faktor = (opt.skala ?? 1) * 0.012;
  sprite.scale.set(c.width * faktor, c.height * faktor, 1);
  return sprite;
}

// ---------------------------------------------------------------- Schadenszahlen
const zahlPool = [];
export function schadensZahl(pos, text, farbe = '#ffffff', krit = false) {
  let z = zahlPool.find(z => !z.aktiv);
  if (!z) {
    if (zahlPool.length > 26) return;
    z = { sprite: null, aktiv: false, alter: 0 };
    zahlPool.push(z);
  }
  if (z.sprite) S.szene.remove(z.sprite);
  z.sprite = textSprite(text, { farbe, groesse: krit ? 64 : 44, immerVorn: true });
  z.sprite.position.copy(pos);
  z.sprite.renderOrder = 20;
  S.szene.add(z.sprite);
  z.aktiv = true;
  z.alter = 0;
}

function updateZahlen(dt) {
  for (const z of zahlPool) {
    if (!z.aktiv) continue;
    z.alter += dt;
    z.sprite.position.y += dt * 1.2;
    z.sprite.material.opacity = 1 - z.alter / 1.1;
    if (z.alter > 1.1) { z.aktiv = false; S.szene.remove(z.sprite); }
  }
}

// ---------------------------------------------------------------- Meldungen & großer Text
const meldungen = [];
export function meldung(text) {
  meldungen.push({ text, zeit: S.zeit });
  if (meldungen.length > 6) meldungen.shift();
  hudVeraltet = true;
}

let grossSprite = null, grossBis = 0;
export function zeigeGrossText(text, farbe = '#ffd24a') {
  if (grossSprite) S.kamera.remove(grossSprite);
  grossSprite = textSprite(text, { farbe, groesse: 90, immerVorn: true });
  grossSprite.position.set(0, 0.25, -1.6);
  grossSprite.renderOrder = 30;
  grossSprite.scale.multiplyScalar(0.55);
  S.kamera.add(grossSprite);
  grossBis = S.zeit + 2.4;
}

// ---------------------------------------------------------------- HUD (Canvas vor der Kamera)
let hudCanvas, hudCtx, hudTex, hudMesh, hudVeraltet = true, hudTakt = 0;

export function initUI() {
  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 1024; hudCanvas.height = 460;
  hudCtx = hudCanvas.getContext('2d');
  hudTex = new THREE.CanvasTexture(hudCanvas);
  hudMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.65),
    new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, toneMapped: false })
  );
  hudMesh.position.set(0, -0.42, -1.45);
  hudMesh.rotation.x = -0.25;
  hudMesh.renderOrder = 25;
  S.kamera.add(hudMesh);

  // Ziel-Leuchtsäule für Quests
  zielSaeule = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  zielSaeule.visible = false;
  S.szene.add(zielSaeule);
}

function balken(x, y, b, h, anteil, farbe, text) {
  const ctx = hudCtx;
  ctx.fillStyle = 'rgba(20,14,8,0.75)';
  ctx.fillRect(x - 3, y - 3, b + 6, h + 6);
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(x, y, b, h);
  ctx.fillStyle = farbe;
  ctx.fillRect(x, y, b * klemme(anteil, 0, 1), h);
  if (text) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.strokeText(text, x + b / 2, y + h / 2);
    ctx.fillText(text, x + b / 2, y + h / 2);
  }
}

function maleHud() {
  const ctx = hudCtx, sp = S.spieler;
  ctx.clearRect(0, 0, 1024, 460);
  if (!sp) return;

  // Meldungen (links oben)
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 21px sans-serif';
  let y = 8;
  for (const m of meldungen) {
    const alter = S.zeit - m.zeit;
    if (alter > 8) continue;
    ctx.globalAlpha = klemme(1 - (alter - 6) / 2, 0, 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4;
    ctx.strokeText(m.text, 14, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.text, 14, y);
    y += 27;
  }
  ctx.globalAlpha = 1;

  // Quest-Verfolgung (rechts)
  const liste = aktiveQuestListe().slice(0, 4);
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px sans-serif';
  let qy = 8;
  for (const e of liste) {
    const t = `${e.q.haupt ? '✦ ' : ''}${e.q.titel}  ${Math.min(e.fortschritt, e.q.anzahl)}/${e.q.anzahl}`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4;
    ctx.strokeText(t, 1010, qy);
    ctx.fillStyle = e.fortschritt >= e.q.anzahl ? '#7af57a' : (e.q.haupt ? '#ffd24a' : '#cfe8ff');
    ctx.fillText(t, 1010, qy);
    qy += 26;
  }

  // Ziel (oben Mitte)
  if (S.ziel && !S.ziel.tot) {
    balken(312, 120, 400, 22, S.ziel.hp / S.ziel.maxHp, '#e84a3a', `${S.ziel.def.name}  ${Math.ceil(S.ziel.hp)}/${S.ziel.maxHp}`);
  }

  // Spieler-Balken
  balken(40, 300, 380, 26, sp.leben / sp.maxLeben, '#3ddc6a', `${Math.ceil(sp.leben)} / ${sp.maxLeben}`);
  balken(40, 334, 380, 20, sp.mana / sp.maxMana, '#3a9af5', `${Math.ceil(sp.mana)} / ${sp.maxMana}`);
  balken(40, 362, 380, 10, sp.xp / (Math.round(60 * Math.pow(sp.lvl, 1.75)) + 60), '#c06bff', null);
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#ffd24a';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5;
  const infoZeile = `Lv ${sp.lvl} ${sp.klasse.name}    ${sp.gold} Gold    ✦ ${sp.piczel}`;
  ctx.strokeText(infoZeile, 40, 390);
  ctx.fillText(infoZeile, 40, 390);
  if (sp.imKampf) { ctx.fillStyle = '#ff7a6a'; ctx.strokeText('⚔ IM KAMPF', 40, 270); ctx.fillText('⚔ IM KAMPF', 40, 270); }

  // Fähigkeiten 1-4
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    const f = sp.klasse.faehigkeiten[i];
    const x = 510 + i * 125, yK = 300;
    const cdRest = Math.max(0, (sp.cds[f.id] ?? 0) - S.zeit);
    ctx.fillStyle = cdRest > 0 ? 'rgba(40,30,20,0.85)' : 'rgba(60,45,25,0.85)';
    ctx.fillRect(x, yK, 115, 84);
    ctx.strokeStyle = sp.mana >= f.kosten ? '#ffd24a' : '#7a5a3a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, yK, 115, 84);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    const taste = S.modus === 'vr' ? ['A', 'B', 'X', 'Y'][i] : `${i + 1}`;
    ctx.fillText(taste, x + 18, yK + 20);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(f.name, x + 58, yK + 48);
    if (cdRest > 0) {
      ctx.fillStyle = '#ffb74a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${cdRest.toFixed(0)}s`, x + 58, yK + 72);
    } else {
      ctx.fillStyle = '#8ad8ff';
      ctx.font = '15px sans-serif';
      ctx.fillText(`${f.kosten} Mana`, x + 58, yK + 72);
    }
  }
  hudTex.needsUpdate = true;
}

// ---------------------------------------------------------------- Quest-Leuchtsäule
let zielSaeule = null;
function updateZielSaeule() {
  let zielPos = null;
  for (const e of aktiveQuestListe()) {
    if (e.q.art === 'besuchen' && e.fortschritt < e.q.anzahl) {
      const z = questZielPos(e.q);
      zielPos = { x: z.x, zKoord: z.z };
      break;
    }
    if (e.fortschritt >= e.q.anzahl) {
      const npc = S.npcListe.find(n => n.def.id === e.q.abgeber);
      if (npc) { zielPos = { x: npc.pos.x, zKoord: npc.pos.z }; break; }
    }
  }
  if (zielPos) {
    zielSaeule.visible = true;
    zielSaeule.position.set(zielPos.x, 30, zielPos.zKoord);
    zielSaeule.material.opacity = 0.16 + Math.sin(S.zeit * 2) * 0.06;
  } else {
    zielSaeule.visible = false;
  }
}

// ---------------------------------------------------------------- Tafel (Menü / Dialog / Händler)
let tafel = null, tafelCanvas, tafelCtx, tafelTex;
let knoepfe = [];
const tafelZustand = { seite: 'menue', tab: 'inventar', npc: null, detailQuest: null, waren: [] };

function sorgeFuerTafel() {
  if (tafel) return;
  tafelCanvas = document.createElement('canvas');
  tafelCanvas.width = 1024; tafelCanvas.height = 760;
  tafelCtx = tafelCanvas.getContext('2d');
  tafelTex = new THREE.CanvasTexture(tafelCanvas);
  tafel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.26),
    new THREE.MeshBasicMaterial({ map: tafelTex, transparent: true, depthTest: false, toneMapped: false })
  );
  tafel.renderOrder = 28;
  tafel.visible = false;
  S.szene.add(tafel);
}

function platziereTafel() {
  const blick = new THREE.Vector3();
  S.kamera.getWorldDirection(blick);
  blick.y = 0; blick.normalize();
  const kp = new THREE.Vector3();
  S.kamera.getWorldPosition(kp);
  tafel.position.copy(kp).addScaledVector(blick, 1.7);
  tafel.position.y = kp.y - 0.1;
  tafel.lookAt(kp);
}

export function istTafelOffen() { return tafel?.visible ?? false; }

export function oeffneMenue(tab = 'inventar') {
  sorgeFuerTafel();
  tafelZustand.seite = 'menue';
  tafelZustand.tab = tab;
  tafel.visible = true;
  S.menueOffen = true;
  platziereTafel();
  maleTafel();
}

export function oeffneDialog(npc) {
  sorgeFuerTafel();
  tafelZustand.seite = npc.def.rolle === 'haendler' ? 'haendler' : 'dialog';
  tafelZustand.npc = npc;
  tafelZustand.detailQuest = null;
  if (npc.def.rolle === 'haendler') {
    const sp = S.spieler;
    const rng = rngFabrik(Math.floor(S.zeit * 7) + npc.def.zone * 31);
    const zonenLvl = ZONEN[npc.def.zone].lvl[0] + 3;
    tafelZustand.waren = [heiltrank(zonenLvl), heiltrank(zonenLvl), manatrank(zonenLvl)];
    for (let i = 0; i < 5; i++) tafelZustand.waren.push(zufallsItem(Math.max(zonenLvl, Math.min(sp.lvl, ZONEN[npc.def.zone].lvl[1])), rng, sp.klasseId));
  }
  tafel.visible = true;
  S.dialogOffen = true;
  platziereTafel();
  maleTafel();
}

export function schliesseTafel() {
  if (tafel) tafel.visible = false;
  S.menueOffen = false;
  S.dialogOffen = false;
}

// ---- Zeichen-Helfer
function knopf(x, y, b, h, text, aktion, opt = {}) {
  const ctx = tafelCtx;
  ctx.fillStyle = opt.fuellung ?? '#f5e8c8';
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 4;
  // Harter Comic-Schatten NUR auf der Form (siehe Firmen-Stil!)
  ctx.fillStyle = 'rgba(36,26,16,0.9)';
  ctx.fillRect(x + 4, y + 5, b, h);
  ctx.fillStyle = opt.fuellung ?? '#f5e8c8';
  ctx.fillRect(x, y, b, h);
  ctx.strokeRect(x, y, b, h);
  ctx.fillStyle = opt.farbe ?? '#241a10';
  ctx.font = `bold ${opt.schrift ?? 22}px 'Trebuchet MS', sans-serif`;
  ctx.textAlign = opt.links ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, opt.links ? x + 14 : x + b / 2, y + h / 2, b - 20);
  knoepfe.push({ x, y, b, h, aktion });
}

function ueberschrift(text) {
  const ctx = tafelCtx;
  ctx.fillStyle = '#fff';
  ctx.font = "bold 40px 'Trebuchet MS', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 7;
  ctx.strokeText(text, 512, 18);
  ctx.fillText(text, 512, 18);
}

function textBlock(text, x, y, breite, zeilenHoehe = 26, schrift = 21, farbe = '#241a10') {
  const ctx = tafelCtx;
  ctx.font = `${schrift}px 'Trebuchet MS', sans-serif`;
  ctx.fillStyle = farbe;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const woerter = text.split(' ');
  let zeile = '', yy = y;
  for (const w of woerter) {
    if (ctx.measureText(zeile + w).width > breite) {
      ctx.fillText(zeile, x, yy); yy += zeilenHoehe; zeile = '';
    }
    zeile += w + ' ';
  }
  ctx.fillText(zeile, x, yy);
  return yy + zeilenHoehe;
}

function maleTafel() {
  knoepfe = [];
  const ctx = tafelCtx;
  ctx.clearRect(0, 0, 1024, 760);
  // Pergament-Hintergrund mit Comic-Rand
  ctx.fillStyle = 'rgba(36,26,16,0.92)';
  ctx.fillRect(14, 16, 1000, 738);
  ctx.fillStyle = '#fdf3da';
  ctx.fillRect(4, 4, 1000, 738);
  ctx.strokeStyle = '#241a10'; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 1000, 738);
  ctx.fillStyle = '#2a4a8a';
  ctx.fillRect(4, 4, 1000, 70);

  if (tafelZustand.seite === 'menue') maleMenue();
  else if (tafelZustand.seite === 'dialog') maleDialog();
  else if (tafelZustand.seite === 'haendler') maleHaendler();

  knopf(920, 14, 70, 50, '✕', () => schliesseTafel(), { fuellung: '#e8604a', farbe: '#fff' });
  tafelTex.needsUpdate = true;
}

function maleMenue() {
  const sp = S.spieler;
  ueberschrift('— Abenteurer-Buch —');
  const tabs = [['charakter', 'Charakter'], ['inventar', 'Beutel'], ['quests', 'Quests'], ['karte', 'Karte']];
  let tx = 30;
  for (const [id, name] of tabs) {
    knopf(tx, 86, 200, 52, name, () => { tafelZustand.tab = id; maleTafel(); },
      { fuellung: tafelZustand.tab === id ? '#ffd24a' : '#f5e8c8' });
    tx += 215;
  }
  const ctx = tafelCtx;

  if (tafelZustand.tab === 'charakter') {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#241a10';
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.fillText(`${sp.klasse.symbol} ${sp.klasse.name} — Level ${sp.lvl}`, 50, 170);
    ctx.font = "24px 'Trebuchet MS', sans-serif";
    const zeilen = [
      `Leben: ${Math.ceil(sp.leben)} / ${sp.maxLeben}`,
      `Mana: ${Math.ceil(sp.mana)} / ${sp.maxMana}`,
      `Angriff: ${sp.gesamtAngriff()}`,
      `Rolle: ${sp.klasse.rolle}`,
      `Gold: ${sp.gold}      ✦ Piczel: ${sp.piczel}`,
      `Besiegte Gegner: ${sp.statistik.kills ?? 0}`,
    ];
    zeilen.forEach((z, i) => ctx.fillText(z, 50, 220 + i * 36));
    ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
    ctx.fillText('Ausrüstung:', 520, 170);
    SLOTS.forEach((slot, i) => {
      const item = sp.ausruestung[slot];
      const farbe = item ? SELTENHEITEN[item.seltenheit].farbe : '#8a8a80';
      knopf(520, 210 + i * 62, 440, 52, `${SLOT_NAMEN[slot]}: ${item ? item.name : '—'}`, () => {}, { farbe, links: true, schrift: 20 });
    });
    if (S.gefaehrten.length) {
      ctx.fillStyle = '#241a10';
      ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Gefährten: ${S.gefaehrten.map(g => g.typ.name).join(', ')}`, 50, 480);
    }
  }

  if (tafelZustand.tab === 'inventar') {
    if (!sp.inventar.length) {
      textBlock('Dein Beutel ist leer. Besiege Gegner oder kaufe beim Händler ein! Antippen = anlegen oder trinken.', 60, 200, 880, 30, 26);
    }
    sp.inventar.slice(0, 28).forEach((item, i) => {
      const sp2 = Math.floor(i / 14);
      const x = 30 + sp2 * 490, y = 160 + (i % 14) * 41;
      const s = SELTENHEITEN[item.seltenheit];
      const text = item.slot === 'trank' ? `🧪 ${item.name}` : `${item.name} (${SLOT_NAMEN[item.slot]}, St. ${item.ilvl})`;
      knopf(x, y, 470, 36, text, () => { benutzeItem(item); maleTafel(); }, { farbe: s.farbe, fuellung: '#3a2e20', links: true, schrift: 19 });
    });
  }

  if (tafelZustand.tab === 'quests') {
    const liste = aktiveQuestListe();
    if (!liste.length) textBlock('Keine aktiven Quests. Sprich mit Leuten, über denen ein gelbes ! schwebt.', 60, 200, 880, 30, 26);
    let y = 160;
    for (const e of liste.slice(0, 8)) {
      const fertig = e.fortschritt >= e.q.anzahl;
      const ctx = tafelCtx;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = fertig ? '#2a8a2a' : (e.q.haupt ? '#b8860a' : '#241a10');
      ctx.fillText(`${e.q.haupt ? '✦ ' : ''}${e.q.titel} — ${Math.min(e.fortschritt, e.q.anzahl)}/${e.q.anzahl}${fertig ? '  ✓ abgeben!' : ''}`, 50, y);
      ctx.font = "19px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = '#5a4a35';
      ctx.fillText(`${e.zielText} · Abgabe: ${NPCS_NACH_ID[e.q.abgeber]?.name}`, 70, y + 28);
      y += 64;
    }
  }

  if (tafelZustand.tab === 'karte') {
    const ctx = tafelCtx;
    const mx = 92, my = 170, mb = 840, mh = 460;
    for (const z of ZONEN) {
      const x = mx + z.gx * (mb / 3), y = my + z.gz * (mh / 2);
      ctx.fillStyle = '#' + z.bodenFarbe.toString(16).padStart(6, '0');
      ctx.fillRect(x, y, mb / 3 - 4, mh / 2 - 4);
      ctx.strokeStyle = '#241a10'; ctx.lineWidth = 3;
      ctx.strokeRect(x, y, mb / 3 - 4, mh / 2 - 4);
      ctx.fillStyle = '#241a10';
      ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`${z.name}`, x + mb / 6, y + 10);
      ctx.font = "18px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Level ${z.lvl[0]}–${z.lvl[1]} · ${z.stadt}`, x + mb / 6, y + 38);
      // Stadt-Punkt
      const m = zonenMitte(z.id);
      const px = mx + (m.x + 900) / 1800 * mb, py = my + (m.z + 600) / 1200 * mh;
      ctx.fillStyle = '#241a10';
      ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
    }
    // Spieler
    const px = mx + (S.rig.position.x + 900) / 1800 * mb, py = my + (S.rig.position.z + 600) / 1200 * mh;
    ctx.fillStyle = '#e8362a';
    ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#241a10'; ctx.textAlign = 'left';
    ctx.fillText('● = Stadt   ● (rot) = Du', mx, my + mh + 14);
  }
}

function maleDialog() {
  const npc = tafelZustand.npc;
  ueberschrift(npc.def.name);
  const ctx = tafelCtx;

  if (tafelZustand.detailQuest) {
    const q = tafelZustand.detailQuest;
    ctx.fillStyle = '#241a10';
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${q.haupt ? '✦ ' : ''}${q.titel}`, 50, 110);
    const yEnde = textBlock(q.text, 50, 165, 900, 30, 25);
    textBlock(`Belohnung: ${q.xp} EP, ${q.gold} Gold${q.haupt ? ', Ausrüstung, ✦ Piczel' : ', ✦'}`, 50, yEnde + 14, 900, 28, 22, '#7a5a10');
    knopf(200, 620, 280, 70, 'Annehmen!', () => { nimmAn(q); tafelZustand.detailQuest = null; maleTafel(); }, { fuellung: '#7ad87a' });
    knopf(540, 620, 280, 70, 'Später', () => { tafelZustand.detailQuest = null; maleTafel(); });
    return;
  }

  const { anbietbar, bereit, imGang } = questsFuerNpc(npc.def.id);
  let y = 110;

  if (npc.def.rolle === 'heiler') {
    textBlock('„Komm her, ich flicke dich zusammen — kostenlos!"', 50, y, 900, 30, 26); y += 60;
    knopf(50, y, 420, 64, '➕ Voll heilen lassen', () => {
      const sp = S.spieler;
      sp.leben = sp.maxLeben; sp.mana = sp.maxMana;
      klang.heilung(); meldung('Du fühlst dich wie neugeboren!');
      maleTafel();
    }, { fuellung: '#9af59a' });
    y += 90;
  }

  if (npc.def.rolle === 'wirt') {
    textBlock('„Suchst du Verstärkung? Meine Freunde kämpfen für ein paar Münzen an deiner Seite — dann fühlen sich die Schlachten an wie in einer richtigen Gruppe!"', 50, y, 900, 28, 23); y += 95;
    for (const typ of GEFAEHRTEN_TYPEN) {
      const preis = S.spieler.lvl * 12;
      knopf(50, y, 620, 60, `${typ.rolle === 'tank' ? '🛡️' : '✨'} ${typ.name} anheuern — ${preis} Gold`, () => {
        const sp = S.spieler;
        if (S.gefaehrten.some(g => g.typ?.id === typ.id)) { meldung(`${typ.name} ist schon dabei!`); return; }
        if (sp.gold < preis) { meldung('Zu wenig Gold!'); return; }
        sp.gold -= preis;
        heuereGefaehrtenAn(typ.id);
        maleTafel();
      }, { links: true });
      y += 72;
    }
    if (S.gefaehrten.length) {
      knopf(50, y, 420, 56, 'Gefährten entlassen', () => { entlasseGefaehrten(); maleTafel(); }, { fuellung: '#e8a88a' });
      y += 80;
    }
  }

  for (const q of bereit) {
    knopf(50, y, 900, 58, `✓ Abgeben: ${q.titel}`, () => { gebeAb(q); S.spieler.statistik.quests++; maleTafel(); }, { fuellung: '#7ad87a', links: true });
    y += 70;
  }
  for (const q of anbietbar) {
    knopf(50, y, 900, 58, `${q.haupt ? '✦' : '!'} ${q.titel}`, () => { tafelZustand.detailQuest = q; maleTafel(); }, { fuellung: q.haupt ? '#ffd24a' : '#f5e8c8', links: true });
    y += 70;
  }
  for (const q of imGang) {
    knopf(50, y, 900, 50, `… ${q.titel} (noch nicht fertig)`, () => {}, { fuellung: '#e8e0c8', farbe: '#8a7a5a', links: true, schrift: 19 });
    y += 60;
  }
  if (y === 110 && npc.def.rolle === 'quest') {
    textBlock('„Im Moment habe ich nichts für dich — komm später wieder oder werde noch etwas stärker!"', 50, 130, 900, 30, 25);
  }
}

function maleHaendler() {
  const npc = tafelZustand.npc;
  ueberschrift(`💰 ${npc.def.name}`);
  const ctx = tafelCtx;
  ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = '#241a10'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`Kaufen (du hast ${S.spieler.gold} Gold):`, 40, 100);
  tafelZustand.waren.forEach((item, i) => {
    const s = SELTENHEITEN[item.seltenheit];
    knopf(40, 140 + i * 52, 460, 44, `${item.name} — ${item.wert} G`, () => {
      const sp = S.spieler;
      if (sp.gold < item.wert) { meldung('Zu wenig Gold!'); return; }
      if (!sp.gibItem({ ...item })) return;
      sp.gold -= item.wert;
      klang.muenze();
      maleTafel();
    }, { farbe: s.farbe, fuellung: '#3a2e20', links: true, schrift: 18 });
  });
  ctx.fillText('Verkaufen (40 % des Werts):', 540, 100);
  S.spieler.inventar.slice(0, 11).forEach((item, i) => {
    const s = SELTENHEITEN[item.seltenheit];
    knopf(540, 140 + i * 52, 440, 44, `${item.name} — +${Math.max(1, Math.round(item.wert * 0.4))} G`, () => {
      verkaufeItem(item);
      maleTafel();
    }, { farbe: s.farbe, fuellung: '#3a2e20', links: true, schrift: 18 });
  });
}

// Klick auf die Tafel (VR-Strahl oder Maus)
export function tafelKlick(raycaster) {
  if (!tafel || !tafel.visible) return false;
  const treffer = raycaster.intersectObject(tafel, false);
  if (!treffer.length) return false;
  const uv = treffer[0].uv;
  const x = uv.x * 1024, y = (1 - uv.y) * 760;
  for (const k of knoepfe) {
    if (x >= k.x && x <= k.x + k.b && y >= k.y && y <= k.y + k.h) {
      k.aktion();
      return true;
    }
  }
  return true; // Tafel getroffen, aber kein Knopf
}

// ---------------------------------------------------------------- Update
export function updateUI(dt) {
  updateZahlen(dt);
  if (grossSprite && S.zeit > grossBis) { S.kamera.remove(grossSprite); grossSprite = null; }
  hudTakt -= dt;
  if (hudTakt <= 0 || hudVeraltet) {
    hudTakt = 0.2;
    hudVeraltet = false;
    maleHud();
  }
  if (zielSaeule) updateZielSaeule();
}

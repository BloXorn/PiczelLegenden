// Gegner, NPCs, Gefährten, Begleiter-Tiere, Beute und Geschosse
import * as THREE from 'three';
import { S, WELT, rngFabrik, klemme, lerp } from './zustand.js';
import { GEGNER_TYPEN, NPCS, ORTE_NACH_ID, zonenMitte, zufallsItem, heiltrank, manatrank, GEFAEHRTEN_TYPEN, KLASSEN } from './daten.js';
import { teil, verschmelze, GEO, comicMesh, blobSchatten } from './bau.js';
import * as klang from './klang.js';
import { textSprite, schadensZahl, meldung } from './ui.js';
import { registriereToeten, registriereSammeln } from './quests.js';
import { hoeheAn, kollidiere } from './welt.js';

const BOSS_ORTE = {
  urgroll: 'urgroll_platz', salzzahn: 'salzzahn_platz', ferrox: 'ferrox_platz',
  grielda: 'grielda_platz', granit: 'granit_platz', scherbenkoenig: 'koenig_platz',
};

// Schwierigkeit: ausgelegt auf 3 Kämpfer (zu dritt leicht, zu zweit fordernd, allein sehr schwer)
function gruppenFaktor(l) { return 1.5 + Math.min(1.1, l * 0.08); }
export function gegnerMaxHp(def) {
  return Math.round((40 + 26 * def.lvl) * gruppenFaktor(def.lvl) * (def.boss ? 8 : def.elite ? 3 : 1));
}
function gegnerAngriff(def) {
  return Math.round((4 + 2.0 * def.lvl) * (def.boss ? 2 : def.elite ? 1.6 : 1));
}
function gegnerXp(def) {
  return Math.round(12 * def.lvl * (def.boss ? 10 : def.elite ? 3 : 1));
}

// ---------------------------------------------------------------- Figuren bauen (Comic, verschmolzen + Umriss)
// Farbverlauf hell→dunkel = weiches eingebackenes Licht (Walkabout-Look)
const _ch = new THREE.Color(), _cw = new THREE.Color(0xffffff);
function grad(farbe, anteilHell = 0.22, anteilDunkel = 0.6) {
  const hell = _ch.setHex(farbe).lerp(_cw, anteilHell).getHex();
  const dunkel = _ch.setHex(farbe).multiplyScalar(anteilDunkel).getHex();
  return [hell, dunkel];
}
function figurGeo(def) {
  const f = grad(def.farbe), f2 = grad(def.farbe2), t = [];
  const auge = (x, y, z) => {
    t.push(teil(GEO.kugel, 0xffffff, x, y, z, 0, 0, 0, 0.22));
    t.push(teil(GEO.kugel, 0x1a1208, x, y, z + 0.08, 0, 0, 0, 0.11));
  };
  if (def.form === 'vierbeiner') {
    t.push(teil(GEO.box, f, 0, 0.85, 0, 0, 0, 0, 1.3, 0.85, 0.8));
    t.push(teil(GEO.box, f2, 0, 1.15, 0.75, 0, 0, 0, 0.7, 0.6, 0.6));
    auge(-0.18, 1.25, 1.05); auge(0.18, 1.25, 1.05);
    t.push(teil(GEO.kegel, f2, -0.22, 1.55, 0.7, 0, 0, 0, 0.22, 0.3, 0.22));
    t.push(teil(GEO.kegel, f2, 0.22, 1.55, 0.7, 0, 0, 0, 0.22, 0.3, 0.22));
    for (const [lx, lz] of [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]])
      t.push(teil(GEO.zylinder, f2, lx, 0.25, lz, 0, 0, 0, 0.2, 0.6, 0.2));
    t.push(teil(GEO.zylinder, f2, 0, 1.0, -0.55, 0.9, 0, 0, 0.1, 0.5, 0.1));
  } else if (def.form === 'humanoid') {
    t.push(teil(GEO.box, f2, -0.18, 0.4, 0, 0, 0, 0, 0.26, 0.8, 0.26));
    t.push(teil(GEO.box, f2, 0.18, 0.4, 0, 0, 0, 0, 0.26, 0.8, 0.26));
    t.push(teil(GEO.kapsel, f, 0, 1.2, 0, 0, 0, 0, 0.8, 0.7, 0.6));
    t.push(teil(GEO.kugel, f2, 0, 2.0, 0, 0, 0, 0, 0.62));
    auge(-0.14, 2.06, 0.26); auge(0.14, 2.06, 0.26);
    t.push(teil(GEO.box, f, -0.52, 1.25, 0, 0, 0, 0.25, 0.22, 0.7, 0.22));
    t.push(teil(GEO.box, f, 0.52, 1.25, 0.15, -0.5, 0, -0.25, 0.22, 0.7, 0.22));
    t.push(teil(GEO.box, grad(0x7a6a5a), 0.62, 1.45, 0.55, 1.2, 0, 0, 0.1, 0.9, 0.1)); // Waffe
  } else if (def.form === 'spinne') {
    t.push(teil(GEO.kugel, f, 0, 0.7, -0.1, 0, 0, 0, 1.0, 0.8, 1.2));
    t.push(teil(GEO.kugel, f2, 0, 0.7, 0.6, 0, 0, 0, 0.55));
    auge(-0.14, 0.85, 0.85); auge(0.14, 0.85, 0.85);
    for (let i = 0; i < 4; i++) {
      const w = -0.5 + i * 0.34;
      t.push(teil(GEO.zylinder, f2, -0.6, 0.45, w, 0, 0, 0.9, 0.08, 1.0, 0.08));
      t.push(teil(GEO.zylinder, f2, 0.6, 0.45, w, 0, 0, -0.9, 0.08, 1.0, 0.08));
    }
  } else if (def.form === 'schleim') {
    t.push(teil(GEO.kugel, f, 0, 0.55, 0, 0, 0, 0, 1.3, 0.95, 1.3));
    t.push(teil(GEO.kugel, f2, 0, 0.8, 0.2, 0, 0, 0, 0.7, 0.5, 0.7));
    auge(-0.2, 0.75, 0.55); auge(0.2, 0.75, 0.55);
  } else if (def.form === 'vogel') {
    t.push(teil(GEO.kugel, f, 0, 1.5, 0, 0, 0, 0, 0.9, 0.8, 1.1));
    t.push(teil(GEO.kugel, f2, 0, 2.0, 0.5, 0, 0, 0, 0.55));
    t.push(teil(GEO.kegel, 0xe8a83a, 0, 2.0, 0.95, 1.57, 0, 0, 0.18, 0.5, 0.18));
    auge(-0.14, 2.12, 0.7); auge(0.14, 2.12, 0.7);
    t.push(teil(GEO.box, f2, -0.75, 1.6, -0.1, 0, 0, 0.5, 0.9, 0.1, 0.7));
    t.push(teil(GEO.box, f2, 0.75, 1.6, -0.1, 0, 0, -0.5, 0.9, 0.1, 0.7));
    t.push(teil(GEO.box, f2, 0, 1.45, -0.7, 0.3, 0, 0, 0.4, 0.08, 0.7));
  } else if (def.form === 'golem') {
    t.push(teil(GEO.box, f, 0, 1.3, 0, 0, 0, 0, 1.3, 1.2, 0.9));
    t.push(teil(GEO.box, f2, 0, 2.15, 0, 0, 0, 0, 0.6, 0.5, 0.55));
    auge(-0.14, 2.2, 0.28); auge(0.14, 2.2, 0.28);
    t.push(teil(GEO.box, f2, -0.85, 1.2, 0, 0, 0, 0.1, 0.4, 1.1, 0.4));
    t.push(teil(GEO.box, f2, 0.85, 1.2, 0, 0, 0, -0.1, 0.4, 1.1, 0.4));
    t.push(teil(GEO.box, f2, -0.35, 0.35, 0, 0, 0, 0, 0.45, 0.7, 0.45));
    t.push(teil(GEO.box, f2, 0.35, 0.35, 0, 0, 0, 0, 0.45, 0.7, 0.45));
  } else if (def.form === 'geist') {
    t.push(teil(GEO.kegel, f, 0, 0.9, 0, Math.PI, 0, 0, 0.9, 1.4, 0.9));
    t.push(teil(GEO.kugel, f2, 0, 1.8, 0, 0, 0, 0, 0.75));
    auge(-0.16, 1.9, 0.3); auge(0.16, 1.9, 0.3);
  } else { // schlange
    for (let i = 0; i < 4; i++)
      t.push(teil(GEO.kugel, f, 0, 0.5, -i * 0.7, 0, 0, 0, 0.9 - i * 0.12, 0.8 - i * 0.1, 0.9 - i * 0.12));
    t.push(teil(GEO.kugel, f2, 0, 0.8, 0.6, 0, 0, 0, 0.65));
    auge(-0.16, 0.95, 0.85); auge(0.16, 0.95, 0.85);
  }
  return t;
}

function baueGegnerMesh(def) {
  const gruppe = comicMesh(figurGeo(def), 0.028);
  gruppe.scale.setScalar(def.groesse);
  const halter = new THREE.Group();
  halter.add(gruppe);
  halter.add(blobSchatten(0.7 * def.groesse));
  // Namensschild + Lebensbalken
  const rang = def.boss ? '👑 ' : def.elite ? '⭐ ' : '';
  const schild = textSprite(`${rang}${def.name}  [${def.lvl}]`, { farbe: def.boss ? '#ffb74a' : def.elite ? '#c06bff' : '#ffffff' });
  schild.position.y = 2.6 * def.groesse;
  halter.add(schild);
  const balken = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.16), new THREE.MeshBasicMaterial({ color: 0x3a1a1a, depthTest: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), new THREE.MeshBasicMaterial({ color: 0xe84a3a, depthTest: false }));
  fg.position.z = 0.001;
  balken.add(bg); balken.add(fg);
  balken.position.y = 2.3 * def.groesse;
  balken.renderOrder = 5;
  halter.add(balken);
  halter.userData = { koerper: gruppe, schild, balken, balkenFg: fg };
  return halter;
}

// ---------------------------------------------------------------- Gegner
export function spawneGegner(def, x, z) {
  const halter = baueGegnerMesh(def);
  const y = hoeheAn(x, z);
  halter.position.set(x, y, z);
  S.szene.add(halter);
  const g = {
    def, lvl: def.lvl, mesh: halter,
    hp: gegnerMaxHp(def), maxHp: gegnerMaxHp(def),
    angriff: gegnerAngriff(def),
    heim: { x, z },
    zustand: 'ruhe', ziel: null,
    cdAngriff: 0, wanderZeit: 0, wanderZielX: x, wanderZielZ: z,
    verlangsamtBis: 0, wurzelBis: 0, dots: [], dotTick: 0,
    bedrohung: new Map(),
    tot: false, despawnZeit: 0, respawnIn: 0,
    animZeit: Math.random() * 10, schlagPuls: 0,
    pos: halter.position,
  };
  S.gegnerListe.push(g);
  return g;
}

export function erschaffeBevoelkerung() {
  const rng = rngFabrik(2026);
  for (const def of GEGNER_TYPEN) {
    if (def.boss) {
      const o = ORTE_NACH_ID[BOSS_ORTE[def.id]];
      spawneGegner(def, o.x, o.z - 4);
      continue;
    }
    const m = zonenMitte(def.zone);
    const anzahl = def.elite ? 2 : 8;
    for (let i = 0; i < anzahl; i++) {
      let x, z, ok = false, versuche = 0;
      while (!ok && versuche++ < 40) {
        const wink = rng() * Math.PI * 2;
        const r = 70 + rng() * 200;
        x = m.x + Math.cos(wink) * r; z = m.z + Math.sin(wink) * r;
        x = klemme(x, m.x - 285, m.x + 285); z = klemme(z, m.z - 285, m.z + 285);
        ok = hoeheAn(x, z) > WELT.wasser + 0.4;
      }
      if (ok) spawneGegner(def, x, z);
    }
  }
  // NPCs in den Städten
  for (const def of NPCS) spawneNpc(def);
}

export function schadeGegner(g, menge, opt = {}) {
  if (g.tot) return;
  menge = Math.max(1, Math.round(menge));
  g.hp -= menge;
  const quelle = opt.quelle || S.spieler?.kaempfer;
  if (quelle) g.bedrohung.set(quelle, (g.bedrohung.get(quelle) || 0) + menge * (opt.bedrohungsFaktor ?? 1));
  if (g.zustand !== 'jagd' && g.zustand !== 'rueckzug') { g.zustand = 'jagd'; }
  g.schlagPuls = 0.18;
  schadensZahl(g.pos.clone().add(new THREE.Vector3(0, 2 * g.def.groesse, 0)), `${menge}`, opt.krit ? '#ffd24a' : '#ffffff', opt.krit);
  if (g.hp <= 0) toeteGegner(g, opt);
}

function toeteGegner(g) {
  g.tot = true;
  g.hp = 0;
  g.zustand = 'tot';
  g.despawnZeit = 4;
  g.respawnIn = g.def.boss ? 240 : g.def.elite ? 100 : 45;
  klang.tod();
  // Umfallen
  g.mesh.userData.koerper.rotation.z = Math.PI / 2 * 0.9;
  g.mesh.userData.schild.visible = false;
  g.mesh.userData.balken.visible = false;
  // Erfahrung & Quests
  const sp = S.spieler;
  if (sp) {
    sp.statistik.kills++;
    const diff = klemme(1 - (sp.lvl - g.lvl) * 0.1, 0.1, 1.3);
    sp.gibXp(Math.round(gegnerXp(g.def) * diff));
    registriereToeten(g.def.id);
    registriereSammeln(g.def.id);
  }
  // Beute
  const rng = Math.random;
  legeBeute('gold', g.pos, Math.max(1, Math.round(g.lvl * (1 + rng() * 2) * (g.def.boss ? 10 : g.def.elite ? 3 : 1))));
  const itemChance = g.def.boss ? 1 : g.def.elite ? 0.8 : 0.3;
  if (rng() < itemChance) {
    const r = rngFabrik(Math.floor(rng() * 1e9));
    let item = zufallsItem(g.lvl, r);
    if (g.def.boss && item.seltenheit < 2) item.seltenheit = 2 + Math.floor(r() * 2);
    legeBeute('item', g.pos, item);
  }
  if (rng() < 0.12) legeBeute('trank', g.pos, rng() < 0.6 ? heiltrank(g.lvl) : manatrank(g.lvl));
  if (rng() < (g.def.boss ? 1 : 0.08)) legeBeute('piczel', g.pos, g.def.boss ? 5 : 1);
}

function respawneGegner(g) {
  g.tot = false;
  g.hp = g.maxHp;
  g.zustand = 'ruhe';
  g.bedrohung.clear();
  g.dots = [];
  g.pos.set(g.heim.x, hoeheAn(g.heim.x, g.heim.z), g.heim.z);
  g.mesh.userData.koerper.rotation.z = 0;
  g.mesh.userData.schild.visible = true;
  g.mesh.userData.balken.visible = true;
}

export function gegnerInUmkreis(pos, radius) {
  return S.gegnerListe.filter(g => !g.tot && g.pos.distanceTo(pos) <= radius);
}

// Alle verbündeten Kämpfer (Spieler, Gefährten, Tiere)
export function alleKaempfer() {
  const liste = [];
  if (S.spieler) liste.push(S.spieler.kaempfer);
  for (const gf of S.gefaehrten) if (gf.lebt()) liste.push(gf);
  return liste;
}

function waehleZiel(g) {
  let bestes = null, besteB = -1;
  for (const [k, b] of g.bedrohung) {
    if (!k.lebt() || k.pos.distanceTo(g.pos) > 70) continue;
    if (b > besteB) { besteB = b; bestes = k; }
  }
  return bestes;
}

// ---------------------------------------------------------------- Beute
const beuteGeos = {};
function beuteMesh(art, daten) {
  if (art === 'piczel') {
    const s = textSprite('✦', { farbe: '#4adfff', groesse: 90 });
    s.scale.multiplyScalar(1.4);
    return s;
  }
  if (!beuteGeos.gold) {
    beuteGeos.gold = comicMesh([teil(GEO.zylinder, 0xffd24a, 0, 0.15, 0, 0, 0, 0, 0.5, 0.3, 0.5)], 0.02);
    beuteGeos.trank = comicMesh([teil(GEO.kugel, 0xe84a6a, 0, 0.3, 0, 0, 0, 0, 0.5, 0.5, 0.5), teil(GEO.zylinder, 0xd8d0c0, 0, 0.62, 0, 0, 0, 0, 0.16, 0.25, 0.16)], 0.02);
    beuteGeos.item = comicMesh([teil(GEO.box, 0x9a6a3a, 0, 0.3, 0, 0, 0, 0, 0.7, 0.6, 0.5), teil(GEO.box, 0xffd24a, 0, 0.3, 0, 0, 0, 0, 0.76, 0.12, 0.56)], 0.02);
  }
  return beuteGeos[art].clone();
}

export function legeBeute(art, pos, daten) {
  const mesh = beuteMesh(art, daten);
  mesh.position.set(pos.x + (Math.random() - 0.5) * 1.6, hoeheAn(pos.x, pos.z) + 0.2, pos.z + (Math.random() - 0.5) * 1.6);
  S.szene.add(mesh);
  S.beuteListe.push({ art, daten, mesh, alter: 0 });
  if (art === 'piczel') klang.piczelKlang();
}

function sammleBeute(b) {
  const sp = S.spieler;
  if (b.art === 'gold') { sp.gibGold(b.daten); klang.muenze(); }
  else if (b.art === 'piczel') { sp.gibPiczel(b.daten); klang.muenze(); meldung(`✦ +${b.daten} Piczel!`); }
  else { if (!sp.gibItem(b.daten)) return false; klang.beuteKlang(); }
  return true;
}

// ---------------------------------------------------------------- Geschosse
const geschossGeo = new THREE.SphereGeometry(0.18, 8, 6);
export function feuerGeschoss(von, ziel, schaden, opt = {}) {
  const mesh = new THREE.Mesh(geschossGeo, new THREE.MeshBasicMaterial({ color: opt.farbe ?? 0xffe08a }));
  mesh.position.copy(von);
  if (opt.pfeil) {
    mesh.scale.set(0.5, 0.5, 3.2);
  }
  S.szene.add(mesh);
  S.projektile.push({
    mesh, ziel, schaden,
    vonSpieler: !!opt.vonSpieler, quelle: opt.quelle ?? null,
    tempo: opt.tempo ?? 22, vampir: opt.vampir ?? 0, alter: 0,
  });
}

function updateGeschosse(dt) {
  for (let i = S.projektile.length - 1; i >= 0; i--) {
    const p = S.projektile[i];
    p.alter += dt;
    const zielPos = p.vonSpieler
      ? p.ziel.pos.clone().add(new THREE.Vector3(0, 1.1 * (p.ziel.def?.groesse ?? 1), 0))
      : p.ziel.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const richtung = zielPos.sub(p.mesh.position);
    const dist = richtung.length();
    if (dist < 0.9 || p.alter > 5 || (p.vonSpieler && p.ziel.tot) || (!p.vonSpieler && !p.ziel.lebt())) {
      if (dist < 1.2) {
        if (p.vonSpieler) {
          schadeGegner(p.ziel, p.schaden, { quelle: p.quelle });
          if (p.vampir && S.spieler) S.spieler.heile(Math.round(p.schaden * p.vampir));
        } else {
          p.ziel.nimmSchaden(p.schaden);
        }
        klang.treffer();
      }
      S.szene.remove(p.mesh);
      S.projektile.splice(i, 1);
      continue;
    }
    richtung.normalize();
    p.mesh.position.addScaledVector(richtung, p.tempo * dt);
    p.mesh.lookAt(p.mesh.position.clone().add(richtung));
  }
}

// ---------------------------------------------------------------- NPCs
function npcGeo(def) {
  const t = [];
  const haut = grad(0xf0c8a0);
  const kleid = grad(def.kleidung);
  t.push(teil(GEO.box, grad(0x5a4632), -0.16, 0.4, 0, 0, 0, 0, 0.24, 0.8, 0.24));
  t.push(teil(GEO.box, grad(0x5a4632), 0.16, 0.4, 0, 0, 0, 0, 0.24, 0.8, 0.24));
  t.push(teil(GEO.kapsel, kleid, 0, 1.2, 0, 0, 0, 0, 0.78, 0.66, 0.56));
  t.push(teil(GEO.kugel, haut, 0, 2.02, 0, 0, 0, 0, 0.6));
  t.push(teil(GEO.kugel, 0xffffff, -0.13, 2.08, 0.24, 0, 0, 0, 0.2));
  t.push(teil(GEO.kugel, 0xffffff, 0.13, 2.08, 0.24, 0, 0, 0, 0.2));
  t.push(teil(GEO.kugel, 0x1a1208, -0.13, 2.08, 0.32, 0, 0, 0, 0.1));
  t.push(teil(GEO.kugel, 0x1a1208, 0.13, 2.08, 0.32, 0, 0, 0, 0.1));
  t.push(teil(GEO.box, kleid, -0.5, 1.25, 0, 0, 0, 0.3, 0.2, 0.65, 0.2));
  t.push(teil(GEO.box, kleid, 0.5, 1.25, 0, 0, 0, -0.3, 0.2, 0.65, 0.2));
  if (def.hut === 'fell') t.push(teil(GEO.kugel, grad(0x8a6a4a), 0, 2.3, 0, 0, 0, 0, 0.62, 0.4, 0.62));
  if (def.hut === 'bronze') t.push(teil(GEO.kugel, grad(0xc8862a), 0, 2.32, 0, 0, 0, 0, 0.58, 0.36, 0.58));
  if (def.hut === 'lorbeer') t.push(teil(GEO.ring, grad(0x4a8a3a), 0, 2.25, 0, Math.PI / 2.2, 0, 0, 0.62, 0.62, 0.62));
  if (def.hut === 'kapuze') t.push(teil(GEO.kegel, kleid, 0, 2.42, 0, 0, 0, 0, 0.62, 0.7, 0.62));
  if (def.hut === 'barett') { t.push(teil(GEO.kugel, grad(0x8a2a3a), 0, 2.34, 0, 0, 0, 0, 0.64, 0.3, 0.64)); t.push(teil(GEO.kugel, 0xffd24a, 0.3, 2.42, 0, 0, 0, 0, 0.12)); }
  if (def.hut === 'helm') t.push(teil(GEO.kugel, grad(0x9a9a92), 0, 2.26, 0, 0, 0, 0, 0.64, 0.5, 0.64));
  return t;
}

const ROLLEN_SYMBOL = { haendler: '💰', wirt: '🍻', heiler: '➕' };
function spawneNpc(def) {
  const m = zonenMitte(def.zone);
  const x = m.x + def.dx, z = m.z + def.dz;
  const halter = new THREE.Group();
  const koerper = comicMesh(npcGeo(def), 0.026);
  halter.add(koerper);
  halter.add(blobSchatten(0.55));
  const schild = textSprite(`${ROLLEN_SYMBOL[def.rolle] ?? ''}${def.name}`, { farbe: '#bfe8ff' });
  schild.position.y = 2.9;
  halter.add(schild);
  const marker = textSprite('!', { farbe: '#ffd24a', groesse: 120, rand: true });
  marker.position.y = 3.6;
  marker.visible = false;
  halter.add(marker);
  halter.position.set(x, hoeheAn(x, z), z);
  halter.rotation.y = Math.atan2(m.x - x, m.z - z); // zur Platzmitte schauen
  S.szene.add(halter);
  S.npcListe.push({ def, mesh: halter, pos: halter.position, marker, animZeit: Math.random() * 9, koerper });
}

// ---------------------------------------------------------------- Gefährten & Begleiter-Tiere
export function heuereGefaehrtenAn(typId) {
  const typ = GEFAEHRTEN_TYPEN.find(t => t.id === typId);
  if (!typ) return;
  if (S.gefaehrten.some(g => g.typ?.id === typId)) { meldung(`${typ.name} ist schon dabei!`); return; }
  const sp = S.spieler;
  const k = KLASSEN[typ.klasse];
  const npcDef = { kleidung: typ.farbe, hut: typ.rolle === 'tank' ? 'helm' : null };
  const halter = new THREE.Group();
  halter.add(comicMesh(npcGeo(npcDef), 0.026));
  halter.add(blobSchatten(0.55));
  const schild = textSprite(`${typ.rolle === 'tank' ? '🛡️' : '✨'} ${typ.name}`, { farbe: '#9af59a' });
  schild.position.y = 2.9;
  halter.add(schild);
  halter.position.copy(sp.kaempfer.pos);
  halter.position.x += typ.rolle === 'tank' ? 2.2 : -2.2;
  halter.position.z += 1.5;
  S.szene.add(halter);
  const maxHp = Math.round(sp.maxLeben * (typ.rolle === 'tank' ? 1.5 : 0.9));
  const gf = {
    typ, mesh: halter, pos: halter.position,
    hp: maxHp, maxHp,
    angriff: Math.round(sp.gesamtAngriff() * 0.6),
    cd: 0, tauntCd: 0, totBis: 0, animZeit: 0,
    istGefaehrte: true,
    lebt() { return this.hp > 0; },
    nimmSchaden(n) {
      this.hp -= n;
      schadensZahl(this.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), `${Math.round(n)}`, '#ff9a8a');
      if (this.hp <= 0) { this.totBis = S.zeit + 25; this.mesh.visible = false; meldung(`${this.typ.name} ist gefallen — kommt in 25 s zurück.`); }
    },
  };
  S.gefaehrten.push(gf);
  meldung(`${typ.name} schließt sich dir an!`);
  return gf;
}

export function entlasseGefaehrten() {
  for (const gf of S.gefaehrten) S.szene.remove(gf.mesh);
  S.gefaehrten.length = 0;
  meldung('Deine Gefährten verabschieden sich.');
}

export function beschwoereTier(art, dauer) {
  const sp = S.spieler;
  const farbe = art === 'wolf' ? 0x8a93a3 : 0xa85ae8;
  const def = { form: art === 'wolf' ? 'vierbeiner' : 'geist', farbe, farbe2: art === 'wolf' ? 0x5e6673 : 0x7a3ab8, groesse: art === 'wolf' ? 0.8 : 0.6 };
  const halter = new THREE.Group();
  const koerper = comicMesh(figurGeo(def), 0.026);
  koerper.scale.setScalar(def.groesse);
  halter.add(koerper);
  halter.add(blobSchatten(0.5));
  const schild = textSprite(art === 'wolf' ? '🐺 Tiergefährte' : '👾 Leerwichtel', { farbe: '#9af59a' });
  schild.position.y = 2.0;
  halter.add(schild);
  halter.position.copy(sp.kaempfer.pos);
  S.szene.add(halter);
  const maxHp = Math.round(sp.maxLeben * 0.6);
  const tier = {
    typ: { id: art, name: art === 'wolf' ? 'Tiergefährte' : 'Leerwichtel', rolle: 'schaden' },
    mesh: halter, pos: halter.position,
    hp: maxHp, maxHp, angriff: Math.round(sp.gesamtAngriff() * 0.5),
    cd: 0, tauntCd: 1e9, totBis: 0, endeZeit: S.zeit + dauer, istTier: true, animZeit: 0,
    lebt() { return this.hp > 0 && S.zeit < this.endeZeit; },
    nimmSchaden(n) { this.hp -= n; if (this.hp <= 0) this.endeZeit = 0; },
  };
  S.gefaehrten.push(tier);
}

function updateGefaehrten(dt) {
  const sp = S.spieler;
  for (let i = S.gefaehrten.length - 1; i >= 0; i--) {
    const gf = S.gefaehrten[i];
    if (gf.istTier && S.zeit > gf.endeZeit) { S.szene.remove(gf.mesh); S.gefaehrten.splice(i, 1); continue; }
    if (!gf.lebt()) {
      if (!gf.istTier && S.zeit > gf.totBis) {
        gf.hp = gf.maxHp; gf.mesh.visible = true;
        gf.pos.copy(sp.kaempfer.pos);
        gf.pos.x += gf.typ.rolle === 'tank' ? 2.2 : -2.2;
        gf.pos.z += 1.5;
        meldung(`${gf.typ.name} ist wieder da!`);
      }
      continue;
    }
    gf.animZeit += dt;
    gf.cd -= dt; gf.tauntCd -= dt;
    // Ziel: Gegner des Spielers oder Angreifer
    let ziel = S.ziel && !S.ziel.tot ? S.ziel : null;
    if (!ziel) {
      ziel = S.gegnerListe.find(g => !g.tot && g.zustand === 'jagd' && g.pos.distanceTo(sp.kaempfer.pos) < 30) ?? null;
    }
    const heiler = gf.typ.rolle === 'heiler';
    if (heiler && sp.leben < sp.maxLeben * 0.75 && gf.cd <= 0) {
      const menge = Math.round(sp.maxLeben * 0.22);
      sp.heile(menge);
      klang.heilung();
      gf.cd = 4;
    }
    const zielPos = ziel && !heiler ? ziel.pos : sp.kaempfer.pos;
    const wunschAbstand = ziel && !heiler ? 1.8 * (ziel.def?.groesse ?? 1) + 0.6 : 2.6;
    const d = gf.pos.distanceTo(zielPos);
    if (d > 64) {
      gf.pos.copy(sp.kaempfer.pos); // nachteleportieren …
      gf.pos.x += gf.typ.rolle === 'tank' ? 2.2 : -2.2;
      gf.pos.z += 1.5;
    } else if (d > wunschAbstand) {
      const richtung = zielPos.clone().sub(gf.pos).normalize();
      gf.pos.addScaledVector(richtung, Math.min(d - wunschAbstand, dt * 5.2));
      kollidiere(gf.pos, 0.4);
      gf.pos.y = hoeheAn(gf.pos.x, gf.pos.z);
      gf.mesh.rotation.y = Math.atan2(richtung.x, richtung.z);
    } else if (d < 1.1) {
      // niemals IM Spieler stehen — sanft zur Seite treten
      const weg = gf.pos.clone().sub(zielPos);
      weg.y = 0;
      if (weg.lengthSq() < 0.001) weg.set(gf.typ.rolle === 'tank' ? 1 : -1, 0, 0.5);
      weg.normalize();
      gf.pos.addScaledVector(weg, dt * 3);
      gf.pos.y = hoeheAn(gf.pos.x, gf.pos.z);
    }
    if (ziel && !heiler && d <= wunschAbstand + 0.5 && gf.cd <= 0) {
      schadeGegner(ziel, gf.angriff * (0.85 + Math.random() * 0.3), { quelle: gf, bedrohungsFaktor: gf.typ.rolle === 'tank' ? 4 : 1 });
      klang.treffer();
      gf.cd = gf.typ.rolle === 'tank' ? 1.8 : 1.4;
    }
    // Tank spottet regelmäßig alles auf sich
    if (gf.typ.rolle === 'tank' && gf.tauntCd <= 0 && ziel) {
      for (const g of gegnerInUmkreis(gf.pos, 12)) g.bedrohung.set(gf, (g.bedrohung.get(gf) || 0) + 600);
      gf.tauntCd = 6;
    }
    gf.mesh.position.y = hoeheAn(gf.pos.x, gf.pos.z) + Math.sin(gf.animZeit * 8) * 0.04;
  }
}

// ---------------------------------------------------------------- Haupt-Update
const _tmpV = new THREE.Vector3();
export function updateWesen(dt) {
  const sp = S.spieler;
  if (!sp) return;
  const spielerPos = sp.kaempfer.pos;

  for (const g of S.gegnerListe) {
    const dSpieler = g.pos.distanceTo(spielerPos);
    g.mesh.visible = dSpieler < 110;
    if (g.tot) {
      g.despawnZeit -= dt;
      if (g.despawnZeit <= 0) { g.mesh.visible = false; g.respawnIn -= dt; if (g.respawnIn <= 0) respawneGegner(g); }
      continue;
    }
    if (dSpieler > 95) continue; // weit weg: schläft
    g.animZeit += dt;
    g.cdAngriff -= dt;
    if (g.schlagPuls > 0) g.schlagPuls -= dt;

    // Schaden über Zeit (Flüche, Gift)
    g.dotTick -= dt;
    if (g.dotTick <= 0) {
      g.dotTick = 1;
      for (let i = g.dots.length - 1; i >= 0; i--) {
        const dot = g.dots[i];
        schadeGegner(g, dot.schaden, { quelle: dot.quelle });
        if (g.tot) break;
        dot.rest -= 1;
        if (dot.rest <= 0) g.dots.splice(i, 1);
      }
      if (g.tot) continue;
    }

    const verwurzelt = S.zeit < g.wurzelBis;
    const tempo = g.def.tempo * (S.zeit < g.verlangsamtBis ? 0.45 : 1);

    if (g.zustand === 'ruhe') {
      // Heilen + umherstreifen
      g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.05 * dt);
      g.wanderZeit -= dt;
      if (g.wanderZeit <= 0) {
        g.wanderZeit = 3 + Math.random() * 5;
        g.wanderZielX = g.heim.x + (Math.random() - 0.5) * 22;
        g.wanderZielZ = g.heim.z + (Math.random() - 0.5) * 22;
      }
      bewege(g, g.wanderZielX, g.wanderZielZ, tempo * 0.4, dt, 0.5);
      // Aggro?
      const aggroRadius = g.def.boss ? 16 : 11;
      for (const k of alleKaempfer()) {
        if (k.pos.distanceTo(g.pos) < aggroRadius) {
          g.zustand = 'jagd';
          g.bedrohung.set(k, (g.bedrohung.get(k) || 0) + 1);
          break;
        }
      }
    } else if (g.zustand === 'jagd') {
      const ziel = waehleZiel(g);
      if (!ziel || Math.hypot(g.pos.x - g.heim.x, g.pos.z - g.heim.z) > 75) {
        g.zustand = 'rueckzug';
        g.bedrohung.clear();
        continue;
      }
      g.ziel = ziel;
      const reichweite = g.def.fern ? 15 : 1.6 * g.def.groesse + 0.9;
      const d = g.pos.distanceTo(ziel.pos);
      if (d > reichweite && !verwurzelt) bewege(g, ziel.pos.x, ziel.pos.z, tempo, dt, reichweite);
      else {
        // zuschauen + zuschlagen
        g.mesh.rotation.y = Math.atan2(ziel.pos.x - g.pos.x, ziel.pos.z - g.pos.z);
        if (g.cdAngriff <= 0 && d <= reichweite + 0.6) {
          g.cdAngriff = 2.2;
          g.schlagPuls = 0.22;
          if (g.def.fern) {
            feuerGeschoss(g.pos.clone().add(_tmpV.set(0, 1.4 * g.def.groesse, 0)), ziel, g.angriff, { farbe: 0xb06bff, tempo: 16 });
            klang.zauber();
          } else {
            ziel.nimmSchaden(g.angriff * (0.85 + Math.random() * 0.3));
          }
        }
      }
    } else if (g.zustand === 'rueckzug') {
      g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.2 * dt);
      if (bewege(g, g.heim.x, g.heim.z, g.def.tempo * 1.4, dt, 1)) g.zustand = 'ruhe';
    }

    // Animation: fröhliches Comic-Wackeln
    const k = g.mesh.userData.koerper;
    const puls = g.schlagPuls > 0 ? 1.12 : 1;
    k.scale.setScalar(g.def.groesse * puls);
    k.position.y = Math.abs(Math.sin(g.animZeit * 6)) * 0.08 * (g.zustand === 'jagd' ? 2 : 1);
    if (g.def.form === 'geist') k.position.y = 0.3 + Math.sin(g.animZeit * 2.2) * 0.15;
    if (g.def.form === 'schleim') k.scale.y = g.def.groesse * (1 + Math.sin(g.animZeit * 7) * 0.12);
    // Lebensbalken & Schild zur Kamera drehen
    if (dSpieler < 45) {
      g.mesh.userData.balken.visible = true;
      g.mesh.userData.balkenFg.scale.x = Math.max(0.001, g.hp / g.maxHp);
      g.mesh.userData.balken.lookAt(S.kamera.getWorldPosition(_tmpV));
    } else {
      g.mesh.userData.balken.visible = false;
    }
  }

  // NPCs wippen freundlich
  for (const n of S.npcListe) {
    const d = n.pos.distanceTo(spielerPos);
    n.mesh.visible = d < 120;
    if (d < 60) {
      n.animZeit += dt;
      n.koerper.position.y = Math.sin(n.animZeit * 1.8) * 0.05;
      if (d < 6) n.mesh.rotation.y = Math.atan2(spielerPos.x - n.pos.x, spielerPos.z - n.pos.z);
    }
  }

  // Beute einsammeln & wegräumen
  for (let i = S.beuteListe.length - 1; i >= 0; i--) {
    const b = S.beuteListe[i];
    b.alter += dt;
    b.mesh.rotation.y += dt * 2;
    b.mesh.position.y = hoeheAn(b.mesh.position.x, b.mesh.position.z) + 0.25 + Math.sin(b.alter * 3) * 0.08;
    const d = b.mesh.position.distanceTo(spielerPos);
    if (d < 1.8 && b.alter > 0.4) {
      if (sammleBeute(b)) { S.szene.remove(b.mesh); S.beuteListe.splice(i, 1); continue; }
    }
    if (b.alter > 120) { S.szene.remove(b.mesh); S.beuteListe.splice(i, 1); }
  }

  updateGeschosse(dt);
  updateGefaehrten(dt);
}

function bewege(g, zx, zz, tempo, dt, stopAbstand) {
  const dx = zx - g.pos.x, dz = zz - g.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopAbstand) return true;
  const schritt = Math.min(tempo * dt, d);
  g.pos.x += dx / d * schritt;
  g.pos.z += dz / d * schritt;
  kollidiere(g.pos, 0.5);
  const h = hoeheAn(g.pos.x, g.pos.z);
  if (h < WELT.wasser + 0.2) { g.pos.x -= dx / d * schritt; g.pos.z -= dz / d * schritt; return false; }
  g.pos.y = h;
  g.mesh.rotation.y = Math.atan2(dx, dz);
  return false;
}

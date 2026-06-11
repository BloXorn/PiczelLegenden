// Quest-Verwaltung: annehmen, Fortschritt zählen, abgeben, Marker über NPCs
import { S } from './zustand.js';
import { QUESTS, QUESTS_NACH_ID, GEGNER_NACH_ID, ORTE_NACH_ID, NPCS_NACH_ID, zonenMitte, zufallsItem } from './daten.js';
import { rngFabrik } from './zustand.js';
import { meldung, textSprite } from './ui.js';
import * as klang from './klang.js';

export const questStand = {
  aktiv: {},        // id -> Fortschritt (Zahl)
  fertig: new Set(),
};

// Vorgänger-Kette berechnen
const vorgaenger = {};
for (const q of QUESTS) if (q.naechste) vorgaenger[q.naechste] = q.id;

export function istVerfuegbar(q) {
  if (questStand.fertig.has(q.id) || q.id in questStand.aktiv) return false;
  const sp = S.spieler;
  if (!sp) return false;
  if (vorgaenger[q.id] && !questStand.fertig.has(vorgaenger[q.id])) return false;
  if (sp.lvl < q.lvl - 3) return false;
  return true;
}

export function istBereit(q) {
  return (questStand.aktiv[q.id] ?? -1) >= q.anzahl;
}

export function questsFuerNpc(npcId) {
  const anbietbar = [], bereit = [], imGang = [];
  for (const q of QUESTS) {
    if (q.abgeber === npcId && q.id in questStand.aktiv) {
      if (istBereit(q)) { bereit.push(q); continue; }
      if (q.geber === npcId) imGang.push(q);
      continue;
    }
    if (q.geber === npcId && istVerfuegbar(q)) anbietbar.push(q);
  }
  return { anbietbar, bereit, imGang };
}

export function nimmAn(q) {
  questStand.aktiv[q.id] = 0;
  meldung(`📜 Quest angenommen: ${q.titel}`);
  klang.beuteKlang();
}

export function gebeAb(q) {
  if (!istBereit(q)) return false;
  delete questStand.aktiv[q.id];
  questStand.fertig.add(q.id);
  const sp = S.spieler;
  sp.gibXp(q.xp);
  sp.gibGold(q.gold);
  // ✦-Piczel als Firmen-Belohnung: Hauptquest +3, Boss-Quest +10
  const piczel = q.haupt ? (GEGNER_NACH_ID[q.ziel]?.boss ? 10 : 3) : 1;
  sp.gibPiczel(piczel);
  if (q.haupt) {
    const rng = rngFabrik(q.id.length * 1000 + q.lvl);
    const item = zufallsItem(q.lvl + 1, rng, sp.klasseId);
    if (item.seltenheit < 1) item.seltenheit = 1;
    sp.gibItem(item);
    meldung(`🎁 Belohnung: ${item.name}`);
  }
  meldung(`✅ Quest abgeschlossen: ${q.titel}  (+${q.xp} EP, +${q.gold} Gold, +${piczel} ✦)`);
  klang.questFertig();
  klang.piczelKlang();
  if (q.naechste) {
    const n = QUESTS_NACH_ID[q.naechste];
    const geber = NPCS_NACH_ID[n.geber];
    if (geber) meldung(`➡️ Nächste Aufgabe wartet bei ${geber.name}.`);
  }
  return true;
}

export function registriereToeten(mobId) {
  for (const id of Object.keys(questStand.aktiv)) {
    const q = QUESTS_NACH_ID[id];
    if (q.art !== 'toeten' || q.ziel !== mobId) continue;
    if (questStand.aktiv[id] >= q.anzahl) continue;
    questStand.aktiv[id]++;
    meldung(`⚔️ ${q.titel}: ${questStand.aktiv[id]}/${q.anzahl}`);
    if (questStand.aktiv[id] >= q.anzahl) hinweisAbgeber(q);
  }
}

export function registriereSammeln(mobId) {
  for (const id of Object.keys(questStand.aktiv)) {
    const q = QUESTS_NACH_ID[id];
    if (q.art !== 'sammeln' || q.ziel !== mobId) continue;
    if (questStand.aktiv[id] >= q.anzahl) continue;
    if (Math.random() > 0.72) continue; // nicht jedes Tier trägt den Gegenstand
    questStand.aktiv[id]++;
    const drop = GEGNER_NACH_ID[mobId]?.drop ?? 'Beweisstück';
    meldung(`📦 ${drop}: ${questStand.aktiv[id]}/${q.anzahl}`);
    klang.beuteKlang();
    if (questStand.aktiv[id] >= q.anzahl) hinweisAbgeber(q);
  }
}

function hinweisAbgeber(q) {
  const npc = NPCS_NACH_ID[q.abgeber];
  meldung(`✨ Fertig! Kehre zurück zu ${npc?.name ?? 'deinem Auftraggeber'}.`);
}

export function questZielPos(q) {
  if (q.art === 'besuchen') {
    if (q.ziel.startsWith('stadt')) {
      const m = zonenMitte(parseInt(q.ziel.slice(5)));
      return { x: m.x, z: m.z, r: 45 };
    }
    const o = ORTE_NACH_ID[q.ziel];
    return { x: o.x, z: o.z, r: 18 };
  }
  return null;
}

let pruefTakt = 0;
export function updateQuests(dt) {
  pruefTakt -= dt;
  if (pruefTakt > 0) return;
  pruefTakt = 0.6;
  const sp = S.spieler;
  if (!sp) return;
  // Besuchs-Quests prüfen
  for (const id of Object.keys(questStand.aktiv)) {
    const q = QUESTS_NACH_ID[id];
    if (q.art !== 'besuchen' || questStand.aktiv[id] >= q.anzahl) continue;
    const ziel = questZielPos(q);
    if (Math.hypot(sp.kaempfer.pos.x - ziel.x, sp.kaempfer.pos.z - ziel.z) < ziel.r) {
      questStand.aktiv[id] = q.anzahl;
      meldung(`🗺️ Ziel erreicht: ${q.titel}`);
      klang.questFertig();
      hinweisAbgeber(q);
    }
  }
  // Marker über NPC-Köpfen
  for (const n of S.npcListe) {
    const { anbietbar, bereit } = questsFuerNpc(n.def.id);
    if (!n.markerFrage) {
      n.markerFrage = textSprite('?', { farbe: '#4adfff', groesse: 120, rand: true });
      n.markerFrage.position.y = 3.6;
      n.markerFrage.visible = false;
      n.mesh.add(n.markerFrage);
    }
    n.markerFrage.visible = bereit.length > 0;
    n.marker.visible = bereit.length === 0 && anbietbar.length > 0;
    const wippe = 3.5 + Math.sin(S.zeit * 2.5) * 0.15;
    n.marker.position.y = wippe;
    n.markerFrage.position.y = wippe;
  }
}

// Für die Quest-Anzeige im Menü/HUD
export function aktiveQuestListe() {
  return Object.keys(questStand.aktiv).map(id => {
    const q = QUESTS_NACH_ID[id];
    let zielText;
    if (q.art === 'toeten') zielText = `${GEGNER_NACH_ID[q.ziel]?.name ?? q.ziel} besiegen`;
    else if (q.art === 'sammeln') zielText = `${GEGNER_NACH_ID[q.ziel]?.drop ?? 'Gegenstand'} sammeln`;
    else zielText = q.ziel.startsWith('stadt') ? `Reise nach ${['Steinfurt','Bronzhafen','Aurelia','Falkenfels','Silberzinne','Neulicht'][parseInt(q.ziel.slice(5))]}` : `Besuche: ${ORTE_NACH_ID[q.ziel]?.name}`;
    return { q, fortschritt: questStand.aktiv[id], zielText };
  });
}

export function exportiereQuests() {
  return { aktiv: { ...questStand.aktiv }, fertig: [...questStand.fertig] };
}
export function ladeQuests(d) {
  if (!d) return;
  questStand.aktiv = d.aktiv ?? {};
  questStand.fertig = new Set(d.fertig ?? []);
}

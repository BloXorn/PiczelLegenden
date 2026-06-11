// Spielstand sichern & laden (localStorage, automatisch alle 10 s)
import { S } from './zustand.js';
import { exportiereSpieler } from './spieler.js';
import { exportiereQuests, ladeQuests } from './quests.js';

const SCHLUESSEL = 'piczelLegendenSpielstand';

export function speichere() {
  if (!S.spieler) return;
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify({
      version: 1,
      spieler: exportiereSpieler(),
      quests: exportiereQuests(),
      gespeichert: Date.now(),
    }));
  } catch (e) { /* voller Speicher o. ä. — nie das Spiel stoppen */ }
}

export function lade() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh ? JSON.parse(roh) : null;
  } catch (e) { return null; }
}

export function loesche() {
  localStorage.removeItem(SCHLUESSEL);
}

export function wendeQuestStandAn(stand) {
  if (stand?.quests) ladeQuests(stand.quests);
}

let takt = 0;
export function updateSpeicher(dt) {
  takt += dt;
  if (takt > 10) { takt = 0; speichere(); }
}

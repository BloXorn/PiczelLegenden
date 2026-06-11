// Gemeinsamer Spielzustand — alle Module greifen hierauf zu
export const S = {
  szene: null, kamera: null, rig: null, renderer: null,
  spieler: null,          // Spieler-Objekt (spieler.js)
  gegnerListe: [],        // alle Gegner (wesen.js)
  npcListe: [],           // alle NPCs
  gefaehrten: [],         // angeheuerte Gefährten
  beuteListe: [],         // herumliegende Beute/✦
  projektile: [],         // fliegende Geschosse
  modus: 'desktop',       // 'vr' oder 'desktop'
  menueOffen: false,
  dialogOffen: false,
  ziel: null,             // aktuell anvisierter Gegner
  zeit: 0,
  controller: [null, null],   // [links, rechts]
  hand: { links: null, rechts: null },
};

// Welt-Maße: 3x2 Zonen-Raster, jede Zone 600x600 m
export const WELT = {
  breite: 1800, tiefe: 1200, zone: 600,
  wasser: 2.0,
};

// Deterministischer Zufall (mulberry32)
export function rngFabrik(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function klemme(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function glatt(t) { t = klemme(t, 0, 1); return t * t * (3 - 2 * t); }

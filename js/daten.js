// Alle Spieldaten: Zonen, Klassen, Gegner, NPCs, Quests, Gegenstände, Story

// ----------------------------------------------------------------- ZONEN
// 3x2-Raster, jede Zone 600x600 m. Mittelpunkt = Stadt.
export const ZONEN = [
  { id: 0, name: 'Hainwald',       lvl: [1, 10],  gx: 0, gz: 0, biom: 'wald',   era: 'steinzeit',   stadt: 'Steinfurt',
    bodenFarbe: 0x6fae4e, baumFarbe: 0x3e8e3a, nebel: 0xbfe6ff,
    text: 'Ein uralter Wald, in dem die Zeit in der Steinzeit stehen blieb.' },
  { id: 1, name: 'Salzküste',      lvl: [11, 20], gx: 1, gz: 0, biom: 'kueste', era: 'bronzezeit',  stadt: 'Bronzhafen',
    bodenFarbe: 0x8fbf62, baumFarbe: 0x4da354, nebel: 0xcdeeff,
    text: 'Sandstrände und Klippen — hier glänzt das Zeitalter der Bronze.' },
  { id: 2, name: 'Goldene Steppe', lvl: [21, 30], gx: 2, gz: 0, biom: 'steppe', era: 'antike',      stadt: 'Aurelia',
    bodenFarbe: 0xc9b35a, baumFarbe: 0x7a9a3d, nebel: 0xf2e3b8,
    text: 'Weites Grasland unter goldener Sonne — die Antike lebt.' },
  { id: 3, name: 'Dornenmoor',     lvl: [31, 40], gx: 2, gz: 1, biom: 'moor',   era: 'mittelalter', stadt: 'Falkenfels',
    bodenFarbe: 0x5b7a45, baumFarbe: 0x4a5d36, nebel: 0xa9b8a0,
    text: 'Dunkles Moor voller Irrlichter — bewacht von einer Ritterburg.' },
  { id: 4, name: 'Graufelsen',     lvl: [41, 50], gx: 1, gz: 1, biom: 'berge',  era: 'renaissance', stadt: 'Silberzinne',
    bodenFarbe: 0x7d8a6e, baumFarbe: 0x3a6b44, nebel: 0xc4cdd6,
    text: 'Schroffe Gipfel und Silberminen — Kunst und Erfindergeist blühen.' },
  { id: 5, name: 'Frostgipfel',    lvl: [51, 60], gx: 0, gz: 1, biom: 'frost',  era: 'moderne',     stadt: 'Neulicht',
    bodenFarbe: 0xe8f0f4, baumFarbe: 0x3d7a55, nebel: 0xdfeaf2,
    text: 'Ewiges Eis um den Thron des Scherbenkönigs — und die modernste Stadt der Welt.' },
];

export function zonenMitte(z) {
  const zone = ZONEN[z];
  return { x: (zone.gx + 0.5) * 600 - 900, z: (zone.gz + 0.5) * 600 - 600 };
}

// ----------------------------------------------------------------- STORY
export const STORY = {
  titel: 'PICZEL Legenden — Die zersplitterte Welt',
  einleitung:
    'Vor langer Zeit wachte der Herz-Stern über die Welt Piczelia und hielt die Zeit zusammen. ' +
    'Doch der Scherbenkönig zerschlug den Stern aus Neid — seine ✦-Splitter regneten über das Land, ' +
    'und die Zeit zerriss: Jedes Gebiet blieb in einem anderen Zeitalter hängen. ' +
    'Du bist eine Splitterwanderin oder ein Splitterwanderer — du kannst zwischen den Zeitaltern reisen. ' +
    'Sammle die sechs Herz-Fragmente, vereine sie und stelle dich dem Scherbenkönig auf dem Frostgipfel!',
};

// ----------------------------------------------------------------- KLASSEN
export const KLASSEN = {
  krieger: {
    name: 'Krieger', rolle: 'Tank', symbol: '🛡️', farbe: 0xc0392b, ruestung: 'platte', waffe: 'schwert',
    text: 'Hält jede Menge aus und beschützt die Gruppe.',
    basis: { leben: 180, mana: 40, angriff: 11, abwehr: 10 },
    proLevel: { leben: 16, mana: 2, angriff: 1.7, abwehr: 1.4 },
    faehigkeiten: [
      { id: 'heldenhieb',  name: 'Heldenhieb',     cd: 6,  kosten: 10, art: 'nahkampf', faktor: 2.4, text: 'Ein gewaltiger Hieb (240 % Schaden).' },
      { id: 'schildwall',  name: 'Schildwall',     cd: 20, kosten: 12, art: 'buff', buff: 'schild', dauer: 6, text: '6 s lang 60 % weniger Schaden.' },
      { id: 'spott',       name: 'Spott',          cd: 12, kosten: 8,  art: 'spott', radius: 12, text: 'Alle Gegner in der Nähe greifen DICH an.' },
      { id: 'donnerschlag', name: 'Donnerschlag',  cd: 10, kosten: 15, art: 'aoe', faktor: 1.5, radius: 6, verlangsamung: 3, text: 'Trifft alles im Umkreis und verlangsamt.' },
    ],
  },
  priester: {
    name: 'Priester', rolle: 'Heiler', symbol: '✨', farbe: 0xf1c40f, ruestung: 'stoff', waffe: 'kolben',
    text: 'Heilt sich und seine Gefährten mit heiligem Licht.',
    basis: { leben: 120, mana: 120, angriff: 8, abwehr: 4 },
    proLevel: { leben: 10, mana: 9, angriff: 1.3, abwehr: 0.7 },
    faehigkeiten: [
      { id: 'heiligeslicht', name: 'Heiliges Licht',    cd: 5,  kosten: 18, art: 'heilung', anteil: 0.32, text: 'Heilt 32 % deiner Lebenspunkte.' },
      { id: 'strafe',        name: 'Strafendes Licht',  cd: 4,  kosten: 12, art: 'geschoss', faktor: 1.7, farbe: 0xfff2a8, text: 'Lichtblitz (170 % Schaden).' },
      { id: 'erneuerung',    name: 'Erneuerung',        cd: 10, kosten: 15, art: 'hot', anteil: 0.05, dauer: 10, text: 'Heilt 10 s lang jede Sekunde.' },
      { id: 'heilkreis',     name: 'Kreis der Heilung', cd: 18, kosten: 30, art: 'gruppenheilung', anteil: 0.25, radius: 10, text: 'Heilt dich UND alle Gefährten.' },
    ],
  },
  magier: {
    name: 'Magier', rolle: 'Schaden', symbol: '🔥', farbe: 0x2980d9, ruestung: 'stoff', waffe: 'stab',
    text: 'Wirft Feuerbälle und friert Feinde ein.',
    basis: { leben: 100, mana: 140, angriff: 13, abwehr: 3 },
    proLevel: { leben: 8, mana: 11, angriff: 2.1, abwehr: 0.5 },
    faehigkeiten: [
      { id: 'feuerball',  name: 'Feuerball',  cd: 5,  kosten: 16, art: 'geschoss', faktor: 2.2, farbe: 0xff7a2a, text: 'Großer Feuerball (220 % Schaden).' },
      { id: 'frostnova',  name: 'Frostnova',  cd: 14, kosten: 22, art: 'aoe', faktor: 1.0, radius: 7, wurzel: 3, text: 'Friert alle Gegner im Umkreis 3 s ein.' },
      { id: 'arkanstoss', name: 'Arkanstoß',  cd: 1.5, kosten: 7, art: 'geschoss', faktor: 1.1, farbe: 0xc06bff, text: 'Schneller Magie-Stoß.' },
      { id: 'blinzeln',   name: 'Blinzeln',   cd: 15, kosten: 12, art: 'teleport', weite: 9, text: 'Teleportiert dich 9 m nach vorn.' },
    ],
  },
  jaeger: {
    name: 'Jäger', rolle: 'Schaden', symbol: '🏹', farbe: 0x27ae60, ruestung: 'leder', waffe: 'bogen',
    text: 'Trifft aus der Ferne und ruft einen treuen Wolf.',
    basis: { leben: 130, mana: 90, angriff: 12, abwehr: 5 },
    proLevel: { leben: 11, mana: 6, angriff: 2.0, abwehr: 0.8 },
    faehigkeiten: [
      { id: 'gezielt',   name: 'Gezielter Schuss', cd: 6,  kosten: 14, art: 'geschoss', faktor: 2.4, farbe: 0xd8f5a0, text: 'Präziser Pfeil (240 % Schaden).' },
      { id: 'mehrfach',  name: 'Mehrfachschuss',   cd: 10, kosten: 18, art: 'faecher', faktor: 1.1, anzahl: 3, farbe: 0xd8f5a0, text: 'Drei Pfeile gleichzeitig.' },
      { id: 'falle',     name: 'Eisfalle',         cd: 16, kosten: 12, art: 'aoe', faktor: 0.4, radius: 5, wurzel: 4, text: 'Fesselt Gegner vor dir 4 s lang.' },
      { id: 'wolf',      name: 'Tiergefährte',     cd: 30, kosten: 25, art: 'begleiter', dauer: 45, text: 'Ruft 45 s einen Kampf-Wolf.' },
    ],
  },
  hexenmeister: {
    name: 'Hexenmeister', rolle: 'Schaden', symbol: '💀', farbe: 0x8e44ad, ruestung: 'stoff', waffe: 'stab',
    text: 'Flüche, Schattenblitze und ein kleiner Leerwichtel.',
    basis: { leben: 110, mana: 130, angriff: 12, abwehr: 4 },
    proLevel: { leben: 9, mana: 10, angriff: 2.0, abwehr: 0.6 },
    faehigkeiten: [
      { id: 'schattenblitz', name: 'Schattenblitz',  cd: 4,  kosten: 13, art: 'geschoss', faktor: 1.9, farbe: 0x9b59f6, text: 'Blitz aus Schatten (190 % Schaden).' },
      { id: 'fluch',         name: 'Fluch der Pein', cd: 8,  kosten: 15, art: 'dot', faktor: 0.5, dauer: 12, text: 'Schaden über 12 Sekunden.' },
      { id: 'lebensentzug',  name: 'Lebensentzug',   cd: 6,  kosten: 14, art: 'geschoss', faktor: 1.3, vampir: 0.6, farbe: 0x52e08a, text: 'Schadet und heilt dich.' },
      { id: 'wichtel',       name: 'Leerwichtel',    cd: 30, kosten: 25, art: 'begleiter', dauer: 60, text: 'Ruft 60 s einen Leerwichtel.' },
    ],
  },
  schurke: {
    name: 'Schurke', rolle: 'Schaden', symbol: '🗡️', farbe: 0x95a5a6, ruestung: 'leder', waffe: 'dolch',
    text: 'Schnell, giftig und immer im Rücken des Feindes.',
    basis: { leben: 125, mana: 100, angriff: 13, abwehr: 5 },
    proLevel: { leben: 10, mana: 7, angriff: 2.1, abwehr: 0.8 },
    faehigkeiten: [
      { id: 'meucheln',       name: 'Meucheln',        cd: 6,  kosten: 14, art: 'nahkampf', faktor: 2.2, rueckenFaktor: 3.2, text: 'Von hinten 320 % Schaden!' },
      { id: 'giftklinge',     name: 'Giftklinge',      cd: 10, kosten: 12, art: 'dot', faktor: 0.45, dauer: 10, text: 'Vergiftet das Ziel 10 s lang.' },
      { id: 'sprint',         name: 'Sprint',          cd: 18, kosten: 10, art: 'buff', buff: 'tempo', dauer: 6, text: '6 s lang doppelt so schnell.' },
      { id: 'schattenschritt', name: 'Schattenschritt', cd: 16, kosten: 15, art: 'schattenschritt', text: 'Springt hinter den Gegner — nächster Schlag kritisch.' },
    ],
  },
};

// ----------------------------------------------------------------- GEGNER
// Schwierigkeit ist für 3 Spieler/Gefährten ausgelegt: zu dritt leicht,
// zu zweit fordernd, allein sehr schwer (siehe gruppenFaktor in wesen.js).
const G = (id, name, zone, lvl, form, farbe, farbe2, groesse, tempo, extra = {}) =>
  ({ id, name, zone, lvl, form, farbe, farbe2, groesse, tempo, ...extra });

export const GEGNER_TYPEN = [
  // Zone 0 — Hainwald (1-10)
  G('wildschwein', 'Wildschwein', 0, 1, 'vierbeiner', 0x8a5a33, 0x5e3a1e, 0.9, 2.4, { drop: 'Borstenfell' }),
  G('jungwolf', 'Jungwolf', 0, 2, 'vierbeiner', 0x9aa1ad, 0x6c7280, 0.85, 3.2, { drop: 'Wolfszahn' }),
  G('waldspinne', 'Waldspinne', 0, 4, 'spinne', 0x4a6b2f, 0x2f4a1c, 0.8, 2.8, { drop: 'Spinnenseide' }),
  G('wurzelknecht', 'Wurzelknecht', 0, 5, 'golem', 0x6b4a2a, 0x4a7a3a, 1.1, 1.8, { drop: 'Knorrige Wurzel' }),
  G('hoehlenfledermaus', 'Höhlenfledermaus', 0, 7, 'vogel', 0x554a66, 0x3a3247, 0.7, 3.4, { drop: 'Flughaut' }),
  G('banditenlehrling', 'Banditen-Lehrling', 0, 8, 'humanoid', 0x7a6a4a, 0xc9a06a, 1.0, 2.6, { drop: 'Gestohlener Beutel' }),
  G('grollbaer', 'Grollbär', 0, 9, 'vierbeiner', 0x5e4630, 0x3e2e1e, 1.5, 2.6, { elite: true, drop: 'Bärenkralle' }),
  G('urgroll', 'Urgroll, der alte Eber', 0, 10, 'vierbeiner', 0x6e4226, 0x3e2412, 2.2, 2.8, { boss: true, drop: 'Herzfragment der Wälder' }),
  // Zone 1 — Salzküste (11-20)
  G('strandkrabbe', 'Strandkrabbe', 1, 11, 'spinne', 0xe07a4a, 0xa84e26, 0.8, 2.2, { drop: 'Krabbenschere' }),
  G('salzschleim', 'Salzschleim', 1, 12, 'schleim', 0x7fd8d8, 0x4aa8a8, 0.9, 1.8, { drop: 'Salzkristall' }),
  G('moewengreif', 'Möwengreif', 1, 14, 'vogel', 0xe8e8e8, 0xb8b8b8, 0.9, 3.6, { drop: 'Greifenfeder' }),
  G('strandraeuber', 'Strandräuber', 1, 15, 'humanoid', 0x4a6a8a, 0xc9a06a, 1.0, 2.8, { drop: 'Bronzedolch' }),
  G('tiefenfischer', 'Tiefenfischer', 1, 17, 'humanoid', 0x4a8a7a, 0x6ab8a8, 1.05, 2.4, { fern: true, drop: 'Schuppenpanzer' }),
  G('muschelgolem', 'Muschelgolem', 1, 18, 'golem', 0xd8c8a8, 0x8a7a5a, 1.3, 1.6, { drop: 'Perlmutt' }),
  G('riffschlange', 'Riffschlange', 1, 19, 'schlange', 0x3a8a6a, 0x2a5a4a, 1.2, 3.0, { elite: true, drop: 'Riffschuppe' }),
  G('salzzahn', 'Meereswyrm Salzzahn', 1, 20, 'schlange', 0x2a7a8a, 0x1a4a5a, 2.4, 3.0, { boss: true, drop: 'Herzfragment der See' }),
  // Zone 2 — Goldene Steppe (21-30)
  G('steppenloewe', 'Steppenlöwe', 2, 21, 'vierbeiner', 0xd8a84a, 0xa87a2a, 1.1, 3.4, { drop: 'Löwenmähne' }),
  G('aasgeier', 'Aasgeier', 2, 22, 'vogel', 0x6a5a4a, 0x4a3a2a, 0.9, 3.6, { drop: 'Geierfeder' }),
  G('staubskorpion', 'Staubskorpion', 2, 24, 'spinne', 0xc8a86a, 0x8a6a3a, 0.9, 2.6, { drop: 'Skorpionstachel' }),
  G('messinglegionaer', 'Messing-Legionär', 2, 25, 'humanoid', 0xc8a832, 0x8a6a1a, 1.05, 2.6, { drop: 'Legionsabzeichen' }),
  G('steppenschamane', 'Steppen-Schamane', 2, 27, 'humanoid', 0xa85a3a, 0xd8b87a, 1.0, 2.2, { fern: true, drop: 'Geisterstaub' }),
  G('dornenlaeufer', 'Dornenläufer', 2, 28, 'vierbeiner', 0x7a8a3a, 0x4a5a1a, 1.0, 3.8, { drop: 'Dornenhuf' }),
  G('bronzewaechter', 'Bronzewächter', 2, 29, 'golem', 0xb8862a, 0x6a4a12, 1.5, 1.8, { elite: true, drop: 'Bronzekern' }),
  G('ferrox', 'Zenturio Ferrox', 2, 30, 'golem', 0xd89a2a, 0x8a5a0a, 2.2, 2.2, { boss: true, drop: 'Herzfragment der Sonne' }),
  // Zone 3 — Dornenmoor (31-40)
  G('moorlurch', 'Moorlurch', 3, 31, 'schleim', 0x5a7a3a, 0x3a5a2a, 1.0, 2.0, { drop: 'Lurchschleim' }),
  G('giftpilzling', 'Giftpilzling', 3, 32, 'schleim', 0xa84a8a, 0xe8a8d8, 0.7, 2.2, { drop: 'Giftspore' }),
  G('sumpfschleicher', 'Sumpfschleicher', 3, 34, 'vierbeiner', 0x4a5a3a, 0x2a3a22, 1.1, 3.0, { drop: 'Sumpfkralle' }),
  G('irrlicht', 'Irrlicht', 3, 35, 'geist', 0x8ae8e8, 0x4ab8d8, 0.7, 2.8, { fern: true, drop: 'Lichtfunke' }),
  G('hexenrabe', 'Hexenrabe', 3, 37, 'vogel', 0x2a2a3a, 0x1a1a26, 0.85, 3.6, { drop: 'Rabenfeder' }),
  G('moorritter', 'Verlorener Moorritter', 3, 38, 'humanoid', 0x5a6a7a, 0x3a4a55, 1.1, 2.4, { drop: 'Rostiges Wappen' }),
  G('dornenbestie', 'Dornenbestie', 3, 39, 'vierbeiner', 0x4a6a2a, 0x6a8a3a, 1.6, 2.8, { elite: true, drop: 'Dornenherz' }),
  G('grielda', 'Moorhexe Grielda', 3, 40, 'humanoid', 0x5a8a5a, 0x8a5aa8, 1.6, 2.4, { boss: true, fern: true, drop: 'Herzfragment des Moores' }),
  // Zone 4 — Graufelsen (41-50)
  G('steinadler', 'Steinadler', 4, 41, 'vogel', 0x8a7a5a, 0x5a4a35, 1.0, 3.8, { drop: 'Adlerfeder' }),
  G('silberdieb', 'Silberdieb', 4, 42, 'humanoid', 0x6a6a7a, 0xc9a06a, 1.0, 3.0, { drop: 'Silberbarren' }),
  G('kristallspinne', 'Kristallspinne', 4, 44, 'spinne', 0xa8d8e8, 0x6aa8c8, 0.95, 2.8, { drop: 'Kristallsplitter' }),
  G('felsgolem', 'Felsgolem', 4, 45, 'golem', 0x7a7a72, 0x5a5a52, 1.4, 1.6, { drop: 'Granitbrocken' }),
  G('lawinengeist', 'Lawinengeist', 4, 47, 'geist', 0xd8e8f0, 0xa8c8d8, 1.0, 2.6, { fern: true, drop: 'Frostessenz' }),
  G('bergtroll', 'Bergtroll', 4, 48, 'humanoid', 0x6a8a6a, 0x4a6a4a, 1.5, 2.2, { drop: 'Trollzahn' }),
  G('grollhorn', 'Grollhorn-Yak', 4, 49, 'vierbeiner', 0x5a4a3a, 0x3a2e22, 1.7, 2.6, { elite: true, drop: 'Grollhorn' }),
  G('granit', 'Steinvater Granit', 4, 50, 'golem', 0x8a8a82, 0x55554d, 2.4, 1.8, { boss: true, drop: 'Herzfragment der Berge' }),
  // Zone 5 — Frostgipfel (51-60)
  G('eiswolf', 'Eiswolf', 5, 51, 'vierbeiner', 0xc8d8e8, 0x8aa8c8, 1.0, 3.4, { drop: 'Eiszahn' }),
  G('splitterling', 'Splitterling', 5, 52, 'geist', 0x8ad8f8, 0x4aa8e8, 0.7, 2.8, { drop: 'Sternensplitter' }),
  G('schneetatze', 'Schneetatze', 5, 54, 'vierbeiner', 0xe8e8e8, 0xb8c8d8, 1.4, 2.8, { drop: 'Schneefell' }),
  G('frostgeist', 'Frostgeist', 5, 55, 'geist', 0xa8e8f8, 0x5ab8e8, 0.9, 2.6, { fern: true, drop: 'Frosthauch' }),
  G('scherbenritter', 'Scherbenritter', 5, 57, 'humanoid', 0x4a5a7a, 0x8ad8f8, 1.15, 2.6, { drop: 'Scherbenklinge' }),
  G('eisgolem', 'Eisgolem', 5, 58, 'golem', 0x9ad8e8, 0x5aa8c8, 1.5, 1.8, { drop: 'Eiskern' }),
  G('frostdrache', 'Frostdrache', 5, 59, 'vogel', 0x6ab8d8, 0x3a7a9a, 2.0, 3.4, { elite: true, drop: 'Drachenschuppe' }),
  G('scherbenkoenig', 'Der Scherbenkönig', 5, 60, 'humanoid', 0x2a3a5a, 0x8ae8ff, 2.6, 2.6, { boss: true, fern: true, drop: 'Krone der Scherben' }),
];
export const GEGNER_NACH_ID = Object.fromEntries(GEGNER_TYPEN.map(g => [g.id, g]));

// ----------------------------------------------------------------- ORTE (Quest-Ziele & Boss-Plätze, Versatz zur Stadtmitte)
const O = (id, zone, name, dx, dz) => {
  const m = zonenMitte(zone);
  return { id, zone, name, x: m.x + dx, z: m.z + dz };
};
export const ORTE = [
  O('himmelsstein', 0, 'Der Himmelsstein', 120, -160),
  O('steinkreis', 0, 'Alter Steinkreis', -170, 130),
  O('urgroll_platz', 0, 'Urgrolls Lichtung', 180, 190),
  O('leuchtfeuer', 1, 'Altes Leuchtfeuer', 60, -230),
  O('wrack', 1, 'Gestrandetes Wrack', -190, -120),
  O('salzzahn_platz', 1, 'Salzzahn-Bucht', 200, -180),
  O('sonnentor', 2, 'Das Sonnentor', -150, -150),
  O('arena_ruine', 2, 'Verfallene Arena', 170, 120),
  O('ferrox_platz', 2, 'Hof des Zenturios', 190, -170),
  O('hexenhuette', 3, 'Grieldas Hütte', 180, 170),
  O('versunkener_turm', 3, 'Versunkener Turm', -160, 140),
  O('grielda_platz', 3, 'Hexenmoor', 180, 170),
  O('silbermine', 4, 'Alte Silbermine', -170, -140),
  O('aussichtsfels', 4, 'Aussichtsfels', 150, -170),
  O('granit_platz', 4, 'Tal des Steinvaters', -180, 160),
  O('eisthron', 5, 'Der Eisthron', -190, 170),
  O('sternwarte', 5, 'Sternwarte von Neulicht', 140, -130),
  O('koenig_platz', 5, 'Thron des Scherbenkönigs', -190, 170),
];
export const ORTE_NACH_ID = Object.fromEntries(ORTE.map(o => [o.id, o]));

// ----------------------------------------------------------------- NPCs
// rolle: quest | haendler | wirt | heiler   — Position = Versatz zur Stadtmitte
const N = (id, zone, name, rolle, dx, dz, kleidung, hut = null) =>
  ({ id, zone, name, rolle, dx, dz, kleidung, hut });
export const NPCS = [
  // Steinfurt (Steinzeit)
  N('aelt0', 0, 'Älteste Mora', 'quest', 0, -8, 0x8a6a4a, 'fell'),
  N('q0a', 0, 'Jäger Brak', 'quest', 10, 4, 0x6a4a2a, 'fell'),
  N('q0b', 0, 'Sammlerin Tiva', 'quest', -10, 5, 0x9a7a4a, null),
  N('h0', 0, 'Tauschmeister Ugg', 'haendler', 6, 10, 0x7a5a3a, 'fell'),
  N('w0', 0, 'Feuerhüterin Onna', 'wirt', -7, -11, 0xa86a3a, null),
  N('hl0', 0, 'Kräuterfrau Lumi', 'heiler', 12, -6, 0x6a8a4a, null),
  // Bronzhafen (Bronzezeit)
  N('aelt1', 1, 'Hafenmeister Tarok', 'quest', 0, -8, 0x4a6a8a, 'bronze'),
  N('q1a', 1, 'Fischerin Nela', 'quest', 10, 4, 0x3a7a8a, null),
  N('q1b', 1, 'Schmied Bromir', 'quest', -10, 5, 0x8a5a2a, 'bronze'),
  N('h1', 1, 'Händlerin Sila', 'haendler', 6, 10, 0xa8762a, null),
  N('w1', 1, 'Wirt Dorel', 'wirt', -7, -11, 0x6a4a6a, null),
  N('hl1', 1, 'Heilerin Yale', 'heiler', 12, -6, 0xd8d8c8, null),
  // Aurelia (Antike)
  N('aelt2', 2, 'Senatorin Livia', 'quest', 0, -8, 0xe8e0d0, 'lorbeer'),
  N('q2a', 2, 'Gladiator Rux', 'quest', 10, 4, 0xa84a2a, null),
  N('q2b', 2, 'Gelehrter Cato', 'quest', -10, 5, 0xd8d0b8, 'lorbeer'),
  N('h2', 2, 'Marktfrau Iris', 'haendler', 6, 10, 0xc8862a, null),
  N('w2', 2, 'Wirt Felix', 'wirt', -7, -11, 0x8a4a4a, null),
  N('hl2', 2, 'Tempeldienerin Vera', 'heiler', 12, -6, 0xf0e8d8, null),
  // Falkenfels (Mittelalter)
  N('aelt3', 3, 'Burgherrin Adela', 'quest', 0, -8, 0x6a3a5a, 'helm'),
  N('q3a', 3, 'Ritter Gerold', 'quest', 10, 4, 0x6a7a8a, 'helm'),
  N('q3b', 3, 'Kräuterhexe Wila', 'quest', -10, 5, 0x4a5a3a, 'kapuze'),
  N('h3', 3, 'Krämer Otto', 'haendler', 6, 10, 0x7a5a3a, null),
  N('w3', 3, 'Wirtin Berta', 'wirt', -7, -11, 0x8a4a2a, null),
  N('hl3', 3, 'Mönch Anselm', 'heiler', 12, -6, 0x8a7a5a, 'kapuze'),
  // Silberzinne (Renaissance)
  N('aelt4', 4, 'Meisterin Vinata', 'quest', 0, -8, 0x8a2a4a, 'barett'),
  N('q4a', 4, 'Erfinder Leo', 'quest', 10, 4, 0x4a5a8a, 'barett'),
  N('q4b', 4, 'Bergführerin Karin', 'quest', -10, 5, 0x6a5a4a, null),
  N('h4', 4, 'Kaufmann Rico', 'haendler', 6, 10, 0x2a6a5a, 'barett'),
  N('w4', 4, 'Wirt Marek', 'wirt', -7, -11, 0x7a4a2a, null),
  N('hl4', 4, 'Ärztin Flora', 'heiler', 12, -6, 0xe8e8e8, null),
  // Neulicht (Moderne)
  N('aelt5', 5, 'Professorin Edda', 'quest', 0, -8, 0xe8e8f0, null),
  N('q5a', 5, 'Pilot Jano', 'quest', 10, 4, 0x2a4a8a, null),
  N('q5b', 5, 'Forscherin Mio', 'quest', -10, 5, 0x4a8a8a, null),
  N('h5', 5, 'Ladenbesitzer Theo', 'haendler', 6, 10, 0x5a5a6a, null),
  N('w5', 5, 'Barista Coco', 'wirt', -7, -11, 0x8a5a8a, null),
  N('hl5', 5, 'Sanitäter Ben', 'heiler', 12, -6, 0xe84a4a, null),
];
export const NPCS_NACH_ID = Object.fromEntries(NPCS.map(n => [n.id, n]));

// ----------------------------------------------------------------- QUESTS
// art: toeten | sammeln | besuchen   — abgeber: NPC für die Belohnung (Standard: geber)
const Q = (id, zone, geber, titel, text, art, ziel, anzahl, xpJeLvl, extra = {}) => {
  const lvlBasis = extra.lvlBasis ?? ZONEN[zone].lvl[0] + (extra.stufe ?? 0);
  return {
    id, zone, geber, titel, text, art, ziel, anzahl,
    lvl: lvlBasis,
    xp: Math.round(xpJeLvl * lvlBasis),
    gold: extra.gold ?? Math.round(6 * lvlBasis),
    haupt: !!extra.haupt, naechste: extra.naechste ?? null,
    abgeber: extra.abgeber ?? geber, item: extra.item ?? null,
    brauchtLevel: extra.brauchtLevel ?? null,
  };
};

export const QUESTS = [
  // ===== HAUPTGESCHICHTE — Zone 0: Hainwald =====
  Q('h1', 0, 'aelt0', 'Funken im Dunkel',
    'Splitterwanderer! Als der Herz-Stern zerbrach, fiel ein großes Stück in unseren Wald. Sieh dir den Himmelsstein im Osten an — vielleicht spürst du seine Kraft.',
    'besuchen', 'himmelsstein', 1, 50, { haupt: true, naechste: 'h2', stufe: 0 }),
  Q('h2', 0, 'aelt0', 'Hungrige Wildnis',
    'Seit der Stern zerbrach, sind die Tiere wild vor Angst. Die Wildschweine zertrampeln unsere Beerenfelder — schaffe Platz!',
    'toeten', 'wildschwein', 6, 60, { haupt: true, naechste: 'h3', stufe: 1 }),
  Q('h3', 0, 'aelt0', 'Zähne der Nacht',
    'Die Wölfe heulen jede Nacht näher am Dorf. Bring mir 5 Wolfszähne, dann weiß ich, dass das Rudel kleiner wird.',
    'sammeln', 'jungwolf', 5, 60, { haupt: true, naechste: 'h4', stufe: 2 }),
  Q('h4', 0, 'aelt0', 'Das flüsternde Netz',
    'In den alten Bäumen wuchern Spinnennetze, groß wie Hütten. Vernichte 8 Waldspinnen, bevor sie unsere Pfade verschließen.',
    'toeten', 'waldspinne', 8, 60, { haupt: true, naechste: 'h5', stufe: 3 }),
  Q('h5', 0, 'aelt0', 'Diebe am Steinkreis',
    'Banditen haben sich am alten Steinkreis eingenistet und stehlen Splitter des Sterns! Vertreibe 6 von ihnen.',
    'toeten', 'banditenlehrling', 6, 60, { haupt: true, naechste: 'h6', stufe: 6 }),
  Q('h6', 0, 'aelt0', 'Der alte Groll',
    'Der Eber Urgroll hat das Herzfragment der Wälder verschluckt — der Zorn des Splitters macht ihn riesig! Besiege ihn auf seiner Lichtung im Südosten. Nimm Verstärkung mit — Feuerhüterin Onna kennt mutige Gefährten!',
    'toeten', 'urgroll', 1, 110, { haupt: true, naechste: 'h7', stufe: 8, gold: 120 }),
  Q('h7', 0, 'aelt0', 'Reise nach Bronzhafen',
    'Du trägst das erste Herzfragment! Folge der Straße nach Osten zur Salzküste. Hafenmeister Tarok in Bronzhafen erwartet dich.',
    'besuchen', 'stadt1', 1, 70, { haupt: true, naechste: 'k1', abgeber: 'aelt1', stufe: 9 }),

  // ===== Zone 1: Salzküste =====
  Q('k1', 1, 'aelt1', 'Salz im Wind',
    'Ein Splitterwanderer, hier in Bronzhafen! Das Meer tobt, seit ein Herzfragment in die Bucht stürzte. Erst die Plagen: Die Strandkrabben zwicken meine Träger — verjage sie!',
    'toeten', 'strandkrabbe', 8, 60, { haupt: true, naechste: 'k2', stufe: 0 }),
  Q('k2', 1, 'aelt1', 'Glibber überall',
    'Die Salzschleime fressen unsere Netze! Bring mir 6 Salzkristalle aus ihrem Inneren — daraus schmieden wir Handelsware.',
    'sammeln', 'salzschleim', 6, 60, { haupt: true, naechste: 'k3', stufe: 1 }),
  Q('k3', 1, 'aelt1', 'Räuber der Küste',
    'Strandräuber plündern jedes Boot, das anlegt. Setze 7 von ihnen außer Gefecht, damit der Handel weitergeht.',
    'toeten', 'strandraeuber', 7, 60, { haupt: true, naechste: 'k4', stufe: 4 }),
  Q('k4', 1, 'aelt1', 'Das alte Leuchtfeuer',
    'Ohne Leuchtfeuer finden die Schiffe nachts nicht heim. Sieh am alten Leuchtturm im Norden nach dem Rechten.',
    'besuchen', 'leuchtfeuer', 1, 60, { haupt: true, naechste: 'k5', stufe: 5 }),
  Q('k5', 1, 'aelt1', 'Fischer der Tiefe',
    'Am Leuchtfeuer lauern Tiefenfischer — Wesen aus der See, die das Fragment bewachen wollen. Besiege 8 von ihnen.',
    'toeten', 'tiefenfischer', 8, 60, { haupt: true, naechste: 'k6', stufe: 6 }),
  Q('k6', 1, 'aelt1', 'Der Wyrm der Bucht',
    'Der Meereswyrm Salzzahn hat das Herzfragment der See verschlungen! Stelle ihn in der Bucht im Nordosten. Allein ist das Wahnsinn — nimm Gefährten mit!',
    'toeten', 'salzzahn', 1, 110, { haupt: true, naechste: 'k7', stufe: 8, gold: 220 }),
  Q('k7', 1, 'aelt1', 'Weiter zur Steppe',
    'Zwei Fragmente leuchten in deiner Tasche! Reise nach Osten in die Goldene Steppe — Senatorin Livia in Aurelia braucht dich.',
    'besuchen', 'stadt2', 1, 70, { haupt: true, naechste: 's1', abgeber: 'aelt2', stufe: 9 }),

  // ===== Zone 2: Goldene Steppe =====
  Q('s1', 2, 'aelt2', 'Die Legion erwacht',
    'Willkommen in Aurelia, Splitterwanderer. Ein Herzfragment fiel in unsere Arena — und erweckte die alte Messing-Legion! Ihre Legionäre marschieren wieder. Halte 8 von ihnen auf.',
    'toeten', 'messinglegionaer', 8, 60, { haupt: true, naechste: 's2', stufe: 0 }),
  Q('s2', 2, 'aelt2', 'Löwen der Steppe',
    'Die Steppenlöwen wittern das Chaos und reißen unsere Handelskarawanen. Erlege 7 und bring Ruhe auf die Straßen.',
    'toeten', 'steppenloewe', 7, 60, { haupt: true, naechste: 's3', stufe: 1 }),
  Q('s3', 2, 'aelt2', 'Staub der Geister',
    'Die Steppen-Schamanen rufen Sandgeister gegen die Stadt. Bring mir 6 Häufchen Geisterstaub als Beweis ihres Scheiterns.',
    'sammeln', 'steppenschamane', 6, 60, { haupt: true, naechste: 's4', stufe: 5 }),
  Q('s4', 2, 'aelt2', 'Das Sonnentor',
    'Unsere Gelehrten sagen, am Sonnentor im Nordwesten sammelt sich die Kraft des Fragments. Untersuche es.',
    'besuchen', 'sonnentor', 1, 60, { haupt: true, naechste: 's5', stufe: 6 }),
  Q('s5', 2, 'aelt2', 'Wächter aus Bronze',
    'Das Tor wird von Bronzewächtern geschützt, die niemand gebaut hat — das Fragment erschafft sie! Zerlege 4 dieser Kolosse.',
    'toeten', 'bronzewaechter', 4, 70, { haupt: true, naechste: 's6', stufe: 7 }),
  Q('s6', 2, 'aelt2', 'Der Zenturio',
    'Zenturio Ferrox, Anführer der Messing-Legion, trägt das Herzfragment der Sonne in seiner Brust. Fordere ihn in seinem Hof heraus — mit Verstärkung!',
    'toeten', 'ferrox', 1, 110, { haupt: true, naechste: 's7', stufe: 8, gold: 350 }),
  Q('s7', 2, 'aelt2', 'Ins Dornenmoor',
    'Drei Fragmente! Du bist auf halbem Weg. Im Süden liegt das Dornenmoor — Burgherrin Adela auf Falkenfels erwartet tapfere Hilfe.',
    'besuchen', 'stadt3', 1, 70, { haupt: true, naechste: 'm1', abgeber: 'aelt3', stufe: 9 }),

  // ===== Zone 3: Dornenmoor =====
  Q('m1', 3, 'aelt3', 'Nebel über dem Moor',
    'Gut, dass du da bist! Seit das Herzfragment ins Moor stürzte, kriechen Lurche und Schleicher bis an unsere Burgmauern. Wehre 8 Moorlurche ab!',
    'toeten', 'moorlurch', 8, 60, { haupt: true, naechste: 'm2', stufe: 0 }),
  Q('m2', 3, 'aelt3', 'Falsche Lichter',
    'Irrlichter locken unsere Boten in die Sümpfe. Fange 6 Lichtfunken — daraus machen wir Laternen, die den wahren Weg zeigen.',
    'sammeln', 'irrlicht', 6, 60, { haupt: true, naechste: 'm3', stufe: 4 }),
  Q('m3', 3, 'aelt3', 'Die verlorenen Ritter',
    'Ritter, die im Moor fielen, wandeln wieder — das Fragment lässt sie nicht ruhen. Erlöse 7 Moorritter von ihrem Fluch.',
    'toeten', 'moorritter', 7, 60, { haupt: true, naechste: 'm4', stufe: 7 }),
  Q('m4', 3, 'aelt3', 'Der versunkene Turm',
    'Kundschafter melden Licht im versunkenen Turm südwestlich der Burg. Sieh nach, was dort vor sich geht.',
    'besuchen', 'versunkener_turm', 1, 60, { haupt: true, naechste: 'm5', stufe: 8 }),
  Q('m5', 3, 'aelt3', 'Grieldas Spiel',
    'Die Moorhexe Grielda hat das Herzfragment des Moores! Sie braut damit Tränke ewiger Dämmerung. Stelle sie an ihrer Hütte tief im Moor — und geh nicht allein!',
    'toeten', 'grielda', 1, 110, { haupt: true, naechste: 'm6', stufe: 9, gold: 500 }),
  Q('m6', 3, 'aelt3', 'Hinauf nach Silberzinne',
    'Vier Fragmente — dein Beutel leuchtet wie ein Lagerfeuer! Reise nach Westen ins Gebirge. Meisterin Vinata in Silberzinne hat nach dir gefragt.',
    'besuchen', 'stadt4', 1, 70, { haupt: true, naechste: 'g1', abgeber: 'aelt4', stufe: 9 }),

  // ===== Zone 4: Graufelsen =====
  Q('g1', 4, 'aelt4', 'Beben im Berg',
    'Willkommen in Silberzinne! Das Herzfragment der Berge schlummert in der alten Silbermine — und weckt den Stein selbst auf. Felsgolems zertrümmern unsere Stollen. Zerschlage 7!',
    'toeten', 'felsgolem', 7, 60, { haupt: true, naechste: 'g2', stufe: 0 }),
  Q('g2', 4, 'aelt4', 'Diebe im Nebel',
    'Silberdiebe nutzen das Chaos und plündern die Minenlager. Bring mir 6 gestohlene Silberbarren zurück.',
    'sammeln', 'silberdieb', 6, 60, { haupt: true, naechste: 'g3', stufe: 1 }),
  Q('g3', 4, 'aelt4', 'Trolle am Pass',
    'Bergtrolle blockieren den Handelspass. Ohne den Pass bekommt Neulicht keine Vorräte. Vertreibe 7 Trolle!',
    'toeten', 'bergtroll', 7, 60, { haupt: true, naechste: 'g4', stufe: 7 }),
  Q('g4', 4, 'aelt4', 'Die alte Silbermine',
    'Unsere Erfinder spüren das Fragment tief in der alten Silbermine im Nordwesten. Erkunde den Eingang.',
    'besuchen', 'silbermine', 1, 60, { haupt: true, naechste: 'g5', stufe: 8 }),
  Q('g5', 4, 'aelt4', 'Der Steinvater',
    'Der uralte Golem Steinvater Granit hat das Herzfragment der Berge in sich aufgenommen. Du findest ihn im Tal südwestlich. Nimm Gefährten mit — er ist ein wandelnder Berg!',
    'toeten', 'granit', 1, 110, { haupt: true, naechste: 'g6', stufe: 9, gold: 700 }),
  Q('g6', 4, 'aelt4', 'Aufbruch nach Neulicht',
    'Fünf Fragmente! Nur noch eines fehlt. Im ewigen Eis des Frostgipfels liegt Neulicht, die Stadt der Zukunft. Professorin Edda weiß, wie die Geschichte endet.',
    'besuchen', 'stadt5', 1, 70, { haupt: true, naechste: 'f1', abgeber: 'aelt5', stufe: 9 }),

  // ===== Zone 5: Frostgipfel =====
  Q('f1', 5, 'aelt5', 'Die Stadt der Zukunft',
    'Da bist du ja! Unsere Instrumente haben dich kommen sehen. Der Scherbenkönig sitzt auf dem Eisthron — aber sein Heer steht zwischen euch. Beginne mit den Eiswölfen, die unsere Versorgungswege jagen: 8 Stück!',
    'toeten', 'eiswolf', 8, 60, { haupt: true, naechste: 'f2', stufe: 0 }),
  Q('f2', 5, 'aelt5', 'Splitter über Splitter',
    'Die Splitterlinge sind geronnene Scherben des Herz-Sterns. Sammle 8 Sternensplitter — wir bauen daraus einen Schlüssel zum Eisthron.',
    'sammeln', 'splitterling', 8, 60, { haupt: true, naechste: 'f3', stufe: 1 }),
  Q('f3', 5, 'aelt5', 'Ritter der Scherben',
    'Die Scherbenritter sind die Leibgarde des Königs — Krieger aus gefrorener Zeit. Besiege 8, um seine Verteidigung zu schwächen.',
    'toeten', 'scherbenritter', 8, 60, { haupt: true, naechste: 'f4', stufe: 6 }),
  Q('f4', 5, 'aelt5', 'Die Sternwarte',
    'Unsere Sternwarte hat den schwachen Punkt des Königs berechnet. Hole dir die Daten an der Sternwarte im Nordosten ab.',
    'besuchen', 'sternwarte', 1, 60, { haupt: true, naechste: 'f5', stufe: 7 }),
  Q('f5', 5, 'aelt5', 'Der Frostdrache',
    'Ein Frostdrache kreist über dem Eisthron und warnt den König vor jedem Angriff. Hole ihn vom Himmel!',
    'toeten', 'frostdrache', 1, 90, { haupt: true, naechste: 'f6', stufe: 8, gold: 600 }),
  Q('f6', 5, 'aelt5', 'Der Scherbenkönig',
    'Es ist soweit. Sechs Fragmente, ein Schlüssel, ein schwacher Punkt. Geh zum Eisthron im Südwesten und beende, was der Scherbenkönig begann. Ganz Piczelia zählt auf dich — und auf deine Gefährten!',
    'toeten', 'scherbenkoenig', 1, 150, { haupt: true, naechste: 'f7', stufe: 9, gold: 1500 }),
  Q('f7', 5, 'aelt5', 'Ein neuer Stern',
    'Du hast es geschafft! Die Fragmente fügen sich zusammen — ein neuer Herz-Stern steigt über Piczelia auf. Die Zeitalter bleiben als Erinnerung, aber die Welt ist wieder EINS. Danke, Splitterwanderer. Diese Geschichte wird man sich an jedem Lagerfeuer erzählen.',
    'besuchen', 'stadt5', 1, 200, { haupt: true, stufe: 9, gold: 2000 }),

  // ===== NEBENQUESTS — Zone 0 =====
  Q('n0a1', 0, 'q0a', 'Borsten fürs Lager', 'Aus Borstenfell machen wir warme Schlafmatten. Bring mir 4 Felle!', 'sammeln', 'wildschwein', 4, 40, { stufe: 0 }),
  Q('n0a2', 0, 'q0a', 'Das Rudel dünnt aus', 'Die Jungwölfe fressen uns das Wild weg. Erlege 6!', 'toeten', 'jungwolf', 6, 40, { stufe: 1 }),
  Q('n0a3', 0, 'q0a', 'Flatternde Schatten', 'Fledermäuse rauben nachts unsere Vorräte. Verjage 6 aus den Höhlen im Norden.', 'toeten', 'hoehlenfledermaus', 6, 40, { stufe: 5 }),
  Q('n0a4', 0, 'q0a', 'Der Grollbär', 'Ein riesiger Bär streift durchs Unterholz. Nur die Mutigsten stellen ihn — bist du es?', 'toeten', 'grollbaer', 1, 60, { stufe: 7, gold: 90 }),
  Q('n0b1', 0, 'q0b', 'Seide der Spinnen', 'Spinnenseide ergibt die besten Schnüre. Sammle 5 Fäden für mich.', 'sammeln', 'waldspinne', 5, 40, { stufe: 2 }),
  Q('n0b2', 0, 'q0b', 'Wandelnde Wurzeln', 'Die Wurzelknechte zertrampeln meine Kräuterbeete! Verjage 5.', 'toeten', 'wurzelknecht', 5, 40, { stufe: 3 }),
  Q('n0b3', 0, 'q0b', 'Der alte Steinkreis', 'Unsere Ahnen beteten am Steinkreis im Südwesten. Sieh nach, ob er noch steht.', 'besuchen', 'steinkreis', 1, 40, { stufe: 2 }),
  Q('n0h1', 0, 'h0', 'Gestohlene Beutel', 'Die Banditen haben Tauschware gestohlen! Bring mir 4 Beutel zurück.', 'sammeln', 'banditenlehrling', 4, 45, { stufe: 6 }),

  // ===== Zone 1 =====
  Q('n1a1', 1, 'q1a', 'Scheren-Plage', 'Diese Krabben zwicken mir die Zehen! Bring mir 5 Scheren — gibt gute Suppe.', 'sammeln', 'strandkrabbe', 5, 40, { stufe: 0 }),
  Q('n1a2', 1, 'q1a', 'Diebische Vögel', 'Die Möwengreife klauen den ganzen Fang! Verjage 6.', 'toeten', 'moewengreif', 6, 40, { stufe: 3 }),
  Q('n1a3', 1, 'q1a', 'Das Wrack', 'Vor Jahren strandete ein Handelsschiff im Westen. Sieh nach, ob die Ladung noch da ist.', 'besuchen', 'wrack', 1, 40, { stufe: 2 }),
  Q('n1b1', 1, 'q1b', 'Bronze für die Esse', 'Die Strandräuber tragen gute Bronzedolche. Bring mir 5 zum Einschmelzen!', 'sammeln', 'strandraeuber', 5, 40, { stufe: 4 }),
  Q('n1b2', 1, 'q1b', 'Perlmutt-Auftrag', 'Muschelgolems bestehen aus feinstem Perlmutt. Brich 4 Stücke heraus.', 'sammeln', 'muschelgolem', 4, 45, { stufe: 7 }),
  Q('n1b3', 1, 'q1b', 'Schleim in der Schmiede', 'Salzschleime verstopfen meine Wasserrinne! Mach 7 platt.', 'toeten', 'salzschleim', 7, 40, { stufe: 1 }),
  Q('n1h1', 1, 'h1', 'Die Riffschlange', 'Eine riesige Schlange umkreist die Handelsroute. Wer sie erlegt, wird gut bezahlt.', 'toeten', 'riffschlange', 1, 60, { stufe: 8, gold: 160 }),
  Q('n1h2', 1, 'h1', 'Federn für Kissen', 'Greifenfedern sind herrlich weich. Bring mir 5!', 'sammeln', 'moewengreif', 5, 40, { stufe: 3 }),

  // ===== Zone 2 =====
  Q('n2a1', 2, 'q2a', 'Training mit Zähnen', 'Ein Gladiator braucht würdige Gegner! Erlege 6 Steppenlöwen — Respekt, wenn du es schaffst.', 'toeten', 'steppenloewe', 6, 40, { stufe: 0 }),
  Q('n2a2', 2, 'q2a', 'Stachel-Sammlung', 'Skorpionstacheln geben perfekte Trainings-Speerspitzen. Bring mir 6!', 'sammeln', 'staubskorpion', 6, 40, { stufe: 3 }),
  Q('n2a3', 2, 'q2a', 'Die alte Arena', 'In der verfallenen Arena im Südosten kämpfte ich einst. Sieh nach, was daraus geworden ist.', 'besuchen', 'arena_ruine', 1, 40, { stufe: 4 }),
  Q('n2b1', 2, 'q2b', 'Abzeichen der Legion', 'Ich erforsche die Messing-Legion. Bring mir 5 Legionsabzeichen!', 'sammeln', 'messinglegionaer', 5, 40, { stufe: 4 }),
  Q('n2b2', 2, 'q2b', 'Geier über Aurelia', 'Die Aasgeier werden zur Plage. Schieße 7 vom Himmel.', 'toeten', 'aasgeier', 7, 40, { stufe: 1 }),
  Q('n2b3', 2, 'q2b', 'Schnelle Hufe', 'Dornenläufer rasen durch die Felder. Stoppe 6 von ihnen.', 'toeten', 'dornenlaeufer', 6, 40, { stufe: 7 }),
  Q('n2h1', 2, 'h2', 'Mähnen-Mode', 'Löwenmähnen sind diese Saison DER Schmuck. Besorge mir 4!', 'sammeln', 'steppenloewe', 4, 40, { stufe: 0 }),
  Q('n2h2', 2, 'h2', 'Kern-Geschäft', 'Bronzekerne der Wächter sind Gold wert. Bring mir 3!', 'sammeln', 'bronzewaechter', 3, 60, { stufe: 8, gold: 180 }),

  // ===== Zone 3 =====
  Q('n3a1', 3, 'q3a', 'Ritterpflicht', 'Meine gefallenen Brüder wandeln im Moor. Erlöse 6 — sie haben Frieden verdient.', 'toeten', 'moorritter', 6, 40, { stufe: 7 }),
  Q('n3a2', 3, 'q3a', 'Krallen im Schlamm', 'Sumpfschleicher zerren Reisende von der Straße. Erlege 7!', 'toeten', 'sumpfschleicher', 7, 40, { stufe: 3 }),
  Q('n3a3', 3, 'q3a', 'Wappen der Ehre', 'Bring mir 5 Wappen der verlorenen Ritter — wir hängen sie in die Ehrenhalle.', 'sammeln', 'moorritter', 5, 40, { stufe: 7 }),
  Q('n3b1', 3, 'q3b', 'Sporen-Sud', 'Für meinen Schutztrank brauche ich 6 Giftsporen. Aber atme sie nicht ein!', 'sammeln', 'giftpilzling', 6, 40, { stufe: 1 }),
  Q('n3b2', 3, 'q3b', 'Lurchschleim-Salbe', 'Lurchschleim heilt Brandwunden — bring mir 5 Portionen.', 'sammeln', 'moorlurch', 5, 40, { stufe: 0 }),
  Q('n3b3', 3, 'q3b', 'Rabenfedern', 'Hexenraben tragen Unglück auf den Flügeln. 6 Federn für meinen Bannzauber!', 'sammeln', 'hexenrabe', 6, 40, { stufe: 6 }),
  Q('n3h1', 3, 'h3', 'Die Dornenbestie', 'Eine Bestie aus Dornen reißt unsere Lieferwagen. Hohe Belohnung für ihren Kopf!', 'toeten', 'dornenbestie', 1, 60, { stufe: 8, gold: 250 }),
  Q('n3h2', 3, 'h3', 'Glibber-Bestellung', 'Moorlurche verstopfen den Burggraben. Räum 8 weg!', 'toeten', 'moorlurch', 8, 40, { stufe: 0 }),

  // ===== Zone 4 =====
  Q('n4a1', 4, 'q4a', 'Kristall-Forschung', 'Kristallspinnen spinnen reines Glas! Bring mir 6 Splitter für meine Linsen.', 'sammeln', 'kristallspinne', 6, 40, { stufe: 3 }),
  Q('n4a2', 4, 'q4a', 'Frost-Essenz', 'Lawinengeister bestehen aus purem Frost. Fange 5 Essenzen für meine Kühlmaschine!', 'sammeln', 'lawinengeist', 5, 40, { stufe: 6 }),
  Q('n4a3', 4, 'q4a', 'Der Aussichtsfels', 'Von dort oben will ich die Sterne vermessen. Prüfe, ob der Aufstieg zum Aussichtsfels sicher ist.', 'besuchen', 'aussichtsfels', 1, 40, { stufe: 2 }),
  Q('n4b1', 4, 'q4b', 'Adler-Gefahr', 'Steinadler greifen die Seilbahnen an! Hole 6 herunter.', 'toeten', 'steinadler', 6, 40, { stufe: 0 }),
  Q('n4b2', 4, 'q4b', 'Trollzähne', 'Trollzähne wachsen nach — die Trolle merken es kaum. Bring mir trotzdem lieber 5.', 'sammeln', 'bergtroll', 5, 40, { stufe: 7 }),
  Q('n4b3', 4, 'q4b', 'Golem-Geröll', 'Granitbrocken der Felsgolems sind perfekte Baumsteine. 6 Stück, bitte!', 'sammeln', 'felsgolem', 6, 40, { stufe: 4 }),
  Q('n4h1', 4, 'h4', 'Das Grollhorn', 'Ein Ur-Yak versperrt den Pass nach Neulicht. Wer es vertreibt, bekommt fürstlichen Lohn.', 'toeten', 'grollhorn', 1, 60, { stufe: 8, gold: 350 }),
  Q('n4h2', 4, 'h4', 'Silber zurückholen', 'Die Diebe werden frech! Bring mir 5 Silberbarren zurück.', 'sammeln', 'silberdieb', 5, 40, { stufe: 1 }),

  // ===== Zone 5 =====
  Q('n5a1', 5, 'q5a', 'Eisige Triebwerke', 'Frostgeister vereisen meine Gleiter! Banne 6, damit ich wieder fliegen kann.', 'toeten', 'frostgeist', 6, 40, { stufe: 4 }),
  Q('n5a2', 5, 'q5a', 'Wolfspatrouille', 'Die Eiswölfe jagen im Rudel an der Landebahn. Verjage 7!', 'toeten', 'eiswolf', 7, 40, { stufe: 0 }),
  Q('n5a3', 5, 'q5a', 'Drachen-Beobachtung', 'Bring mir eine Drachenschuppe — ich MUSS wissen, woraus der Frostdrache besteht!', 'sammeln', 'frostdrache', 1, 70, { stufe: 8, gold: 400 }),
  Q('n5b1', 5, 'q5b', 'Kern-Analyse', 'Eisgolem-Kerne speichern uralte Energie. Besorge mir 4 für mein Labor!', 'sammeln', 'eisgolem', 4, 40, { stufe: 7 }),
  Q('n5b2', 5, 'q5b', 'Scherben-Proben', 'Splitterlinge tragen Bruchstücke des Herz-Sterns. Sammle 6 Sternensplitter!', 'sammeln', 'splitterling', 6, 40, { stufe: 1 }),
  Q('n5b3', 5, 'q5b', 'Bären-Alarm', 'Schneetatzen wühlen unsere Vorratslager um. Vertreibe 6!', 'toeten', 'schneetatze', 6, 40, { stufe: 3 }),
  Q('n5h1', 5, 'h5', 'Klingen-Sammlung', 'Scherbenklingen der Ritter sind begehrte Sammlerstücke. 5 Stück = gutes Gold!', 'sammeln', 'scherbenritter', 5, 40, { stufe: 6 }),
  Q('n5h2', 5, 'h5', 'Frischer Wind', 'Eisgolems blockieren die Heizungsrohre der Stadt! Zerlege 5.', 'toeten', 'eisgolem', 5, 40, { stufe: 7 }),
];
export const QUESTS_NACH_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));

// ----------------------------------------------------------------- GEGENSTÄNDE
export const SELTENHEITEN = [
  { name: 'Gewöhnlich', farbe: '#9aa0a6', faktor: 1.0, gewicht: 52 },
  { name: 'Gut',        farbe: '#3ddc84', faktor: 1.25, gewicht: 30 },
  { name: 'Selten',     farbe: '#4aa8ff', faktor: 1.55, gewicht: 13 },
  { name: 'Episch',     farbe: '#c06bff', faktor: 1.95, gewicht: 4 },
  { name: 'Legendär',   farbe: '#ffa726', faktor: 2.5, gewicht: 1 },
];

export const SLOTS = ['waffe', 'kopf', 'brust', 'beine', 'fuesse'];
export const SLOT_NAMEN = { waffe: 'Waffe', kopf: 'Kopf', brust: 'Brust', beine: 'Beine', fuesse: 'Füße' };

const BASIS_NAMEN = {
  waffe: { schwert: 'Schwert', kolben: 'Streitkolben', stab: 'Zauberstab', bogen: 'Bogen', dolch: 'Dolch' },
  kopf: { stoff: 'Kapuze', leder: 'Lederkappe', platte: 'Helm' },
  brust: { stoff: 'Robe', leder: 'Lederwams', platte: 'Brustpanzer' },
  beine: { stoff: 'Stoffhose', leder: 'Lederhose', platte: 'Beinschienen' },
  fuesse: { stoff: 'Sandalen', leder: 'Lederstiefel', platte: 'Eisenstiefel' },
};
const PRAEFIXE = ['Einfache', 'Solide', 'Feine', 'Prächtige', 'Sagenhafte'];
// Grammatik: r = der, s = das, nichts = die/Mehrzahl
const GENUS = {
  schwert: 's', kolben: 'r', stab: 'r', bogen: 'r', dolch: 'r',
  Kapuze: '', Lederkappe: '', Helm: 'r', Robe: '', Lederwams: 's', Brustpanzer: 'r',
  Stoffhose: '', Lederhose: '', Beinschienen: '', Sandalen: '', Lederstiefel: '', Eisenstiefel: '',
};
const SUFFIXE = ['des Wolfes', 'des Adlers', 'der Eiche', 'des Sturms', 'der Sonne', 'des Mondes', 'der Tiefe', 'des Splitters', 'der Legende', 'des Herz-Sterns'];

let _itemZaehler = 1;
export function zufallsItem(lvl, rng, klasseId = null) {
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  // Seltenheit würfeln
  let wurf = rng() * 100, selten = 0, summe = 0;
  for (let i = 0; i < SELTENHEITEN.length; i++) { summe += SELTENHEITEN[i].gewicht; if (wurf < summe) { selten = i; break; } }
  const s = SELTENHEITEN[selten];
  let art, name;
  if (slot === 'waffe') {
    const waffen = klasseId ? [KLASSEN[klasseId].waffe] : Object.keys(BASIS_NAMEN.waffe);
    art = waffen[Math.floor(rng() * waffen.length)];
    name = BASIS_NAMEN.waffe[art];
  } else {
    const arten = klasseId ? [KLASSEN[klasseId].ruestung] : ['stoff', 'leder', 'platte'];
    art = arten[Math.floor(rng() * arten.length)];
    name = BASIS_NAMEN[slot][art];
  }
  const endung = slot === 'waffe' ? (GENUS[art] ?? '') : (GENUS[name] ?? '');
  const voll = `${PRAEFIXE[selten]}${endung} ${name}` + (selten >= 1 ? ` ${SUFFIXE[Math.floor(rng() * SUFFIXE.length)]}` : '');
  const budget = (4 + lvl * 1.4) * s.faktor;
  const stats = {};
  if (slot === 'waffe') {
    stats.angriff = Math.max(1, Math.round(budget * 0.9));
    if (selten >= 2) stats.leben = Math.round(budget * 0.5);
  } else {
    stats.abwehr = Math.max(1, Math.round(budget * (art === 'platte' ? 0.5 : art === 'leder' ? 0.38 : 0.26)));
    stats.leben = Math.round(budget * 0.8);
    if (art === 'stoff') stats.mana = Math.round(budget * 0.9);
    if (selten >= 2 && art !== 'stoff') stats.angriff = Math.round(budget * 0.3);
  }
  return {
    uid: 'i' + (_itemZaehler++),
    name: voll, slot, art, seltenheit: selten, ilvl: lvl,
    stats, wert: Math.max(2, Math.round(budget * 2.5)),
  };
}

export function heiltrank(lvl) {
  return { uid: 'i' + (_itemZaehler++), name: 'Heiltrank', slot: 'trank', art: 'heiltrank', seltenheit: 0, ilvl: lvl, stats: {}, wert: Math.round(5 + lvl * 1.5) };
}
export function manatrank(lvl) {
  return { uid: 'i' + (_itemZaehler++), name: 'Manatrank', slot: 'trank', art: 'manatrank', seltenheit: 0, ilvl: lvl, stats: {}, wert: Math.round(5 + lvl * 1.2) };
}

// XP-Kurve: insgesamt ~100+ Stunden bis Level 60 (Quests + Jagen + Ausrüstung)
export function xpFuerLevel(l) { return Math.round(60 * Math.pow(l, 1.75)) + 60; }

// ----------------------------------------------------------------- GEFÄHRTEN (anheuerbar beim Wirt)
export const GEFAEHRTEN_TYPEN = [
  { id: 'brom', name: 'Brom der Schildwart', rolle: 'tank', klasse: 'krieger', text: 'Hält die Gegner auf sich gezogen.', farbe: 0xc0392b },
  { id: 'lumi', name: 'Lumi die Lichtweberin', rolle: 'heiler', klasse: 'priester', text: 'Heilt dich mitten im Kampf.', farbe: 0xf1c40f },
];

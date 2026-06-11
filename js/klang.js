// Alle Klänge synthetisiert (WebAudio) — inkl. offiziellem PICZEL-Klang
let ctx = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function weckeAudio() { audio(); }

function spielePuffer(fuellen, dauer, lautstaerke = 1) {
  try {
    const a = audio();
    const sr = a.sampleRate;
    const puffer = a.createBuffer(1, Math.ceil(sr * dauer), sr);
    const d = puffer.getChannelData(0);
    fuellen(d, sr);
    const quelle = a.createBufferSource();
    quelle.buffer = puffer;
    const gain = a.createGain();
    gain.gain.value = lautstaerke;
    quelle.connect(gain).connect(a.destination);
    quelle.start();
  } catch (e) { /* Audio darf nie das Spiel stoppen */ }
}

// ✦ DER OFFIZIELLE PICZEL-KLANG (exakte Firmen-Formel)
export function piczelKlang() {
  spielePuffer((d, sr) => {
    const toene = [
      { f: 1046.5, start: 0.000, abfall: 18 },
      { f: 1318.5, start: 0.055, abfall: 18 },
      { f: 1568.0, start: 0.110, abfall: 18 },
      { f: 2093.0, start: 0.165, abfall: 7 },
    ];
    for (const t of toene) {
      const s0 = Math.floor(t.start * sr);
      for (let i = s0; i < d.length; i++) {
        const dt = (i - s0) / sr;
        const huelle = Math.exp(-t.abfall * dt);
        if (huelle < 0.001) break;
        const ph = 2 * Math.PI * t.f * dt;
        const rechteck = Math.sign(Math.sin(ph));
        d[i] += (0.6 * rechteck + 0.4 * Math.sin(ph)) * huelle * 0.17;
      }
    }
    // Glitzer C8 auf dem Schlusston
    const s0 = Math.floor(0.165 * sr);
    for (let i = s0; i < d.length; i++) {
      const dt = (i - s0) / sr;
      const huelle = Math.exp(-9 * dt);
      if (huelle < 0.001) break;
      d[i] += Math.sin(2 * Math.PI * 4186 * dt) * huelle * 0.17 * 0.3;
    }
  }, 0.55, 1);
}

export function treffer() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-30 * dt) * 0.25
        + Math.sin(2 * Math.PI * 180 * dt) * Math.exp(-22 * dt) * 0.2;
    }
  }, 0.18);
}

export function schwung() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-14 * dt) * 0.08 * Math.sin(Math.PI * dt / 0.15);
    }
  }, 0.15);
}

export function zauber() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      const f = 500 + 900 * dt;
      d[i] = Math.sin(2 * Math.PI * f * dt) * Math.exp(-7 * dt) * 0.14;
    }
  }, 0.35);
}

export function heilung() {
  spielePuffer((d, sr) => {
    const toene = [523, 659, 784];
    for (let t = 0; t < 3; t++) {
      const s0 = Math.floor(t * 0.09 * sr);
      for (let i = s0; i < d.length; i++) {
        const dt = (i - s0) / sr;
        d[i] += Math.sin(2 * Math.PI * toene[t] * dt) * Math.exp(-8 * dt) * 0.1;
      }
    }
  }, 0.5);
}

export function levelAuf() {
  spielePuffer((d, sr) => {
    const toene = [392, 523, 659, 784, 1046];
    for (let t = 0; t < toene.length; t++) {
      const s0 = Math.floor(t * 0.1 * sr);
      for (let i = s0; i < d.length; i++) {
        const dt = (i - s0) / sr;
        const huelle = Math.exp(-(t === 4 ? 4 : 10) * dt);
        if (huelle < 0.001) break;
        const ph = 2 * Math.PI * toene[t] * dt;
        d[i] += (0.5 * Math.sign(Math.sin(ph)) + 0.5 * Math.sin(ph)) * huelle * 0.13;
      }
    }
  }, 1.1);
}

export function questFertig() {
  spielePuffer((d, sr) => {
    const toene = [659, 784, 1046];
    for (let t = 0; t < 3; t++) {
      const s0 = Math.floor(t * 0.12 * sr);
      for (let i = s0; i < d.length; i++) {
        const dt = (i - s0) / sr;
        d[i] += Math.sin(2 * Math.PI * toene[t] * dt) * Math.exp(-6 * dt) * 0.13;
      }
    }
  }, 0.7);
}

export function muenze() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = (Math.sin(2 * Math.PI * 1800 * dt) + 0.5 * Math.sin(2 * Math.PI * 2400 * dt))
        * Math.exp(-20 * dt) * 0.1;
    }
  }, 0.2);
}

export function aua() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = Math.sin(2 * Math.PI * (140 - 60 * dt) * dt) * Math.exp(-9 * dt) * 0.22;
    }
  }, 0.3);
}

export function tod() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = Math.sin(2 * Math.PI * (220 - 140 * dt) * dt) * Math.exp(-3 * dt) * 0.18;
    }
  }, 0.9);
}

export function beuteKlang() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = Math.sin(2 * Math.PI * 880 * dt) * Math.exp(-15 * dt) * 0.1;
    }
  }, 0.2);
}

export function bogen() {
  spielePuffer((d, sr) => {
    for (let i = 0; i < d.length; i++) {
      const dt = i / sr;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-40 * dt) * 0.15
        + Math.sin(2 * Math.PI * 320 * dt) * Math.exp(-25 * dt) * 0.1;
    }
  }, 0.15);
}

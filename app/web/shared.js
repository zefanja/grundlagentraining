/* Gemeinsame Logik für Lehrer- und Schüler-App: Sätze, Fakten, Sprint-Mischung, Ziele. */
(function (g) {
  'use strict';
  const DOT = '·', MINUS = '−';
  const SETS = [
    ['A1', '+0, +1, +2', 'Nachbarzahl: +1 ist die nächste Zahl, +2 die übernächste.'],
    ['A2', 'Zehnerfreunde, +10', 'Zehnerfreunde ergeben zusammen 10. +10: die Zehnerstelle wird um 1 größer.'],
    ['A3', 'Verdoppeln bis 10 + 10', 'Doppelte zuerst sicher auswendig.'],
    ['A4', 'Fast-Verdoppeln', 'Das Doppelte der kleineren Zahl plus 1.'],
    ['A5', '+9', 'Plus 10 und dann 1 weniger.'],
    ['A6', 'Zehnerübergang mit 8 und 7', 'Erst bis zur 10 auffüllen, dann den Rest dazu.'],
    ['A7', 'Restliche Plusaufgaben', 'Nutze die Aufgabe, die du schon kannst.'],
    ['M1', DOT + '0, ' + DOT + '1, ' + DOT + '10', 'Mal 0 ist 0. Mal 1 bleibt die Zahl. Mal 10 hängt eine 0 an.'],
    ['M2', DOT + '2, ' + DOT + '5', 'Mal 2 ist verdoppeln. Mal 5 ist die Hälfte von mal 10.'],
    ['M3', DOT + '9', 'Mal 10 und dann einmal weniger.'],
    ['M4', 'Quadratzahlen', 'Ankerfakten: auswendig lernen.'],
    ['M5', DOT + '4', 'Doppelt verdoppeln.'],
    ['M6', DOT + '3', 'Mal 2 und einmal mehr.'],
    ['M7', '6 ' + DOT + ' 7, 6 ' + DOT + ' 8, 7 ' + DOT + ' 8', 'Vom Quadrat aus: eine Reihe mehr.']
  ];
  const IDS = SETS.map(s => s[0]);
  const setName = id => (SETS.find(s => s[0] === id) || [id, ''])[1];
  const setHint = id => (SETS.find(s => s[0] === id) || [id, '', ''])[2];
  const nextSet = id => { const i = IDS.indexOf(id); return i >= 0 && i < IDS.length - 1 ? IDS[i + 1] : id; };

  const R = n => Array.from({ length: n }, (_, i) => i);
  function candidates(sid) {
    const r11 = R(11);
    switch (sid) {
      case 'A1': return [0, 1, 2].flatMap(b => r11.map(a => [a, b]));
      case 'A2': return [1, 2, 3, 4, 5].map(a => [a, 10 - a]).concat(r11.map(a => [a, 10]));
      case 'A3': return R(8).map(i => [i + 3, i + 3]);
      case 'A4': return R(8).map(i => [i + 2, i + 3]);
      case 'A5': return r11.map(a => [a, 9]);
      case 'A6': return R(7).map(i => [8, i + 3]).concat(R(7).map(i => [7, i + 3]));
      case 'A7': return r11.flatMap(a => r11.map(b => [a, b]));
      case 'M1': return [0, 1, 10].flatMap(b => r11.map(a => [a, b]));
      case 'M2': return [2, 5].flatMap(b => r11.map(a => [a, b]));
      case 'M3': return r11.map(a => [a, 9]);
      case 'M4': return [3, 4, 6, 7, 8].map(a => [a, a]);
      case 'M5': return [3, 6, 7, 8].map(b => [4, b]);
      case 'M6': return [6, 7, 8].map(b => [3, b]);
      case 'M7': return [[6, 7], [6, 8], [7, 8]];
    }
    return [];
  }
  const PAIRS = {}, PAIR_SET = {};
  const seen = { A: new Set(), M: new Set() };
  IDS.forEach(sid => {
    const tr = sid[0], out = [];
    candidates(sid).forEach(([a, b]) => {
      const k = Math.min(a, b) + ',' + Math.max(a, b);
      if (!seen[tr].has(k)) { seen[tr].add(k); out.push([Math.min(a, b), Math.max(a, b)]); PAIR_SET[tr + k] = sid; }
    });
    PAIRS[sid] = out;
  });

  // Fakt: {t: Text, r: Ergebnis, s: Satz}
  function family(sid, [a, b], op) {
    const F = [];
    if (sid[0] === 'A') {
      const s = a + b;
      F.push(['+', a + ' + ' + b, s]); if (a !== b) F.push(['+', b + ' + ' + a, s]);
      F.push(['-', s + ' ' + MINUS + ' ' + a, b]); if (a !== b) F.push(['-', s + ' ' + MINUS + ' ' + b, a]);
    } else {
      const p = a * b;
      F.push(['*', a + ' ' + DOT + ' ' + b, p]); if (a !== b) F.push(['*', b + ' ' + DOT + ' ' + a, p]);
      if (a) F.push([':', p + ' : ' + a, b]);
      if (b && a !== b) F.push([':', p + ' : ' + b, a]);
    }
    return F.filter(f => !op || f[0] === op).map(f => ({ t: f[1], r: f[2], s: sid }));
  }
  const facts = (sid, op) => (PAIRS[sid] || []).flatMap(p => family(sid, p, op));

  // Text -> Satz und Familie (für die Faktenanalyse)
  function parseFact(t) {
    const m = String(t).match(/^(\d+) (\+|−|·|:) (\d+)$/);
    if (!m) return null;
    const x = +m[1], o = m[2], y = +m[3];
    let a, b, tr;
    if (o === '+') { a = x; b = y; tr = 'A'; }
    else if (o === MINUS) { a = y; b = x - y; tr = 'A'; }
    else if (o === DOT) { a = x; b = y; tr = 'M'; }
    else { a = y; b = y ? x / y : 0; tr = 'M'; }
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return { op: o, a: lo, b: hi, track: tr, set: PAIR_SET[tr + lo + ',' + hi] || null };
  }

  function shuffle(a, rnd) { rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function drawSeq(pools, rnd) {
    let items = [];
    pools.forEach(([pool, k]) => { if (!pool.length || k <= 0) return; let bag = []; while (bag.length < k) bag = bag.concat(shuffle(pool.slice(), rnd)); items = items.concat(bag.slice(0, k)); });
    for (let tries = 0; tries < 200; tries++) { shuffle(items, rnd); if (items.every((x, i) => i === 0 || x.t !== items[i - 1].t)) break; }
    return items;
  }
  // Wie auf den Sprintblättern: 50 % Satz, 30 % zwei Sätze davor, 20 % ältere, bei M zusätzlich 4 Plus/Minus pro 60
  function sprintItems(sid, n, rnd) {
    n = n || 60;
    const i = IDS.indexOf(sid), tr = sid[0];
    const track = IDS.slice(0, Math.max(i, 0)).filter(x => x[0] === tr);
    const cur = facts(sid), prev = track.slice(-2).flatMap(x => facts(x)), old = track.slice(0, -2).flatMap(x => facts(x));
    const scr = tr === 'M' ? Math.round(n * 4 / 60) : 0;
    const w = [[cur, 50], [prev, prev.length ? 30 : 0], [old, old.length ? 20 : 0]];
    const tot = w.reduce((s, x) => s + x[1], 0), m = n - scr;
    const counts = w.map(x => Math.round(m * x[1] / tot)); counts[0] += m - counts.reduce((s, x) => s + x, 0);
    const pools = w.map((x, k) => [x[0], counts[k]]);
    if (scr) pools.push([IDS.filter(x => x[0] === 'A').flatMap(x => facts(x)), scr]);
    return drawSeq(pools, rnd);
  }

  // Ziele in richtigen Aufgaben pro Minute
  const goalPaper = s => s.goal_paper || (s.write_rate ? Math.round(s.write_rate / 2.5) : 30);
  // App: pro Aufgabe ~1,7 Ziffern + 1× OK = 2,7 Tipps; gleiche Zwei-Drittel-Regel -> Tipptempo / 4
  const goalApp = s => s.goal_app || (s.tap_rate ? Math.max(10, Math.round(s.tap_rate / 4)) : goalPaper(s));

  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => isoLocal(new Date());
  const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  const addDays = (s, n) => new Date((dnum(s) + n) * 864e5).toISOString().slice(0, 10);
  const wday = s => new Date(dnum(s) * 864e5).getUTCDay();
  const fmtDate = s => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][wday(s)] + ' ' + (+s.slice(8, 10)) + '.' + (+s.slice(5, 7)) + '.';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  g.ST = { DOT, MINUS, SETS, IDS, setName, setHint, nextSet, PAIRS, family, facts, parseFact, shuffle, sprintItems, goalPaper, goalApp, today, dnum, addDays, wday, fmtDate, esc, pad };
})(typeof window !== 'undefined' ? window : globalThis);

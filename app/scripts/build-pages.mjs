#!/usr/bin/env node
// Baut die statische Seite für GitHub Pages:
//   app/web  →  <Ziel> (Standard: _site)
// Erzeugt config.js aus Umgebungsvariablen (in GitHub Actions aus den Secrets)
// und setzt eine Content-Security-Policy als <meta>-Tag, weil GitHub Pages
// keine eigenen HTTP-Header erlaubt.
//
//   SUPABASE_URL=https://xyz.supabase.co SUPABASE_ANON_KEY=... node app/scripts/build-pages.mjs _site
//
// Optional: SCHUELER_URL (feste Adresse der Schüler-App für die QR-Codes).
import { cpSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../web');
const out = resolve(process.argv[2] || '_site');

const fail = (msg) => { console.error(`::error::${msg}`); process.exit(1); };
const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
const schuelerUrl = (process.env.SCHUELER_URL || '').trim();

if (!url) fail('Secret SUPABASE_URL fehlt (Settings → Secrets and variables → Actions).');
if (!key) fail('Secret SUPABASE_ANON_KEY fehlt (Settings → Secrets and variables → Actions).');
let origin;
try { const u = new URL(url); if (u.protocol !== 'https:') throw 0; origin = u.origin; }
catch { fail('SUPABASE_URL muss eine https-Adresse sein, z. B. https://xyz.supabase.co'); }
if (key.startsWith('sb_secret_') || /service_role/.test(Buffer.from(key.split('.')[1] || '', 'base64').toString()))
  fail('SUPABASE_ANON_KEY ist ein geheimer Schlüssel (secret/service_role). Nur den publishable- oder anon-Key verwenden!');
if (!key.startsWith('sb_publishable_') && !key.startsWith('eyJ'))
  fail('SUPABASE_ANON_KEY sieht nicht nach einem Supabase-Schlüssel aus (erwartet sb_publishable_… oder eyJ…).');

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });
// config.example.js und eine evtl. lokale config.js nicht mitveröffentlichen
for (const f of ['config.js', 'config.example.js']) rmSync(join(out, f), { force: true });

const cfg = { supabaseUrl: url, supabaseAnonKey: key, schuelerUrl };
writeFileSync(join(out, 'config.js'),
  `/* Automatisch erzeugt beim Deployment auf GitHub Pages. */\nwindow.SPRINT_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);

const wss = origin.replace(/^https:/, 'wss:');
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src 'self' ${origin} ${wss}`,
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer">`;

for (const f of readdirSync(out).filter((f) => f.endsWith('.html'))) {
  const p = join(out, f);
  const html = readFileSync(p, 'utf8');
  if (!html.includes('<meta charset="utf-8">')) fail(`${f}: <meta charset="utf-8"> nicht gefunden`);
  writeFileSync(p, html.replace('<meta charset="utf-8">', `<meta charset="utf-8">${meta}`));
}
writeFileSync(join(out, '.nojekyll'), '');

if (!existsSync(join(out, 'index.html'))) fail('index.html fehlt im Ergebnis');
console.log(`Seite gebaut in ${out} (Supabase: ${origin})`);

// Prüft, welche Header die Apps mit neuen (sb_publishable_…) und alten (anon-JWT) Schlüsseln senden,
// und dass der Pages-Build geheime oder unbekannte Schlüssel ablehnt.
import { JSDOM } from 'jsdom';
import fs from 'fs';
import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';

const P = new URL('../', import.meta.url).pathname;
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PUB = 'sb_publishable_AbCdEfGhIjKlMnOpQrStUv_12345678';
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.sig';
const SECRET_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.sig';
const hdrs = (h) => Object.fromEntries(new Headers(h || {}).entries());

// --- Schüler-App (eigener fetch) ---
async function student(key) {
  const calls = [];
  let html = fs.readFileSync(P + 'web/schueler.html', 'utf8');
  html = html.replace('<script src="config.js"></script>', `<script>window.SPRINT_CONFIG={supabaseUrl:"https://x.supabase.co",supabaseAnonKey:${JSON.stringify(key)}}</script>`)
    .replace('<script src="shared.js"></script>', '<script>' + fs.readFileSync(P + 'web/shared.js', 'utf8') + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://app.test/schueler.html#k=ABCD&c=07&p=2468', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async (url, opts) => { calls.push({ url, h: hdrs(opts.headers) }); return { ok: true, status: 200, json: async () => ({ ok: false }) }; };
  } });
  await sleep(400);
  dom.window.close();
  return calls;
}
for (const [name, key, bearer] of [['publishable', PUB, false], ['anon-JWT', JWT, true]]) {
  const c = await student(key);
  ok(c.length > 0 && c[0].url.includes('/rest/v1/rpc/student_login'), `Schüler-App (${name}): ruft student_login auf`);
  ok(c.every((x) => x.h.apikey === key), `Schüler-App (${name}): apikey-Header gesetzt`);
  ok(c.every((x) => bearer ? x.h.authorization === 'Bearer ' + key : !('authorization' in x.h)),
    `Schüler-App (${name}): ${bearer ? 'Bearer-Token mitgesendet' : 'kein Authorization-Header'}`);
}

// --- Lehrer-App (echte supabase-js aus vendor/) ---
async function teacher(key) {
  const calls = [], warns = [];
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://app.test/lehrer.html', beforeParse(w) {
    w.fetch = async (url, opts = {}) => {
      calls.push({ url: String(url), h: hdrs(opts.headers) });
      const body = String(url).includes('/auth/v1/token')
        ? { access_token: JWT, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', email: 't@x.test' } }
        : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    w.console.warn = (...a) => warns.push(a.join(' '));
  } });
  const w = dom.window;
  w.eval(fs.readFileSync(P + 'web/vendor/supabase.js', 'utf8'));
  const sb = w.supabase.createClient('https://x.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } });
  await sb.from('classes').select('*');
  const before = calls.length;
  await sb.auth.signInWithPassword({ email: 't@x.test', password: 'pw' });
  await sb.from('classes').select('*');
  w.close();
  return { anon: calls[0], login: calls[before], afterLogin: calls[calls.length - 1], warns };
}
{
  const r = await teacher(PUB);
  ok(r.warns.every((x) => !/Unrecognized Supabase API key/.test(x)), 'Lehrer-App (publishable): supabase-js erkennt den Schlüssel');
  ok(r.anon.h.apikey === PUB, 'Lehrer-App (publishable): apikey-Header gesetzt');
  ok(r.login.url.includes('/auth/v1/token') && r.login.h.apikey === PUB, 'Lehrer-App (publishable): Login sendet apikey');
  ok(r.afterLogin.h.apikey === PUB && r.afterLogin.h.authorization === 'Bearer ' + JWT, 'Lehrer-App (publishable): nach Login Nutzer-JWT als Bearer');
  console.log('     Info: ohne Login sendet supabase-js', r.anon.h.authorization ? 'den Schlüssel auch als Bearer (Standardverhalten von supabase-js)' : 'keinen Authorization-Header');
}

// --- Pages-Build: Schlüsselprüfung ---
const build = (key) => spawnSync(process.execPath, [P + 'scripts/build-pages.mjs', fs.mkdtempSync(path.join(os.tmpdir(), 'site-'))],
  { env: { ...process.env, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: key }, encoding: 'utf8' }).status;
ok(build(PUB) === 0, 'Build akzeptiert sb_publishable_…');
ok(build(JWT) === 0, 'Build akzeptiert alten anon-Key');
ok(build('sb_secret_abc') !== 0, 'Build lehnt sb_secret_… ab');
ok(build(SECRET_JWT) !== 0, 'Build lehnt service_role-Key ab');
ok(build('irgendwas') !== 0, 'Build lehnt unbekanntes Format ab');

// --- Lehrer-Login: verständliche Fehlermeldungen (echte supabase-js, nachgebaute Server-Antworten) ---
async function loginWith(respond) {
  let html = fs.readFileSync(P + 'web/lehrer.html', 'utf8');
  const inline = (f) => '<script>' + fs.readFileSync(P + 'web/' + f, 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>';
  html = html.replace('<script src="config.js"></script>', `<script>window.SPRINT_CONFIG={supabaseUrl:"https://x.supabase.co",supabaseAnonKey:${JSON.stringify(PUB)}}</script>`)
    .replace('<script src="vendor/supabase.js"></script>', () => inline('vendor/supabase.js'))
    .replace('<script src="vendor/qrcode.js"></script>', () => inline('vendor/qrcode.js'))
    .replace('<script src="shared.js"></script>', () => inline('shared.js'));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://app.test/lehrer.html', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async (url) => { const r = respond(String(url)); if (r instanceof Error) throw r; return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } }); };
    w.console.error = () => {}; w.console.warn = () => {};
  } });
  const w = dom.window, d = w.document;
  await sleep(300);
  d.querySelector('#le').value = 'lehrer@schule.test'; d.querySelector('#lp').value = 'falsch';
  d.querySelector('#lf').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await sleep(500);
  const t = d.body.textContent; w.close(); return t;
}
const cases = [
  ['falsches Passwort', { status: 400, body: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }, /E-Mail oder Passwort falsch/],
  ['nicht bestätigt', { status: 400, body: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' } }, /noch nicht bestätigt/],
  ['E-Mail-Login aus', { status: 422, body: { code: 422, error_code: 'email_provider_disabled', msg: 'Email logins are disabled' } }, /E-Mail-Anmeldung ist in Supabase ausgeschaltet/],
  ['falscher Schlüssel', { status: 401, body: { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' } }, /SUPABASE_ANON_KEY prüfen/],
  ['nicht erreichbar', new TypeError('Failed to fetch'), /nicht erreichbar/],
];
for (const [name, resp, re] of cases) {
  const t = await loginWith(() => resp);
  ok(re.test(t), `Lehrer-Login (${name}): ${(t.match(re) || [t.slice(0, 120).replace(/\s+/g, ' ')])[0]}`);
}

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { JSDOM } from 'jsdom';
import fs from 'fs';
const P=new URL('../', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });
const T1='11111111-1111-1111-1111-111111111111';
await db.exec(`create schema auth; create schema extensions; create table auth.users(id uuid primary key); insert into auth.users values ('${T1}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin; grant usage on schema public, extensions, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(fs.readFileSync(P+'supabase/schema.sql','utf8'));
const as = async (role, uid, sql, params=[]) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`); try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); } };
const [cls]=await as('authenticated',T1,`insert into classes(name) values ('6b') returning *`);
const [st]=await as('authenticated',T1,`insert into students(class_id,code,set_id,stage,write_rate) values ($1,'07','M5',2,90) returning *`,[cls.id]);
await as('authenticated',T1,`select teacher_set_pin($1,'2468')`,[st.id]);

let html=fs.readFileSync(P+'web/schueler.html','utf8');
html=html.replace('<script src="config.js"></script>','<script>window.SPRINT_CONFIG={supabaseUrl:"https://x.test",supabaseAnonKey:"k"}</script>')
         .replace('<script src="shared.js"></script>','<script>'+fs.readFileSync(P+'web/shared.js','utf8')+'</script>');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://app.test/schueler.html#k='+cls.join_code+'&c=07',pretendToBeVisual:true,beforeParse(w){
  let clock=0; w.__clock=v=>clock=v; w.__adv=d=>clock+=d; w.performance.now=()=>clock;
  w.requestAnimationFrame=cb=>setTimeout(()=>cb(clock),5); w.cancelAnimationFrame=id=>clearTimeout(id);
  w.fetch=async(url,opts)=>{const fn=url.split('/rpc/')[1];const a=JSON.parse(opts.body);const keys=Object.keys(a);
    const sql=`select public.${fn}(${keys.map((k,i)=>k+'=>$'+(i+1)+(k==='p_attempts'?'::jsonb':'')).join(',')}) j`;
    const vals=keys.map(k=>k==='p_attempts'?JSON.stringify(a[k]):a[k]);
    const rows=await as('anon',null,sql,vals); return {ok:true,status:200,json:async()=>rows[0].j};};
}});
const w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const press=k=>{const b=d.querySelector(`.pad button[data-k="${k}"]`);if(!b)throw new Error('no key '+k+' in '+d.body.textContent.slice(0,80));b.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}))};
const ok=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)process.exitCode=1};
await sleep(300);
ok(d.body.textContent.includes('Kürzel')&&d.body.textContent.includes(cls.join_code),'login screen prefilled');
for(const k of '2460') press(k); press('ok'); await sleep(400);
ok(d.body.textContent.includes('nicht geklappt'),'wrong pin message');
for(const k of '2468') press(k); press('ok'); await sleep(500);
ok(d.body.textContent.includes('Hallo 07'),'home after login');
ok(d.body.textContent.includes('Tipptest'),'tipptest prompt shown');
// Tipptest
d.querySelector('#tipp').click(); await sleep(2700);
w.__clock(0);
for(let i=0;i<20;i++){ press(d.querySelector('#tg').textContent); }
press('5'===d.querySelector('#tg').textContent?'4':'5'); // one miss
w.__adv(30001); await sleep(400);
ok(/Tipptest: 40 Ziffern/.test(d.body.textContent),'tipp result 40/min ('+d.body.textContent.match(/Tipptest: \d+/)+')');
ok(d.body.textContent.includes('Ziel in der App ist jetzt 10'),'app goal 10');
// Sprint
w.__clock(0); d.querySelector('#go').click(); await sleep(2700);
const solve=t=>{const [x,o,y]=t.split(' ');return o==='+'?+x+ +y:o==='−'?x-y:o==='·'?x*y:x/y};
for(let i=0;i<6;i++){ const t=d.querySelector('#prob').textContent.split(' =')[0]; let r=solve(t); if(i===2) r=r+1; w.__adv(1500); for(const ch of String(r)) press(ch); press('ok'); }
press('ok'); // skip one -> Lücke
w.__adv(60001); await sleep(500);
const txt=d.body.textContent;
ok(/5richtig2Fehler/.test(txt.replace(/\s/g,'')),'result shown: '+txt.replace(/\s+/g,' ').slice(0,90));
await sleep(300);
const rows=await db.query(`select mode,correct,errors,medium from sprints order by id`);
ok(rows.rows.length===2&&rows.rows[1].correct===5&&rows.rows[1].errors===2,'db rows '+JSON.stringify(rows.rows));
const at=await db.query(`select count(*)::int n, sum(case when ok then 1 else 0 end)::int k from attempts`);
ok(at.rows[0].n===7&&at.rows[0].k===5,'attempts '+JSON.stringify(at.rows[0]));
// repair
d.querySelector('#rep').click(); await sleep(100);
ok(d.body.textContent.includes('Anschauen'),'repair view');
press('ok'); await sleep(50);
ok(d.body.textContent.includes('aus dem Kopf'),'repair ask');
ok(errs.length===0,'no script errors '+errs.join('|'));

// ---- Teil 2: QR-Link mit PIN, gemeinsames Gerät, Unterrichtssprint ----
const win=(await as('authenticated',T1,`select teacher_open_window($1,12) j`,[cls.id]))[0].j;
const dom2=new JSDOM(html,{runScripts:'dangerously',url:'https://app.test/schueler.html#k='+cls.join_code+'&c=07&p=2468&geraet=gemeinsam',pretendToBeVisual:true,beforeParse(w){
  let clock=0; w.__clock=v=>clock=v; w.__adv=d=>clock+=d; w.performance.now=()=>clock;
  w.requestAnimationFrame=cb=>setTimeout(()=>cb(clock),5); w.cancelAnimationFrame=id=>clearTimeout(id);
  w.fetch=async(url,opts)=>{const fn=url.split('/rpc/')[1];const a=JSON.parse(opts.body);const keys=Object.keys(a);
    const sql=`select public.${fn}(${keys.map((k,i)=>k+'=>$'+(i+1)+(k==='p_attempts'?'::jsonb':'')).join(',')}) j`;
    const vals=keys.map(k=>k==='p_attempts'?JSON.stringify(a[k]):a[k]);
    const rows=await as('anon',null,sql,vals); return {ok:true,status:200,json:async()=>rows[0].j};};
}});
const w2=dom2.window,d2=w2.document;const errs2=[];w2.addEventListener('error',e=>errs2.push(e.message));
const press2=k=>{const b=d2.querySelector(`.pad button[data-k="${k}"]`);if(!b)throw new Error('no key '+k+' in '+d2.body.textContent.slice(0,80));b.dispatchEvent(new w2.MouseEvent('pointerdown',{bubbles:true}))};
await sleep(700);
ok(d2.body.textContent.includes('Hallo 07'),'Auto-Login über QR-Link mit PIN');
ok(!w2.location.hash.includes('p='),'PIN aus der Adresszeile entfernt');
ok(w2.localStorage.getItem('st-token')===null,'gemeinsames Gerät speichert keine Anmeldung');
ok(d2.body.textContent.includes('Unterrichtssprint ist freigegeben'),'Freigabe-Karte sichtbar, keine Codeeingabe');
w2.__clock(0);
d2.querySelector('#cls').click(); await sleep(2900);
for(let i=0;i<4;i++){ const t=d2.querySelector('#prob').textContent.split(' =')[0]; w2.__adv(1200); for(const ch of String(solve(t))) press2(ch); press2('ok'); }
w2.__adv(60001); await sleep(600);
ok(d2.body.textContent.includes('zählt als Unterrichtssprint'),'Ergebnis: zählt als Unterrichtssprint');
const ic=await db.query(`select in_class, correct from sprints where mode='sprint' and medium='app' order by id desc limit 1`);
ok(ic.rows[0].in_class===true&&ic.rows[0].correct===4,'DB: in_class '+JSON.stringify(ic.rows[0]));
d2.querySelector('#home').click(); await sleep(400);
ok(d2.body.textContent.includes('PIN eintippen'),'nach Fertig abgemeldet (gemeinsames Gerät)');
ok(errs2.length===0,'keine Skriptfehler Teil 2 '+errs2.join('|'));
process.exit();

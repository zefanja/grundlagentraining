import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
const db = new PGlite({ extensions: { pgcrypto } });
const T1='11111111-1111-1111-1111-111111111111', T2='22222222-2222-2222-2222-222222222222';
await db.exec(`
create schema auth; create schema extensions;
create table auth.users(id uuid primary key);
insert into auth.users values ('${T1}'),('${T2}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create role anon nologin; create role authenticated nologin;
grant usage on schema public, extensions, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`);
const SCHEMA=fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url),'utf8');
await db.exec(SCHEMA);
await db.exec(SCHEMA); // zweimal: Skript muss für bestehende Installationen wiederholbar sein
const as = async (role, uid, sql, params=[]) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
};
const ok=(c,m)=>{console.log((c?'OK  ':'FAIL'),m); if(!c) process.exitCode=1};
// teacher 1 creates class + students
const [cls] = await as('authenticated',T1,`insert into classes(name) values ('5a') returning *`);
ok(/^[A-Z2-9]{6}$/.test(cls.join_code),'join code '+cls.join_code);
const st = await as('authenticated',T1,`insert into students(class_id,code,write_rate) values ($1,'01',90),($1,'02',80) returning id,code`,[cls.id]);
ok(st.length===2,'students inserted');
// teacher 2 cannot see
ok((await as('authenticated',T2,`select * from students`)).length===0,'teacher2 sees no students');
let e=null; try{ await as('authenticated',T2,`insert into students(class_id,code) values ($1,'x')`,[cls.id]) }catch(x){e=x}
ok(!!e,'teacher2 cannot insert into foreign class');
e=null; try{ await as('authenticated',T2,`select teacher_set_pin($1,'1234')`,[st[0].id]) }catch(x){e=x}
ok(!!e,'teacher2 cannot set pin');
// anon cannot read tables
e=null; try{ await as('anon',null,`select * from students`) }catch(x){e=x}
ok(!!e,'anon blocked from students table');
// set pin
await as('authenticated',T1,`select teacher_set_pin($1,'4711')`,[st[0].id]);
ok((await as('authenticated',T1,`select has_pin from students where id=$1`,[st[0].id]))[0].has_pin===true,'has_pin set');
e=null; try{ await as('authenticated',T1,`select * from student_secrets`) }catch(x){e=x}
ok(!!e,'teacher cannot read pin hashes');
// login
let r=(await as('anon',null,`select student_login($1,'01','0000') j`,[cls.join_code.toLowerCase()]))[0].j;
ok(r.error==='login_failed','wrong pin rejected');
r=(await as('anon',null,`select student_login($1,'02','0000') j`,[cls.join_code]))[0].j;
ok(r.error==='no_pin','no pin student');
r=(await as('anon',null,`select student_login($1,' 01 ','4711') j`,[cls.join_code]))[0].j;
ok(!!r.token,'login ok');
const tok=r.token;
let s=(await as('anon',null,`select student_state($1) j`,[tok]))[0].j;
ok(s.code==='01'&&s.set==='A1'&&s.write_rate===90,'state '+JSON.stringify(s).slice(0,90));
r=(await as('anon',null,`select student_save($1,'sprint','A1',31,2,$2::jsonb) j`,[tok,JSON.stringify([{f:'3 + 4',s:'A4',g:7,ok:true,ms:1200},{f:'8 · 7',s:'M7',g:54,ok:false,ms:4100}])]))[0].j;
ok(r.ok,'save sprint');
await as('anon',null,`select student_save($1,'tipp','A1',140,0,'[]'::jsonb) j`,[tok]);
s=(await as('anon',null,`select student_state($1) j`,[tok]))[0].j;
ok(s.tap_rate===140&&s.recent.length===1,'tipp saved, recent 1');
ok((await as('anon',null,`select student_state('bad') j`))[0].j.error==='session','bad token');
// teacher sees app sprint + attempts + stats
ok((await as('authenticated',T1,`select * from sprints`)).length===2,'teacher sees 2 sprints');
const fs1=await as('authenticated',T1,`select * from teacher_fact_stats($1)`,[cls.id]);
ok(fs1.length===2,'fact stats '+JSON.stringify(fs1));
ok((await as('authenticated',T2,`select * from teacher_fact_stats($1)`,[cls.id])).length===0,'teacher2 no stats');
// paper upsert + delete
await as('authenticated',T1,`select teacher_paper($1,'2026-11-25','T','A1',30,1)`,[st[0].id]);
await as('authenticated',T1,`select teacher_paper($1,'2026-11-25','T','A1',33,0)`,[st[0].id]);
let p=await as('authenticated',T1,`select correct from sprints where medium='papier'`);
ok(p.length===1&&p[0].correct===33,'paper upsert');
await as('authenticated',T1,`select teacher_paper($1,'2026-11-25','T','A1',null,null)`,[st[0].id]);
ok((await as('authenticated',T1,`select * from sprints where medium='papier'`)).length===0,'paper delete');
// lockout
for(let i=0;i<5;i++) await as('anon',null,`select student_login($1,'01','9999') j`,[cls.join_code]);
r=(await as('anon',null,`select student_login($1,'01','4711') j`,[cls.join_code]))[0].j;
ok(r.error==='locked','locked after 5 fails');
// reset pin unlocks + kills session
await as('authenticated',T1,`select teacher_set_pin($1,'1357')`,[st[0].id]);
ok((await as('anon',null,`select student_state($1) j`,[tok]))[0].j.error==='session','old session invalid after pin reset');
r=(await as('anon',null,`select student_login($1,'01','1357') j`,[cls.join_code]))[0].j;
ok(!!r.token,'login after reset');
// teacher update student set
await as('authenticated',T1,`update students set set_id='M4', stage=2 where id=$1`,[st[0].id]);
e=null; try{ await as('anon',null,`select _sid($1)`,[r.token]) }catch(x){e=x}
ok(!!e,'anon cannot call _sid');
e=null; try{ await as('anon',null,`select teacher_set_pin($1,'1111')`,[st[0].id]) }catch(x){e=x}
ok(!!e,'anon cannot call teacher_set_pin');

// ---- Unterrichtsfenster ----
const tok2=r.token;
let sv=(await as('anon',null,`select student_save($1,'sprint','M4',20,1,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.ok&&sv.in_class===false,'ohne Freigabe: Übung');
ok((await as('anon',null,`select student_state($1) j`,[tok2]))[0].j.window_open===false,'window_open false');
e=null; try{ await as('authenticated',T2,`select teacher_open_window($1)`,[cls.id]) }catch(x){e=x}
ok(!!e,'teacher2 kann nicht freigeben');
const w=(await as('authenticated',T1,`select teacher_open_window($1,12) j`,[cls.id]))[0].j;
ok(!!w.until,'Freigabe bis '+w.until);
ok((await as('anon',null,`select student_state($1) j`,[tok2]))[0].j.window_open===true,'window_open true');
sv=(await as('anon',null,`select student_save($1,'sprint','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.in_class===true,'Sprint während Freigabe zählt');
sv=(await as('anon',null,`select student_save($1,'ueben','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.in_class===false,'Üben zählt nie');
await as('authenticated',T1,`select teacher_close_window($1)`,[cls.id]);
sv=(await as('anon',null,`select student_save($1,'sprint','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.in_class===true,'Nachlauf 3 Minuten nach Beenden');
await db.exec(`update classes set window_until = now() - interval '4 minutes'`);
sv=(await as('anon',null,`select student_save($1,'sprint','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.in_class===false,'nach Nachlauf: Übung');
// Stundenplan: jetzt (deutsche Zeit) liegt im Fenster
await as('authenticated',T1,`update classes set schedule = jsonb_build_array(jsonb_build_object('dow', extract(isodow from now() at time zone 'Europe/Berlin')::int, 'start', to_char((now() at time zone 'Europe/Berlin') - interval '5 minutes','HH24:MI'), 'min', 15)) where id=$1`,[cls.id]);
ok((await as('anon',null,`select student_state($1) j`,[tok2]))[0].j.window_open===true,'Stundenplan-Fenster offen');
sv=(await as('anon',null,`select student_save($1,'sprint','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.in_class===true,'Sprint im Stundenplan-Fenster zählt');
await as('authenticated',T1,`update classes set schedule = jsonb_build_array(jsonb_build_object('dow', (extract(isodow from now() at time zone 'Europe/Berlin')::int % 7) + 1, 'start', '07:50', 'min', 15)) where id=$1`,[cls.id]);
ok((await as('anon',null,`select student_state($1) j`,[tok2]))[0].j.window_open===false,'anderer Wochentag: zu');
await as('authenticated',T1,`update classes set schedule = '[{"dow":"x","start":"25:99","min":"viel"}, 7]'::jsonb where id=$1`,[cls.id]);
sv=(await as('anon',null,`select student_save($1,'sprint','M4',25,0,'[]'::jsonb) j`,[tok2]))[0].j;
ok(sv.ok&&sv.in_class===false,'kaputter Stundenplan bricht nichts');
await as('authenticated',T1,`select teacher_paper($1,'2026-11-20','K','M4',30,0)`,[st[0].id]);
ok((await as('authenticated',T1,`select in_class from sprints where medium='papier'`))[0].in_class===true,'Papier zählt immer');
// delete class cascades
await as('authenticated',T1,`delete from classes where id=$1`,[cls.id]);
ok((await db.query(`select count(*)::int n from sprints`)).rows[0].n===0,'cascade delete');

import { JSDOM } from 'jsdom'; import fs from 'fs';
const P=new URL('../web/', import.meta.url).pathname;
let html=fs.readFileSync(P+'lehrer.html','utf8');
html=html.replace('<script src="config.js"></script>','<script>window.SPRINT_CONFIG={supabaseUrl:"https://x.test",supabaseAnonKey:"k"}</script>')
 .replace('<script src="vendor/supabase.js"></script>','<script>window.supabase={createClient:()=>window.__fake}</script>')
 .replace('<script src="vendor/qrcode.js"></script>',()=>'<script>'+fs.readFileSync(P+'vendor/qrcode.js','utf8')+'</script>')
 .replace('<script src="shared.js"></script>',()=>'<script>'+fs.readFileSync(P+'shared.js','utf8')+'</script>');
const today=new Date().toISOString().slice(0,10);
const add=(s,n)=>new Date(Date.parse(s)+n*864e5).toISOString().slice(0,10);
const T={classes:[{id:'c1',name:'6b',join_code:'K7M3QX',created_at:'1'}],
 students:[{id:'s1',class_id:'c1',code:'01',grp:'B',write_rate:90,tap_rate:120,goal_paper:0,goal_app:0,set_id:'M5',stage:2,since:add(today,-20),done:[{set:'M4',d:add(today,-21),checks:[]}],diag:[],has_pin:true},
           {id:'s2',class_id:'c1',code:'02',grp:'A',write_rate:0,tap_rate:0,goal_paper:0,goal_app:0,set_id:'A6',stage:1,since:add(today,-3),done:[],diag:[],has_pin:false}],
 sprints:[]};
let id=1;for(let i=10;i>=0;i--){T.sprints.push({id:id++,student_id:'s1',d:add(today,-i),set_id:'M5',correct:28+i%3,errors:1,kind:'T',medium:'papier',mode:'sprint',created_at:add(today,-i)});T.sprints.push({id:id++,student_id:'s1',d:add(today,-i),set_id:'M5',correct:24+(10-i),errors:0,kind:'T',medium:'app',mode:'sprint',created_at:add(today,-i)+'z'});}
const calls=[];
class B{constructor(t){this.t=t;this.f=[];this.op='select';this.p=null;this.one=false;this.rng=null}
 select(){return this} insert(p){this.op='insert';this.p=Array.isArray(p)?p:[p];return this} update(p){this.op='update';this.p=p;return this} delete(){this.op='delete';return this}
 eq(k,v){this.f.push(r=>r[k]===v);return this} in(k,v){this.f.push(r=>v.includes(r[k]));return this} gte(k,v){this.f.push(r=>r[k]>=v);return this}
 order(){return this} range(a,b){this.rng=[a,b];return this} single(){this.one=true;return this}
 exec(){const tb=T[this.t];calls.push(this.op+':'+this.t);
  if(this.op==='insert'){const rows=this.p.map(r=>({id:'n'+(id++),join_code:'NEW123',grp:'B',write_rate:0,tap_rate:0,goal_paper:0,goal_app:0,set_id:'A1',stage:1,since:today,done:[],diag:[],has_pin:false,...r}));tb.push(...rows);return this.one?rows[0]:rows}
  const m=tb.filter(r=>this.f.every(f=>f(r)));
  if(this.op==='update'){m.forEach(r=>Object.assign(r,this.p));return m}
  if(this.op==='delete'){T[this.t]=tb.filter(r=>!m.includes(r));return m}
  return this.rng?m.slice(this.rng[0],this.rng[1]+1):m}
 then(res,rej){return Promise.resolve({data:this.exec(),error:null}).then(res,rej)}}
const rpcs={teacher_paper:a=>{calls.push('paper:'+JSON.stringify(a));return{ok:true}},teacher_set_pin:a=>{calls.push('pin:'+a.p_student);return{ok:true}},
 teacher_fact_stats:a=>[{fact:'7 · 8',set_id:'M7',n:12,errors:4,median_ms:3800},{fact:'56 : 8',set_id:'M7',n:6,errors:1,median_ms:3100},{fact:'4 · 6',set_id:'M5',n:9,errors:0,median_ms:1200},{fact:'8 + 5',set_id:'A6',n:5,errors:1,median_ms:2400}]};
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://app.test/lehrer.html#erfassen',pretendToBeVisual:true,beforeParse(w){
 w.__fake={auth:{getSession:async()=>({data:{session:{user:{id:'t'}}}}),signOut:async()=>{}},from:t=>new B(t),rpc:(fn,a)=>Promise.resolve({data:rpcs[fn](a),error:null})};
 w.ResizeObserver=class{constructor(cb){this.cb=cb}observe(){setTimeout(()=>this.cb(),0)}disconnect(){}};
 w.print=()=>calls.push('print'); w.confirm=()=>true;
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 700}});Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 300}});
}});
const w=dom.window,d=w.document;const errs=[];w.addEventListener('error',e=>errs.push(e.message));w.addEventListener('unhandledrejection',e=>errs.push('rej '+e.reason));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const ok=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)process.exitCode=1};
const go=async h=>{w.location.hash=h;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await sleep(80)};
const click=sel=>d.querySelector(sel).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
await sleep(300);
ok(d.querySelectorAll('#sheet tbody tr').length===2,'erfassen rows');
ok(/Kriterium erreicht/.test(d.body.textContent),'criterion chip (app) '+d.querySelector('#sheet .hn').textContent);
const inp=d.querySelector('#sheet tr[data-sid=s2] input[data-f=correct]');inp.value='17';inp.dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(50);
ok(calls.some(c=>c.startsWith('paper:')&&c.includes('"p_correct":17')),'paper rpc');
ok(d.querySelector('#figs').textContent.includes('1 / 2'),'header counts '+d.querySelector('#figs').textContent.slice(0,40));
await go('klasse'); ok(d.querySelector('main table tbody tr')!=null,'klasse table');
await go('schueler'); await sleep(100);
ok(d.querySelector('#chart').innerHTML.includes('polyline'),'chart drawn');
ok(d.querySelector('#chart').innerHTML.includes('Ziel App'),'two goals');
ok(d.querySelector('#stufacts table')!=null,'student facts table');
await go('fakten'); await sleep(100);
ok(d.querySelector('.hm')!=null&&d.querySelector('#worst table')!=null,'heatmap + worst');
const cell=[...d.querySelectorAll('.hm td')].find(td=>td.textContent==='3,6');ok(!!cell,'7·8 family cell 3,6 s (weighted)');
click('[data-act=op][data-o=A]');await sleep(100);ok(d.querySelector('.hm')!=null,'addition heatmap');
await go('verwalten');
ok(d.body.textContent.includes('K7M3QX'),'join code shown');
d.querySelector('#n-stu').value='03\n04\n01';click('[data-act=addstu]');await sleep(100);
ok(d.querySelectorAll('#stutab tbody tr').length===4,'students added (dupe skipped)');
click('[data-act=pins-missing]');await sleep(150);
ok(calls.filter(c=>c.startsWith('pin:')).length===3,'3 pins created');
ok(d.querySelectorAll('.pinv').length>=4,'pins visible');
click('[data-act=cards]');await sleep(50);
ok(calls.includes('print')&&d.querySelector('#print .card svg')!=null,'cards with QR printed');
ok(d.querySelector('#print').textContent.includes('#')===false,'url text ok');
const sel=d.querySelector('#stutab tr[data-sid=s2] select[data-f=set_id]');sel.value='A7';sel.dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(50);
ok(T.students.find(s=>s.id==='s2').set_id==='A7','student set updated');
await go('erfassen');click('[data-act=set][data-sid=s1]');await sleep(100);
ok(T.students[0].set_id==='M6'&&T.students[0].done.length===2,'advance set');
ok(errs.length===0,'no errors '+errs.join(' | '));
process.exit();

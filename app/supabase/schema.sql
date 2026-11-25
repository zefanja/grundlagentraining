-- =====================================================================
-- Sprint-Tracker Grundaufgaben · Supabase-Schema
-- Einmal im SQL-Editor von Supabase ausführen (Cloud oder selbst gehostet).
-- Lehrkräfte melden sich über Supabase Auth an (E-Mail + Passwort).
-- Schüler haben KEINE Auth-Konten: Login mit Klassencode + Kürzel + PIN,
-- danach ein zufälliges Sitzungs-Token. Schüler erreichen Daten nur über
-- die Funktionen student_* (SECURITY DEFINER). Keine Klarnamen speichern.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Datum in deutscher Zeit (wichtig um Mitternacht)
create or replace function public.local_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Berlin')::date $$;

-- Klassencode ohne verwechselbare Zeichen (kein 0/O, 1/I/L)
create or replace function public.gen_join_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  b bytea := gen_random_bytes(6);
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(name) between 1 and 40),
  join_code  text not null unique default public.gen_join_code(),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  code        text not null check (length(code) between 1 and 12),   -- Kürzel, kein Name
  grp         text not null default 'B' check (grp in ('A','B','C')),
  write_rate  int  not null default 0 check (write_rate between 0 and 400),  -- Ziffern/min auf Papier
  tap_rate    int  not null default 0 check (tap_rate between 0 and 600),    -- Ziffern/min auf der App-Tastatur
  goal_paper  int  not null default 0 check (goal_paper between 0 and 200),  -- 0 = automatisch
  goal_app    int  not null default 0 check (goal_app between 0 and 200),    -- 0 = automatisch
  set_id      text not null default 'A1' check (set_id ~ '^[AM][1-7]$'),
  stage       int  not null default 1 check (stage in (1,2)),
  since       date not null default public.local_today(),
  done        jsonb not null default '[]'::jsonb,   -- [{set,d,checks:[d,...]}]
  diag        jsonb not null default '[]'::jsonb,   -- [{label,d,add,sub,mul,div}]
  has_pin     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (class_id, code)
);

-- PIN-Hash getrennt: für Lehrkräfte nicht lesbar
create table if not exists public.student_secrets (
  student_id   uuid primary key references public.students(id) on delete cascade,
  pin_hash     text not null,
  failed       int  not null default 0,
  locked_until timestamptz
);

create table if not exists public.sessions (
  token      text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index if not exists sessions_student on public.sessions(student_id);

create table if not exists public.sprints (
  id         bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  d          date not null default public.local_today(),
  set_id     text not null check (set_id ~ '^[AME][1-7]$'),
  correct    int  not null check (correct between 0 and 600),
  errors     int  not null default 0 check (errors between 0 and 300),
  kind       text not null default 'T' check (kind in ('T','K')),           -- Tagessprint / Kontrollsprint
  medium     text not null check (medium in ('papier','app')),
  mode       text not null default 'sprint' check (mode in ('sprint','ueben','tipp')),
  created_at timestamptz not null default now()
);
create index if not exists sprints_student_d on public.sprints(student_id, d);
-- Papier: höchstens ein Wert pro Kind, Tag und Art
create unique index if not exists sprints_paper_once on public.sprints(student_id, d, kind) where medium = 'papier';

-- Einzelne Antworten aus der App (für die Faktenanalyse)
create table if not exists public.attempts (
  id         bigint generated always as identity primary key,
  sprint_id  bigint not null references public.sprints(id) on delete cascade,
  student_id uuid   not null references public.students(id) on delete cascade,
  fact       text   not null check (length(fact) <= 16),
  set_id     text   not null,
  given      int,
  ok         boolean not null,
  ms         int    not null check (ms between 0 and 600000),
  created_at timestamptz not null default now()
);
create index if not exists attempts_student_t on public.attempts(student_id, created_at);

-- Erweiterung v2: Unterrichtsfenster (gezählte App-Sprints nur im Unterricht)
-- Zwei Wege: Lehrkraft gibt frei (window_until) oder feste Zeiten pro Klasse (schedule).
-- Die ALTER-Befehle machen das Skript auch für bestehende Installationen nutzbar.
alter table public.classes add column if not exists window_until timestamptz;
alter table public.classes add column if not exists schedule jsonb not null default '[]'::jsonb;  -- [{dow:1..7, start:'07:50', min:15}]
alter table public.sprints add column if not exists in_class boolean not null default false;
update public.sprints set in_class = true where medium = 'papier' and not in_class;

-- ---------------------------------------------------------------------
-- Zeilenschutz (RLS): Lehrkräfte sehen nur eigene Klassen
-- ---------------------------------------------------------------------
alter table public.classes         enable row level security;
alter table public.students        enable row level security;
alter table public.student_secrets enable row level security;
alter table public.sessions        enable row level security;
alter table public.sprints         enable row level security;
alter table public.attempts        enable row level security;

create or replace function public.owns_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s join classes c on c.id = s.class_id
                 where s.id = sid and c.teacher = auth.uid())
$$;

drop policy if exists t_classes on public.classes;
create policy t_classes on public.classes for all to authenticated
  using (teacher = auth.uid()) with check (teacher = auth.uid());

drop policy if exists t_students on public.students;
create policy t_students on public.students for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher = auth.uid()));

drop policy if exists t_sprints on public.sprints;
create policy t_sprints on public.sprints for all to authenticated
  using (public.owns_student(student_id)) with check (public.owns_student(student_id));

drop policy if exists t_attempts on public.attempts;
create policy t_attempts on public.attempts for select to authenticated
  using (public.owns_student(student_id));
drop policy if exists t_attempts_del on public.attempts;
create policy t_attempts_del on public.attempts for delete to authenticated
  using (public.owns_student(student_id));
-- student_secrets und sessions: keine Policies = kein direkter Zugriff

-- ---------------------------------------------------------------------
-- Interne Hilfsfunktion: Token -> Schüler
-- ---------------------------------------------------------------------
create or replace function public._sid(p_token text) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from sessions where token = p_token and expires_at > now()
$$;

-- Ist für die Klasse gerade Unterrichtszeit? (Freigabe oder Stundenplan, deutsche Zeit)
create or replace function public.class_window_open(p_class uuid, p_grace interval default interval '0')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c
     where c.id = p_class
       and ( coalesce(c.window_until + p_grace > now(), false)
          or exists (
               select 1 from jsonb_array_elements(case when jsonb_typeof(c.schedule) = 'array' then c.schedule else '[]'::jsonb end) e
                where case when coalesce(e->>'dow', '') ~ '^[1-7]$'
                             and coalesce(e->>'start', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                             and coalesce(e->>'min', '') ~ '^[0-9]{1,3}$'
                           then (e->>'dow')::int = extract(isodow from (now() at time zone 'Europe/Berlin'))::int
                            and (now() at time zone 'Europe/Berlin')::time >= (e->>'start')::time
                            and (now() at time zone 'Europe/Berlin') < (date_trunc('day', now() at time zone 'Europe/Berlin') + (e->>'start')::time
                                                                         + make_interval(mins => (e->>'min')::int) + p_grace)
                           else false end)))
$$;

-- ---------------------------------------------------------------------
-- Schüler-Funktionen (anonym aufrufbar, geschützt durch PIN bzw. Token)
-- ---------------------------------------------------------------------
create or replace function public.student_login(p_join text, p_code text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  sid uuid; sec record; tok text;
begin
  select st.id into sid from students st join classes c on c.id = st.class_id
   where c.join_code = upper(trim(p_join)) and lower(st.code) = lower(trim(p_code));
  if sid is null then return json_build_object('error', 'login_failed'); end if;

  select * into sec from student_secrets where student_id = sid for update;
  if not found then return json_build_object('error', 'no_pin'); end if;
  if sec.locked_until is not null and sec.locked_until > now() then
    return json_build_object('error', 'locked', 'until', sec.locked_until);
  end if;

  if sec.pin_hash <> crypt(coalesce(p_pin, ''), sec.pin_hash) then
    update student_secrets
       set failed = sec.failed + 1,
           locked_until = case when sec.failed + 1 >= 5 then now() + interval '15 minutes' else null end
     where student_id = sid;
    return json_build_object('error', 'login_failed');
  end if;

  update student_secrets set failed = 0, locked_until = null where student_id = sid;
  delete from sessions where student_id = sid and expires_at <= now();
  insert into sessions(student_id) values (sid) returning token into tok;
  return json_build_object('token', tok);
end $$;

create or replace function public.student_state(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare sid uuid := _sid(p_token); r json;
begin
  if sid is null then return json_build_object('error', 'session'); end if;
  select json_build_object(
    'code', s.code, 'class', c.name, 'set', s.set_id, 'stage', s.stage, 'since', s.since,
    'grp', s.grp, 'write_rate', s.write_rate, 'tap_rate', s.tap_rate,
    'goal_paper', s.goal_paper, 'goal_app', s.goal_app, 'done', s.done,
    'today', local_today(),
    'window_open', class_window_open(c.id),
    'recent', (select coalesce(json_agg(x order by x.created_at), '[]'::json) from (
                 select d, set_id, correct, errors, medium, in_class, created_at from sprints
                  where student_id = s.id and mode = 'sprint'
                  order by created_at desc limit 40) x)
  ) into r
  from students s join classes c on c.id = s.class_id where s.id = sid;
  return r;
end $$;

drop function if exists public.student_save(text,text,text,int,int,jsonb);
create or replace function public.student_save(
  p_token text, p_mode text, p_set text, p_correct int, p_errors int,
  p_attempts jsonb default '[]'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare sid uuid := _sid(p_token); spr bigint; n_today int; inc boolean := false;
begin
  if sid is null then return json_build_object('error', 'session'); end if;
  if p_mode not in ('sprint','ueben','tipp') then return json_build_object('error', 'mode'); end if;
  if p_set !~ '^[AM][1-7]$' then return json_build_object('error', 'set'); end if;
  select count(*) into n_today from sprints where student_id = sid and d = local_today() and medium = 'app';
  if n_today >= 80 then return json_build_object('error', 'limit'); end if;

  -- Gezählt (in_class) nur während Freigabe oder Stundenplan-Fenster (+3 Minuten für Sprint und Reparatur)
  if p_mode = 'sprint' then
    select class_window_open(st.class_id, interval '3 minutes') into inc from students st where st.id = sid;
  end if;

  insert into sprints(student_id, set_id, correct, errors, kind, medium, mode, in_class)
  values (sid, p_set, least(greatest(coalesce(p_correct,0),0),600), least(greatest(coalesce(p_errors,0),0),300), 'T', 'app', p_mode, inc)
  returning id into spr;

  if p_mode = 'tipp' then
    update students set tap_rate = least(greatest(coalesce(p_correct,0),0),600) where id = sid;
  end if;

  if jsonb_typeof(p_attempts) = 'array' then
    insert into attempts(sprint_id, student_id, fact, set_id, given, ok, ms)
    select spr, sid, left(x.f, 16), left(coalesce(x.s, p_set), 4), x.g, coalesce(x.ok, false),
           least(greatest(coalesce(x.ms, 0), 0), 600000)
      from (select * from jsonb_to_recordset(p_attempts) as t(f text, s text, g int, ok boolean, ms int) limit 400) x
     where x.f is not null;
  end if;
  return json_build_object('ok', true, 'id', spr, 'in_class', inc);
end $$;

drop function if exists public.student_check_code(text,text);

create or replace function public.student_logout(p_token text)
returns json language sql security definer set search_path = public as $$
  delete from sessions where token = p_token returning json_build_object('ok', true)
$$;

-- ---------------------------------------------------------------------
-- Lehrkraft-Funktionen
-- ---------------------------------------------------------------------
create or replace function public.teacher_set_pin(p_student uuid, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  if not owns_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN: 4 bis 8 Ziffern' using errcode = '22023'; end if;
  insert into student_secrets(student_id, pin_hash) values (p_student, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (student_id) do update set pin_hash = excluded.pin_hash, failed = 0, locked_until = null;
  update students set has_pin = true where id = p_student;
  delete from sessions where student_id = p_student;   -- alte Geräte abmelden
  return json_build_object('ok', true);
end $$;

-- Unterrichtssprint freigeben: App-Sprints der Klasse zählen für p_minutes Minuten
drop function if exists public.teacher_open_window(uuid, int, boolean);
create or replace function public.teacher_open_window(p_class uuid, p_minutes int default 12)
returns json language plpgsql security definer set search_path = public as $$
declare u timestamptz;
begin
  if not exists (select 1 from classes where id = p_class and teacher = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  u := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 12), 1), 45));
  update classes set window_until = u where id = p_class;
  return json_build_object('until', u);
end $$;

create or replace function public.teacher_close_window(p_class uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from classes where id = p_class and teacher = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update classes set window_until = now() where id = p_class and window_until > now();
  return json_build_object('ok', true);
end $$;

-- Papierwert eintragen (null + null = löschen)
create or replace function public.teacher_paper(
  p_student uuid, p_d date, p_kind text, p_set text, p_correct int, p_errors int)
returns json language plpgsql security invoker set search_path = public as $$
begin
  if p_correct is null and p_errors is null then
    delete from sprints where student_id = p_student and d = p_d and kind = p_kind and medium = 'papier';
  else
    insert into sprints(student_id, d, set_id, correct, errors, kind, medium, mode, in_class)
    values (p_student, p_d, p_set, coalesce(p_correct, 0), coalesce(p_errors, 0), p_kind, 'papier', 'sprint', true)
    on conflict (student_id, d, kind) where medium = 'papier'
    do update set correct = excluded.correct, errors = excluded.errors;
  end if;
  return json_build_object('ok', true);
end $$;

-- Faktenanalyse aus den App-Antworten (Klasse oder einzelnes Kind)
create or replace function public.teacher_fact_stats(p_class uuid, p_student uuid default null, p_days int default 60)
returns table(fact text, set_id text, n int, errors int, median_ms int)
language sql stable security invoker set search_path = public as $$
  select a.fact, a.set_id, count(*)::int, count(*) filter (where not a.ok)::int,
         (percentile_cont(0.5) within group (order by a.ms))::int
    from attempts a join students s on s.id = a.student_id
   where s.class_id = p_class
     and (p_student is null or a.student_id = p_student)
     and a.created_at > now() - make_interval(days => greatest(p_days, 1))
   group by a.fact, a.set_id
$$;

-- ---------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------
revoke all on function public._sid(text) from public, anon, authenticated;
revoke all on function public.class_window_open(uuid, interval) from public, anon, authenticated;
revoke all on function public.owns_student(uuid) from public, anon;
grant execute on function public.owns_student(uuid) to authenticated;

revoke all on function public.student_login(text,text,text) from public;
revoke all on function public.student_state(text) from public;
revoke all on function public.student_save(text,text,text,int,int,jsonb) from public;
revoke all on function public.student_logout(text) from public;
grant execute on function public.student_login(text,text,text) to anon, authenticated;
grant execute on function public.student_state(text) to anon, authenticated;
grant execute on function public.student_save(text,text,text,int,int,jsonb) to anon, authenticated;
grant execute on function public.student_logout(text) to anon, authenticated;

revoke all on function public.teacher_set_pin(uuid,text) from public, anon;
revoke all on function public.teacher_paper(uuid,date,text,text,int,int) from public, anon;
revoke all on function public.teacher_fact_stats(uuid,uuid,int) from public, anon;
revoke all on function public.teacher_open_window(uuid,int) from public, anon;
revoke all on function public.teacher_close_window(uuid) from public, anon;
grant execute on function public.teacher_set_pin(uuid,text) to authenticated;
grant execute on function public.teacher_paper(uuid,date,text,text,int,int) to authenticated;
grant execute on function public.teacher_fact_stats(uuid,uuid,int) to authenticated;
grant execute on function public.teacher_open_window(uuid,int) to authenticated;
grant execute on function public.teacher_close_window(uuid) to authenticated;

-- Anonyme Nutzer brauchen keinen Tabellenzugriff
revoke all on public.classes, public.students, public.student_secrets, public.sessions, public.sprints, public.attempts from anon;
revoke all on public.student_secrets, public.sessions from authenticated;
grant select, insert, update, delete on public.classes, public.students, public.sprints to authenticated;
grant select, delete on public.attempts to authenticated;
grant usage on all sequences in schema public to authenticated;

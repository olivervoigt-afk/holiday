-- ============================================================
--  Urlaubsverwaltung — Datenbankschema
--  Einmalig im Supabase SQL Editor ausführen.
--  Das Skript ist wiederholbar: erneutes Ausführen ändert keine Daten.
-- ============================================================

-- ---------- Typen ----------
do $$ begin
  create type user_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type country_code as enum ('AT', 'MT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_kind as enum ('vacation', 'special');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;


-- ---------- Benutzerprofile ----------
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       user_role not null default 'user',
  country    country_code not null default 'AT',
  -- Ausgeschiedene Mitarbeiter bleiben samt Historie erhalten, können sich
  -- aber nicht mehr anmelden und tauchen in Auswahllisten nicht mehr auf.
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Legt automatisch ein Profil an, sobald ein Auth-Benutzer erstellt wird.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'user'),
    coalesce((new.raw_user_meta_data->>'country')::country_code, 'AT')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rolle des angemeldeten Benutzers. SECURITY DEFINER umgeht RLS und
-- verhindert damit Endlosrekursion in den profiles-Policies.
create or replace function public.my_role()
returns user_role
language sql stable
security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$ select public.my_role() = 'admin' $$;


-- ---------- Feiertage ----------
-- Je Land eine eigene Liste. Der Administrator kann ein Jahr per Knopfdruck
-- erzeugen lassen und einzelne Einträge danach ergänzen oder löschen.
create table if not exists holidays (
  id      uuid primary key default gen_random_uuid(),
  country country_code not null,
  day     date not null,
  name    text not null,
  unique (country, day)
);

create index if not exists holidays_country_day_idx on holidays (country, day);


-- ---------- Jahreskontingente ----------
-- Ein Datensatz je Mitarbeiter und Kalenderjahr.
create table if not exists leave_entitlements (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  year        int not null,
  -- Urlaubsanspruch dieses Kalenderjahres.
  annual_days numeric(5, 2) not null default 25,
  -- Höchstzahl der Tage, die aus diesem Jahr ins Folgejahr wandern dürfen.
  carryover_max numeric(5, 2) not null default 0,
  -- Stichtag im Folgejahr, an dem der Übertrag aus diesem Jahr verfällt.
  -- NULL bedeutet: kein Verfall.
  carryover_expires_on date,
  -- Startsaldo: überschreibt den aus dem Vorjahr errechneten Übertrag.
  -- Gedacht für das erste Jahr in dieser Anwendung, wenn der Vortrag aus
  -- einem alten System stammt. Darf negativ sein.
  opening_carryover numeric(5, 2),
  opening_carryover_expires_on date,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  unique (profile_id, year)
);

create index if not exists entitlements_profile_idx on leave_entitlements (profile_id, year);


-- ---------- Urlaubsanträge ----------
create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles on delete cascade,
  kind          leave_kind not null default 'vacation',
  start_date    date not null,
  end_date      date not null,
  -- Erster bzw. letzter Tag zählt nur halb ("ab Mittag" / "bis Mittag").
  start_half_day boolean not null default false,
  end_half_day   boolean not null default false,
  reason        text not null default '',
  status        leave_status not null default 'pending',
  decided_by    uuid references profiles on delete set null,
  decided_at    timestamptz,
  decision_note text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint leave_requests_range check (end_date >= start_date)
);

create index if not exists leave_requests_profile_idx on leave_requests (profile_id, start_date);
create index if not exists leave_requests_status_idx on leave_requests (status, start_date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists leave_requests_touch on leave_requests;
create trigger leave_requests_touch
  before update on leave_requests
  for each row execute function public.touch_updated_at();


-- ---------- Benachrichtigungen ----------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles on delete cascade,
  title       text not null,
  body        text not null default '',
  href        text not null default '/',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_profile_idx
  on notifications (profile_id, read_at, created_at desc);


-- ============================================================
--  Zugriffsrechte (Row Level Security)
-- ============================================================

alter table profiles           enable row level security;
alter table holidays           enable row level security;
alter table leave_entitlements enable row level security;
alter table leave_requests     enable row level security;
alter table notifications      enable row level security;

-- Profile: jeder sieht die Namen der Kollegen (für den Team-Kalender),
-- ändern darf nur der Administrator.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated using (true);

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Feiertage: lesen alle, pflegen nur der Administrator.
drop policy if exists holidays_select on holidays;
create policy holidays_select on holidays
  for select to authenticated using (true);

drop policy if exists holidays_admin_write on holidays;
create policy holidays_admin_write on holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Kontingente: jeder sieht die eigenen, der Administrator alle.
drop policy if exists entitlements_select on leave_entitlements;
create policy entitlements_select on leave_entitlements
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists entitlements_admin_write on leave_entitlements;
create policy entitlements_admin_write on leave_entitlements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Anträge: jeder sieht die eigenen, der Administrator alle.
drop policy if exists leave_requests_select on leave_requests;
create policy leave_requests_select on leave_requests
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- Anlegen nur für sich selbst und nur als offener Antrag.
drop policy if exists leave_requests_insert on leave_requests;
create policy leave_requests_insert on leave_requests
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending');

-- Ändern: der Administrator alles, der Mitarbeiter nur seine eigenen
-- offenen Anträge (bearbeiten oder zurückziehen).
drop policy if exists leave_requests_update on leave_requests;
create policy leave_requests_update on leave_requests
  for update to authenticated
  using (public.is_admin() or (profile_id = auth.uid() and status = 'pending'))
  with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists leave_requests_delete on leave_requests;
create policy leave_requests_delete on leave_requests
  for delete to authenticated
  using (public.is_admin() or (profile_id = auth.uid() and status = 'pending'));

-- Abwesenheiten der Kollegen: wer im selben Land arbeitet, soll bei der
-- Planung sehen, wer sonst noch weg ist — aber nur Name und Zeitraum, nicht
-- die Begründung. Deshalb eine eigene Funktion statt einer Leserechte-Regel
-- auf der ganzen Tabelle. Der Administrator sieht alle Länder.
create or replace function public.team_absences(from_day date, to_day date)
returns table (
  profile_id     uuid,
  full_name      text,
  country        country_code,
  start_date     date,
  end_date       date,
  start_half_day boolean,
  end_half_day   boolean,
  kind           leave_kind,
  status         leave_status
)
language sql stable
security definer set search_path = public
as $$
  select r.profile_id, p.full_name, p.country, r.start_date, r.end_date,
         r.start_half_day, r.end_half_day, r.kind, r.status
  from public.leave_requests r
  join public.profiles p on p.id = r.profile_id
  where r.status in ('pending', 'approved')
    and r.start_date <= to_day
    and r.end_date >= from_day
    and p.active
    and (
      public.is_admin()
      or p.country = (select country from public.profiles where id = auth.uid())
    )
  order by r.start_date
$$;

revoke all on function public.team_absences(date, date) from public;
grant execute on function public.team_absences(date, date) to authenticated;


-- Benachrichtigungen: jeder nur die eigenen. Erzeugt werden sie serverseitig
-- mit dem Service-Role-Schlüssel, deshalb gibt es keine Insert-Policy.
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ============================================================
--  Stornierung genehmigter Urlaube
--
--  BITTE IN ZWEI SCHRITTEN AUSFÜHREN.
--  Ein neuer Enum-Wert lässt sich in PostgreSQL nicht in derselben
--  Transaktion verwenden, in der er angelegt wurde.
-- ============================================================


-- ---------- Schritt 1: allein ausführen ----------

alter type leave_status add value if not exists 'cancel_requested' after 'approved';


-- ---------- Schritt 2: danach den Rest ausführen ----------

alter table leave_requests
  add column if not exists cancel_reason text not null default '';

-- Der Administrator entscheidet ohnehin selbst — sein eigener Antrag darf
-- deshalb gleich als genehmigt angelegt werden.
drop policy if exists leave_requests_insert on leave_requests;
create policy leave_requests_insert on leave_requests
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and (status = 'pending' or (public.is_admin() and status = 'approved'))
  );

-- Mitarbeiter dürfen jetzt auch ihre genehmigten Anträge anfassen — welche
-- Statuswechsel dabei zulässig sind, regelt der Trigger darunter.
drop policy if exists leave_requests_update on leave_requests;
create policy leave_requests_update on leave_requests
  for update to authenticated
  using (
    public.is_admin()
    or (profile_id = auth.uid() and status in ('pending', 'approved'))
  )
  with check (public.is_admin() or profile_id = auth.uid());

-- Erlaubte Statuswechsel für Mitarbeiter:
--   offen     → zurückgezogen        (Antrag zurückziehen)
--   genehmigt → Storno beantragt     (Stornierung beim Administrator anfragen)
create or replace function public.guard_leave_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if old.status = new.status then return new; end if;
  if old.status = 'pending'  and new.status = 'cancelled'        then return new; end if;
  if old.status = 'approved' and new.status = 'cancel_requested' then return new; end if;

  raise exception 'Dieser Statuswechsel ist nicht erlaubt (% → %).',
    old.status, new.status;
end $$;

drop trigger if exists leave_requests_guard on leave_requests;
create trigger leave_requests_guard
  before update on leave_requests
  for each row execute function public.guard_leave_status();

-- Ein Urlaub mit beantragter Stornierung belegt den Zeitraum weiterhin.
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
  where r.status in ('pending', 'approved', 'cancel_requested')
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

-- ============================================================
-- 0005 · Inici de fase, persones externes i número d'estudi
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fases amb inici previst. `data_prevista` continua sent el final
--    previst (és el que mira la safata i el que té historial).
-- ------------------------------------------------------------
alter table fases add column data_inici date;
alter table fases add constraint fases_inici_abans_final
  check (data_inici is null or data_prevista is null or data_inici <= data_prevista);

-- ------------------------------------------------------------
-- 2. Número d'estudi intern: 4 xifres, opcional, únic si n'hi ha.
-- ------------------------------------------------------------
alter table projectes add column numero_estudi text;
alter table projectes add constraint projectes_numero_estudi_format
  check (numero_estudi is null or numero_estudi ~ '^[0-9]{4}$');
create unique index projectes_numero_estudi_unic on projectes (numero_estudi)
  where numero_estudi is not null;

-- ------------------------------------------------------------
-- 3. Persones externes ("ghost users"): es poden assignar a fases,
--    entregables i tasques, però no tenen usuari ni accés a l'app.
-- ------------------------------------------------------------
-- Un perfil ja no ha de correspondre per força a un usuari d'auth.
alter table perfils drop constraint if exists perfils_id_fkey;
alter table perfils alter column id set default gen_random_uuid();
alter table perfils alter column email drop not null;
alter table perfils add column extern boolean not null default false;
alter table perfils add column area text;   -- p. ex. "dades", "camp"
alter table perfils add constraint perfils_extern_sense_email
  check (not extern or email is null);

-- Un extern no és mai membre, encara que algú falsifiqués un token amb el seu id.
create or replace function es_membre() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfils
    where id = auth.uid() and actiu = true and extern = false
  );
$$;

-- Abans, esborrar un usuari d'auth esborrava el perfil en cascada. Sense la
-- clau forana, el perfil es desactiva (no s'esborra: hi pot haver tasques
-- assignades i res no s'esborra mai, §7.2).
create or replace function desactiva_perfil_esborrat() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.perfils set actiu = false where id = old.id;
  return old;
end;
$$;

create trigger trg_desactiva_perfil
  after delete on auth.users
  for each row execute function desactiva_perfil_esborrat();

-- Altes i canvis d'externs, només per RPC. No s'obre cap privilegi d'insert o
-- update directe sobre perfils: així un membre no pot crear un perfil amb l'id
-- d'un usuari real ni activar-ne cap.
create or replace function crea_persona_externa(p_nom text, p_area text) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  nou uuid;
begin
  if not public.es_membre() then
    raise exception 'No tens permís per afegir persones' using errcode = '42501';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'La persona necessita un nom';
  end if;
  insert into public.perfils (nom, area, extern, actiu, email)
  values (trim(p_nom), nullif(trim(p_area), ''), true, true, null)
  returning id into nou;
  return nou;
end;
$$;

create or replace function actualitza_persona_externa(
  p_id uuid, p_nom text, p_area text, p_actiu boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_membre() then
    raise exception 'No tens permís per modificar persones' using errcode = '42501';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'La persona necessita un nom';
  end if;
  update public.perfils
  set nom = trim(p_nom), area = nullif(trim(p_area), ''), actiu = p_actiu
  where id = p_id and extern = true;
  if not found then
    raise exception 'Només es poden modificar persones externes';
  end if;
end;
$$;

revoke all on function crea_persona_externa(text, text) from public, anon;
revoke all on function actualitza_persona_externa(uuid, text, text, boolean) from public, anon;
grant execute on function crea_persona_externa(text, text) to authenticated;
grant execute on function actualitza_persona_externa(uuid, text, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 4. Safata: si una fase, entregable o tasca és d'un extern, d'una persona
--    inactiva o de ningú, la revisa el responsable del projecte. Un extern no
--    obre l'app.
--    Mateixes columnes i ordre que a 0004 (create or replace).
-- ------------------------------------------------------------
create or replace view v_safata
with (security_invoker = true) as
with items as (
  select 'tasca'::text as tipus_item, t.id, t.titol, t.projecte_id,
         t.data_prevista, t.data_real, t.estat::text as estat, t.revisat_el,
         case when pt.extern is false and pt.actiu then t.assignada_a else p.responsable_id end as responsable_id
  from tasques t
  join projectes p on p.id = t.projecte_id
  left join perfils pt on pt.id = t.assignada_a
  union all
  select 'fase', f.id, f.nom, f.projecte_id,
         f.data_prevista, f.data_real, f.estat::text, f.revisat_el,
         case when pf.extern is false and pf.actiu then f.responsable_id else p.responsable_id end
  from fases f
  join projectes p on p.id = f.projecte_id
  left join perfils pf on pf.id = f.responsable_id
  union all
  select 'entregable', e.id, e.titol, e.projecte_id,
         e.data_prevista, e.data_real, e.estat::text, e.revisat_el,
         case when pe.extern is false and pe.actiu then e.responsable_id else p.responsable_id end
  from entregables e
  join projectes p on p.id = e.projecte_id
  left join perfils pe on pe.id = e.responsable_id
)
select i.*,
       pr.titol as projecte, pr.tipus as tipus_projecte,
       c.nom as client,
       case
         when i.data_prevista < current_date then 'vencut'
         else 'en_risc'
       end as motiu,
       current_date - i.data_prevista as dies_retard
from items i
join projectes pr on pr.id = i.projecte_id
join clients   c  on c.id  = pr.client_id
where i.data_real is null
  and i.estat not in ('fet', 'cancellat')
  and pr.estat = 'actiu'
  and i.data_prevista is not null
  and i.data_prevista <= current_date + 5
  and (i.revisat_el is null or i.revisat_el <= current_date - 7);

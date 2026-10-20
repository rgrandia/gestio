-- ============================================================
-- 0006 · Projectes de tipus "altre" i co-responsables
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tipus "altre": ni estudi ni consultoria. Sense fases (no les genera
--    crea_fases_estudi) i mai "mut" (v_projectes_muts només mira consultories).
-- ------------------------------------------------------------
alter type tipus_projecte add value if not exists 'altre';

-- ------------------------------------------------------------
-- 2. Co-responsables. projectes.responsable_id continua sent el principal
--    (qui porta el projecte). Aquí hi van els altres membres que també en
--    responen. No s'esborra mai cap fila: es desactiva (§7.2).
-- ------------------------------------------------------------
create table projecte_responsables (
  projecte_id  uuid not null references projectes(id) on delete cascade,
  perfil_id    uuid not null references perfils(id),
  actiu        boolean not null default true,
  creat_el     timestamptz not null default now(),
  primary key (projecte_id, perfil_id)
);
create index on projecte_responsables (perfil_id) where actiu;

alter table projecte_responsables enable row level security;
revoke all on projecte_responsables from anon, authenticated;
grant select, insert, update on projecte_responsables to authenticated;

create policy llegir on projecte_responsables
  for select to authenticated using (es_membre());
create policy crear on projecte_responsables
  for insert to authenticated with check (es_membre());
create policy modificar on projecte_responsables
  for update to authenticated using (es_membre()) with check (es_membre());

-- Un co-responsable ha de ser un membre (no un extern), igual que el principal.
create or replace function comprova_coresponsable() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.perfils where id = new.perfil_id and extern) then
    raise exception 'Una persona externa no pot ser responsable d''un projecte'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_comprova_coresponsable
  before insert or update on projecte_responsables
  for each row execute function comprova_coresponsable();

-- El mateix per al responsable principal (abans només ho impedia la interfície).
create or replace function comprova_responsable_projecte() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.perfils where id = new.responsable_id and extern) then
    raise exception 'Una persona externa no pot ser responsable d''un projecte'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_comprova_responsable_projecte
  before insert or update of responsable_id on projectes
  for each row execute function comprova_responsable_projecte();

-- Tots els responsables d'un projecte: principal + co-responsables actius.
create or replace function responsables_projecte(p_projecte uuid) returns uuid[]
language sql stable security invoker
set search_path = public
as $$
  select array[p.responsable_id] || coalesce(
    (select array_agg(r.perfil_id order by r.creat_el)
       from public.projecte_responsables r
      where r.projecte_id = p.id and r.actiu and r.perfil_id <> p.responsable_id),
    '{}'::uuid[])
  from public.projectes p
  where p.id = p_projecte;
$$;

revoke all on function responsables_projecte(uuid) from public, anon;
grant execute on function responsables_projecte(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Safata: columna nova `responsables` (uuid[]) amb tothom qui ha de veure
--    l'element a "els meus". Si està assignat a un membre actiu, només ell;
--    si no (ningú, extern o inactiu), tots els responsables del projecte.
--    `responsable_id` es manté (el principal en el cas del projecte).
--    Es refà la vista perquè canvia l'estructura interna.
-- ------------------------------------------------------------
drop view v_safata;

create view v_safata
with (security_invoker = true) as
with items as (
  select 'tasca'::text as tipus_item, t.id, t.titol, t.projecte_id,
         t.data_prevista, t.data_real, t.estat::text as estat, t.revisat_el,
         case when pt.extern is false and pt.actiu then t.assignada_a end as assignat_membre
  from tasques t
  left join perfils pt on pt.id = t.assignada_a
  union all
  select 'fase', f.id, f.nom, f.projecte_id,
         f.data_prevista, f.data_real, f.estat::text, f.revisat_el,
         case when pf.extern is false and pf.actiu then f.responsable_id end
  from fases f
  left join perfils pf on pf.id = f.responsable_id
  union all
  select 'entregable', e.id, e.titol, e.projecte_id,
         e.data_prevista, e.data_real, e.estat::text, e.revisat_el,
         case when pe.extern is false and pe.actiu then e.responsable_id end
  from entregables e
  left join perfils pe on pe.id = e.responsable_id
)
select i.tipus_item, i.id, i.titol, i.projecte_id,
       i.data_prevista, i.data_real, i.estat, i.revisat_el,
       coalesce(i.assignat_membre, pr.responsable_id) as responsable_id,
       pr.titol as projecte, pr.tipus as tipus_projecte,
       c.nom as client,
       case
         when i.data_prevista < current_date then 'vencut'
         else 'en_risc'
       end as motiu,
       current_date - i.data_prevista as dies_retard,
       case when i.assignat_membre is not null then array[i.assignat_membre]
            else responsables_projecte(pr.id) end as responsables
from items i
join projectes pr on pr.id = i.projecte_id
join clients   c  on c.id  = pr.client_id
where i.data_real is null
  and i.estat not in ('fet', 'cancellat')
  and pr.estat = 'actiu'
  and i.data_prevista is not null
  and i.data_prevista <= current_date + 5
  and (i.revisat_el is null or i.revisat_el <= current_date - 7);

revoke all on v_safata from anon, authenticated;
grant select on v_safata to authenticated;

-- Projectes muts: també hi afegim tots els responsables (columna al final).
create or replace view v_projectes_muts
with (security_invoker = true) as
select s.id, s.titol, s.client_id, s.client, s.responsable_id,
       s.dies_silenci_max, s.darrer_senyal,
       current_date - s.darrer_senyal as dies_silenci,
       responsables_projecte(s.id) as responsables
from (
  select p.id, p.titol, p.client_id, c.nom as client, p.responsable_id,
         p.dies_silenci_max,
         greatest(
           (select max(co.data) from contactes co where co.projecte_id = p.id),
           (select max(e.data_real) from entregables e
             where e.projecte_id = p.id and e.data_real is not null),
           coalesce(p.data_inici, p.creat_el::date)
         ) as darrer_senyal
  from projectes p
  join clients c on c.id = p.client_id
  where p.estat = 'actiu' and p.tipus = 'consultoria'
) s
where s.darrer_senyal < current_date - s.dies_silenci_max;

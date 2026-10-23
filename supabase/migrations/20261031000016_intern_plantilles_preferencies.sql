-- ============================================================
-- 0016 · Gestió interna, plantilles de tasques i preferències al perfil
-- ============================================================

-- ------------------------------------------------------------
-- 1. Gestió interna: tasques del dia a dia que no són de cap client
-- ------------------------------------------------------------
-- Les tasques pengen sempre d'un projecte (§4.3). Per no trencar-ho, cada
-- membre té un projecte intern propi (tipus 'altre'), d'un client intern
-- únic. No surten a les llistes de projectes ni de clients, ni al
-- cronograma ni al resum; les tasques tenen la seva secció a "la meva
-- setmana" i, per no sortir dues vegades, no surten a la safata.

alter table clients add column intern boolean not null default false;
create unique index clients_un_sol_intern on clients (intern) where intern;

insert into clients (nom, tipus, intern)
select 'GESOP · gestió interna', 'altre', true
where not exists (select 1 from clients where intern);

alter table projectes add column intern_de uuid references perfils(id);
create unique index projectes_un_intern_per_persona on projectes (intern_de) where intern_de is not null;
alter table projectes add constraint projectes_intern_es_altre
  check (intern_de is null or (tipus = 'altre' and responsable_id = intern_de));

-- Retorna el projecte intern de qui la crida i el crea si encara no en té.
create or replace function projecte_intern() returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  p uuid;
begin
  if not es_membre() then
    raise exception 'Només per a membres de l''equip.' using errcode = 'P0001';
  end if;
  select id into p from projectes where intern_de = auth.uid();
  if found then
    return p;
  end if;
  insert into projectes (client_id, titol, tipus, responsable_id, intern_de)
  values ((select id from clients where intern),
          'Gestió interna · ' || (select nom from perfils where id = auth.uid()),
          'altre', auth.uid(), auth.uid())
  returning id into p;
  return p;
end;
$$;

revoke all on function projecte_intern() from public, anon;
grant execute on function projecte_intern() to authenticated;

-- Safata: mateixes columnes que a 0012 i, al final, `intern`.
create or replace view v_safata
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
       array(select distinct x
               from unnest(array[i.assignat_membre] || responsables_projecte(pr.id)) as x
              where x is not null) as responsables,
       pr.intern_de is not null as intern
from items i
join projectes pr on pr.id = i.projecte_id
join clients   c  on c.id  = pr.client_id
where i.data_real is null
  and i.estat not in ('fet', 'cancellat')
  and pr.estat = 'actiu'
  and pr.arxivat_el is null
  and pr.eliminat_el is null
  and i.data_prevista is not null
  and i.data_prevista <= current_date + 5
  and (i.revisat_el is null or i.revisat_el <= current_date - 7);

-- ------------------------------------------------------------
-- 2. Plantilles de tasques per subtipus
-- ------------------------------------------------------------
-- En crear un projecte amb un subtipus que té plantilla (p. ex.
-- "barometre"), se'n creen les tasques: penjades de la fase del mateix nom,
-- si n'hi ha, i amb data prevista = inici del projecte + dies, si tots dos
-- hi són. Sense persona assignada: van al responsable del projecte.
-- Res no s'esborra: una línia de plantilla es desactiva.

create table plantilles_tasques (
  id        uuid primary key default gen_random_uuid(),
  subtipus  text not null,
  titol     text not null,
  fase      text,
  dies      int,
  ordre     int not null default 0,
  actiu     boolean not null default true,
  creat_el  timestamptz not null default now(),
  constraint plantilles_subtipus_normalitzat check (subtipus = lower(trim(subtipus)) and subtipus <> ''),
  constraint plantilles_titol_no_buit check (trim(titol) <> ''),
  constraint plantilles_dies_raonables check (dies is null or dies between -365 and 730)
);
create index on plantilles_tasques (subtipus) where actiu;

alter table plantilles_tasques enable row level security;
revoke all on plantilles_tasques from anon, authenticated;
grant select, insert on plantilles_tasques to authenticated;
grant update (titol, fase, dies, ordre, actiu) on plantilles_tasques to authenticated;
create policy llegir on plantilles_tasques for select to authenticated using (es_membre());
create policy crear on plantilles_tasques for insert to authenticated with check (es_membre());
create policy modificar on plantilles_tasques for update to authenticated
  using (es_membre()) with check (es_membre());

-- S'executa després de trg_fases_estudi (ordre alfabètic), així les fases
-- per defecte ja existeixen. La nova onada ja copia les tasques: no s'hi aplica.
create or replace function aplica_plantilla() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.subtipus is null or coalesce(current_setting('app.nova_onada', true), '') = 'on' then
    return new;
  end if;
  insert into tasques (projecte_id, fase_id, titol, data_prevista)
  select new.id,
         (select f.id from fases f
           where f.projecte_id = new.id and lower(f.nom) = lower(trim(p.fase))
           order by f.ordre limit 1),
         p.titol,
         case when new.data_inici is not null and p.dies is not null then new.data_inici + p.dies end
  from plantilles_tasques p
  where p.actiu and p.subtipus = lower(trim(new.subtipus))
  order by p.ordre, p.creat_el;
  return new;
end;
$$;

create trigger trg_plantilla_tasques
  after insert on projectes
  for each row execute function aplica_plantilla();

-- ------------------------------------------------------------
-- 3. Preferències al perfil (abans només en galetes del navegador)
-- ------------------------------------------------------------
alter table perfils add column tema text check (tema in ('clar', 'fosc'));
alter table perfils add column menu text check (menu in ('plegat', 'desplegat'));
-- Cadascú les seves (la política editar_propi_perfil ja limita a la fila pròpia).
grant update (tema, menu) on perfils to authenticated;

insert into migracions_aplicades (nom) values ('20261031000016_intern_plantilles_preferencies') on conflict do nothing;

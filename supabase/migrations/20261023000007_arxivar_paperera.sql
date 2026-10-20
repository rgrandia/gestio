-- ============================================================
-- 0007 · Arxivar i paperera de projectes
-- ============================================================
-- Res no s'esborra (§7.2). Dues marques de temps independents de l'estat:
--   * arxivat_el: fora de la feina diària (safata, llistes, comptadors);
--     es consulta amb el filtre "arxivats".
--   * eliminat_el: a la paperera. S'amaga de tot arreu i només es veu des de
--     la paperera, d'on es pot restaurar.
-- Les dues es tornen a posar a null per desfer-les.

alter table projectes add column arxivat_el  timestamptz;
alter table projectes add column eliminat_el timestamptz;
alter table projectes add column eliminat_per uuid references perfils(id);

-- Un projecte a la paperera no bloqueja el seu número d'estudi.
drop index if exists projectes_numero_estudi_unic;
create unique index projectes_numero_estudi_unic on projectes (numero_estudi)
  where numero_estudi is not null and eliminat_el is null;

-- Vistes: mateixes columnes que a 0006, i fora els arxivats i eliminats.
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
       case when i.assignat_membre is not null then array[i.assignat_membre]
            else responsables_projecte(pr.id) end as responsables
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
    and p.arxivat_el is null and p.eliminat_el is null
) s
where s.darrer_senyal < current_date - s.dies_silenci_max;

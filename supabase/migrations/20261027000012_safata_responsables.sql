-- ============================================================
-- 0012 · A la safata, els responsables del projecte també veuen el que
--        està assignat a una altra persona
-- ============================================================
-- Abans (0006), una tasca, fase o entregable assignat a un membre concret
-- només sortia a "els meus" d'aquell membre. Resultat: el responsable d'una
-- consultoria no veia les tasques vençudes que havia assignat a algú altre.
-- El §6.1 diu "filtrada per on soc responsable": ara hi surt a tots dos.
-- Mateixes columnes que a 0007.

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
       -- qui la té assignada (si és un membre actiu) i, a més, tots els
       -- responsables del projecte: "on soc responsable" (§6.1)
       array(select distinct x
               from unnest(array[i.assignat_membre] || responsables_projecte(pr.id)) as x
              where x is not null) as responsables
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

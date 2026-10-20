-- ============================================================
-- 0004 · Vistes de la safata (CLAUDE.md §5)
-- ============================================================
-- Correccions respecte a les vistes de referència:
--
--   1. CRÍTIC: una vista de Postgres s'executa per defecte amb els
--      privilegis del seu propietari (`postgres`), que se salta l'RLS.
--      Les vistes de referència haurien exposat tota la safata a qualsevol
--      usuari autenticat, membre o no. Totes porten `security_invoker`.
--
--   2. Snooze: `revisat_el < current_date - 7` amagava l'element 8 dies, no
--      7. Ara: revisat dilluns → torna el dilluns següent.
--
--   3. Projectes muts: un projecte de consultoria acabat de crear, sense
--      cap contacte, sortia "mut" el primer dia (darrer senyal = 1900). Ara
--      el rellotge comença a `data_inici` o, si no n'hi ha, a la data de
--      creació. A més, el doble left join (contactes × entregables) feia un
--      producte cartesià; ara són subconsultes.

create or replace view v_safata
with (security_invoker = true) as
with items as (
  select 'tasca'::text as tipus_item, t.id, t.titol, t.projecte_id,
         t.data_prevista, t.data_real, t.estat::text as estat, t.revisat_el,
         t.assignada_a as responsable_id
  from tasques t
  union all
  select 'fase', f.id, f.nom, f.projecte_id,
         f.data_prevista, f.data_real, f.estat::text, f.revisat_el,
         coalesce(f.responsable_id, p.responsable_id)
  from fases f join projectes p on p.id = f.projecte_id
  union all
  select 'entregable', e.id, e.titol, e.projecte_id,
         e.data_prevista, e.data_real, e.estat::text, e.revisat_el,
         coalesce(e.responsable_id, p.responsable_id)
  from entregables e join projectes p on p.id = e.projecte_id
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

create or replace view v_projectes_muts
with (security_invoker = true) as
select s.id, s.titol, s.client_id, s.client, s.responsable_id,
       s.dies_silenci_max, s.darrer_senyal,
       current_date - s.darrer_senyal as dies_silenci
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

-- ------------------------------------------------------------
-- Historial de replanificacions d'un projecte (pestanya del detall)
-- ------------------------------------------------------------
create or replace view v_historial_projecte
with (security_invoker = true) as
select h.*, x.projecte_id, x.element, pf.nom as usuari
from historial_dates h
join (
  select 'projectes'::text as taula, id as registre_id, id as projecte_id, titol as element from projectes
  union all
  select 'fases', id, projecte_id, nom from fases
  union all
  select 'entregables', id, projecte_id, titol from entregables
  union all
  select 'tasques', id, projecte_id, titol from tasques
) x on x.taula = h.taula and x.registre_id = h.registre_id
left join perfils pf on pf.id = h.usuari_id;

revoke all on v_safata, v_projectes_muts, v_historial_projecte from anon, authenticated;
grant select on v_safata, v_projectes_muts, v_historial_projecte to authenticated;

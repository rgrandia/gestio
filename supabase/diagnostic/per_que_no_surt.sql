-- ============================================================
-- Diagnòstic: per què una tasca vençuda no surt a "a revisar"?
-- ============================================================
-- Enganxa-ho a l'editor SQL de Supabase i canvia el correu de la línia
-- marcada. No modifica res. Llista les tasques obertes dels projectes on
-- ets responsable o co-responsable, o assignades a tu, i diu si haurien de
-- sortir a la teva safata i, si no, per què.

with jo as (
  select id from perfils where email = 'EL-TEU-CORREU@gesop.net'   -- ← canvia-ho
),
tasques_meves as (
  select t.*, p.titol as projecte, p.estat as estat_projecte, p.arxivat_el, p.eliminat_el, p.tipus
  from tasques t
  join projectes p on p.id = t.projecte_id
  where t.data_real is null
    and t.estat not in ('fet', 'cancellat')
    and (t.assignada_a = (select id from jo)
         or (select id from jo) = any(responsables_projecte(p.id)))
)
select
  tipus as tipus_projecte,
  projecte,
  titol as tasca,
  data_prevista,
  case
    when data_prevista is null                then 'NO SURT: no té data prevista (no pot vèncer)'
    when eliminat_el is not null              then 'NO SURT: el projecte és a la paperera'
    when arxivat_el is not null               then 'NO SURT: el projecte està arxivat'
    when estat_projecte <> 'actiu'            then 'NO SURT: el projecte està ' || estat_projecte
    when data_prevista > current_date + 5     then 'encara no: venç d''aquí a ' || (data_prevista - current_date) || ' dies'
    when revisat_el > current_date - 7        then 'NO SURT: marcada "revisat" el ' || revisat_el || ' (torna el ' || (revisat_el + 7) || ')'
    when id in (select id from v_safata where (select id from jo) = any(responsables))
                                              then 'SURT a la teva safata'
    else 'NO SURT: cas no previst — envia aquesta fila'
  end as diagnostic
from tasques_meves
order by data_prevista nulls first;

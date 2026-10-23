-- ============================================================
-- 0018 · Salut de l'esquema i projectes sense moviment
-- ============================================================

-- ------------------------------------------------------------
-- 1. Què li falta de debò a la base de dades
-- ------------------------------------------------------------
-- El registre de migracions diu què s'ha aplicat, però pot mentir: la 0014 va
-- donar per aplicada la 0013, que a producció no hi era. Aquesta funció mira
-- els objectes reals. L'app li passa la llista del que necessita
-- (src/lib/esquema-requerit.json) i n'obté el que falta.
--   p_funcions: signatures, p. ex. 'transfereix(text,uuid,uuid,text)'
--   p_columnes: 'taula.columna' (també vistes)
create or replace function falten_objectes(p_funcions text[], p_columnes text[]) returns text[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(x order by x), '{}')
  from (
    select f || ' (funció)' as x
    from unnest(p_funcions) f
    where to_regprocedure('public.' || f) is null
    union all
    select c || ' (columna)'
    from unnest(p_columnes) c
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(c, '.', 1)
        and column_name = split_part(c, '.', 2))
  ) t;
$$;
revoke all on function falten_objectes(text[], text[]) from public, anon;
grant execute on function falten_objectes(text[], text[]) to authenticated;

-- ------------------------------------------------------------
-- 2. Projectes actius sense cap moviment en 60 dies
-- ------------------------------------------------------------
-- Moviment: canvi al projecte, tasca creada, qualsevol cosa marcada feta,
-- contacte o replanificació. Serveix perquè algú decideixi si es tanca; no és
-- cap estat desat (§5). Els interns no hi compten.
create or replace view v_projectes_quiets
with (security_invoker = true) as
select p.id, p.titol, p.numero_estudi, p.tipus, p.responsable_id, m.darrer_moviment
from projectes p
cross join lateral (
  select greatest(
    p.actualitzat_el::date,
    p.creat_el::date,
    (select max(greatest(t.creat_el::date, coalesce(t.data_real, '1900-01-01'))) from tasques t where t.projecte_id = p.id),
    (select max(f.data_real) from fases f where f.projecte_id = p.id),
    (select max(e.data_real) from entregables e where e.projecte_id = p.id),
    (select max(c.data) from contactes c where c.projecte_id = p.id),
    (select max(h.creat_el)::date from v_historial_projecte h where h.projecte_id = p.id)
  ) as darrer_moviment
) m
where p.estat = 'actiu'
  and p.arxivat_el is null
  and p.eliminat_el is null
  and p.intern_de is null
  and m.darrer_moviment < current_date - 60;

revoke all on v_projectes_quiets from anon, authenticated;
grant select on v_projectes_quiets to authenticated;

insert into migracions_aplicades (nom) values ('20261102000018_salut_projectes_quiets') on conflict do nothing;

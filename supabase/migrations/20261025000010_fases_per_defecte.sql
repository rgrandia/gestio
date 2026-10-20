-- ============================================================
-- 0010 · Noves fases per defecte dels estudis
-- ============================================================
-- Només afecta els estudis que es creïn a partir d'ara. Els existents
-- conserven les seves fases (poden tenir dates, tasques i historial).

create or replace function crea_fases_estudi() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.tipus = 'estudi' then
    insert into public.fases (projecte_id, nom, ordre)
    select new.id, nom, ordre
    from unnest(array['Qüestionari i mostra', 'Briefing', 'Camp', 'Dades', 'Informe', 'Presentació'])
         with ordinality as f(nom, ordre);
  end if;
  return new;
end;
$$;

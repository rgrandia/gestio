-- ============================================================
-- 0015 · El motiu de replanificar passa a ser opcional
-- ============================================================
-- Decisió de l'equip (octubre 2026): de vegades no hi ha temps d'escriure'l.
-- El que NO canvia (§4.2):
--   * cada canvi de data prevista continua escrivint una fila a
--     historial_dates, amb data antiga i nova, qui i quan;
--   * un update directe de la data (sense passar per replanificar()) continua
--     fallant: el trigger exigeix que hi hagi un motiu a app.motiu_canvi.
-- Si el motiu arriba buit, replanificar() hi posa «sense motiu», excepte si
-- l'element encara no tenia data: llavors el trigger hi continua posant
-- «planificació inicial».

create or replace function replanificar(
  p_taula text,
  p_id    uuid,
  p_data  date,
  p_motiu text
) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  columna text;
  n       int;
  abans   date;
  motiu   text := nullif(trim(p_motiu), '');
begin
  columna := case p_taula
    when 'fases'       then 'data_prevista'
    when 'entregables' then 'data_prevista'
    when 'tasques'     then 'data_prevista'
    when 'projectes'   then 'data_fi_prevista'
  end;
  if columna is null then
    raise exception 'Taula no vàlida: %', p_taula;
  end if;

  if motiu is null then
    execute format('select %I from %I where id = $1', columna, p_taula) into abans using p_id;
    if abans is not null then
      motiu := 'sense motiu';
    end if;
  end if;

  perform set_config('app.motiu_canvi', coalesce(motiu, ''), true);
  execute format('update %I set %I = $1 where id = $2', p_taula, columna)
    using p_data, p_id;
  get diagnostics n = row_count;
  perform set_config('app.motiu_canvi', '', true);

  if n = 0 then
    raise exception 'No s''ha trobat el registre o no hi tens accés';
  end if;
end;
$$;

revoke all on function replanificar(text, uuid, date, text) from public, anon;
grant execute on function replanificar(text, uuid, date, text) to authenticated;

insert into migracions_aplicades (nom) values ('20261030000015_motiu_opcional') on conflict do nothing;

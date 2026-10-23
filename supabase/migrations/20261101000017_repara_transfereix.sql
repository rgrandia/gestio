-- ============================================================
-- 0017 · Reparació: crea transfereix() si no hi és
-- ============================================================
-- A la base de dades de producció no s'hi va aplicar la 0013, però la 0014
-- la va donar per aplicada en crear el registre de migracions. De la 0013
-- només en faltava transfereix(): l'altra peça (el trigger d'avisos
-- avisa_assignacio) la 0014 la torna a definir, en una versió més nova.
-- Per això NO s'ha d'executar la 0013 sencera ara: trepitjaria la de la 0014.
-- Aquí només hi ha la funció, idèntica a la de la 0013. És inofensiva si ja hi era.

create or replace function transfereix(
  p_taula   text,
  p_id      uuid,
  p_persona uuid,
  p_nota    text default null
) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  columna text;
  actual  uuid;
  n       int;
begin
  columna := case p_taula
    when 'tasques'     then 'assignada_a'
    when 'entregables' then 'responsable_id'
  end;
  if columna is null then
    raise exception 'Només es poden passar tasques i entregables.';
  end if;
  if not exists (select 1 from perfils where id = p_persona and actiu) then
    raise exception 'Tria una persona activa de l''equip o externa.';
  end if;

  execute format('select %I from %I where id = $1', columna, p_taula) into actual using p_id;
  if actual is not distinct from p_persona then
    raise exception 'Ja la té aquesta persona.';
  end if;

  perform set_config('app.nota_transferencia', coalesce(trim(p_nota), ''), true);
  execute format('update %I set %I = $1 where id = $2', p_taula, columna) using p_persona, p_id;
  get diagnostics n = row_count;
  perform set_config('app.nota_transferencia', '', true);

  if n = 0 then
    raise exception 'No s''ha trobat l''element o no hi tens accés.';
  end if;
end;
$$;

revoke all on function transfereix(text, uuid, uuid, text) from public, anon;
grant execute on function transfereix(text, uuid, uuid, text) to authenticated;

insert into migracions_aplicades (nom) values ('20261101000017_repara_transfereix') on conflict do nothing;

-- ============================================================
-- 0013 · Passar (transferir) una tasca o un entregable a una altra persona
-- ============================================================
-- Fins ara qui feia una tasca es triava en crear-la i no es podia canviar.
-- transfereix() la passa a una altra persona (membre o extern actiu) amb
-- una nota opcional. Els avisos els fa el trigger d'assignació, que ara:
--   * diu "t'ha passat" (i de qui era) quan ja tenia algú assignat;
--   * hi afegeix la nota;
--   * avisa també qui la tenia, si no ha estat ell qui l'ha passada.

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

-- Trigger d'assignació (0009) ampliat per als traspassos.
create or replace function avisa_assignacio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  dest     uuid;
  abans    uuid;
  que      text;
  nom_el   text;
  nota     text := nullif(trim(coalesce(current_setting('app.nota_transferencia', true), '')), '');
  sufix    text;
  nom_abans text;
  nom_dest  text;
begin
  if tg_table_name = 'tasques' then
    dest := new.assignada_a;
    abans := case when tg_op = 'UPDATE' then old.assignada_a end;
    que := 'la tasca';
    nom_el := new.titol;
  elsif tg_table_name = 'fases' then
    dest := new.responsable_id;
    abans := case when tg_op = 'UPDATE' then old.responsable_id end;
    que := 'la fase';
    nom_el := new.nom;
  else
    dest := new.responsable_id;
    abans := case when tg_op = 'UPDATE' then old.responsable_id end;
    que := 'l''entregable';
    nom_el := new.titol;
  end if;

  if dest is not distinct from abans then
    return new;
  end if;

  sufix := ' · ' || public.titol_projecte(new.projecte_id)
           || case when nota is not null then ': «' || nota || '»' else '' end;

  if abans is null then
    perform public.notifica(dest, 'assignacio',
      public.nom_actor() || ' t''ha assignat ' || que || ' «' || nom_el || '»' || sufix,
      '/projectes/' || new.projecte_id);
  else
    select nom into nom_abans from public.perfils where id = abans;
    select nom into nom_dest from public.perfils where id = dest;
    -- a qui la rep
    perform public.notifica(dest, 'assignacio',
      public.nom_actor() || ' t''ha passat ' || que || ' «' || nom_el || '»'
        -- "(abans era de X)" només si no l'ha passada la mateixa persona que la tenia
        || case when abans is distinct from auth.uid() then ' (abans era de ' || coalesce(nom_abans, '?') || ')' else '' end
        || sufix,
      '/projectes/' || new.projecte_id);
    -- a qui la tenia (notifica() ja se salta qui fa l'acció i els externs)
    perform public.notifica(abans, 'assignacio',
      public.nom_actor() || ' ha passat ' || que || ' «' || nom_el || '» a '
        || coalesce(nom_dest, 'ningú') || sufix,
      '/projectes/' || new.projecte_id);
  end if;
  return new;
end;
$$;

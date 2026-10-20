-- ============================================================
-- 0003 · Triggers i funcions RPC (CLAUDE.md §4.2, §4.4, §8)
-- ============================================================
-- Diferències respecte a §8:
--   * La funció rep el nom de la columna com a argument del trigger, i així
--     cobreix també `projectes.data_fi_prevista` (el comentari de
--     `historial_dates.taula` ja preveia `projectes`, però el trigger de
--     referència no la cobria).
--   * Passar de NULL a una data (primera planificació, p. ex. les sis fases
--     que neixen sense data) no exigeix motiu: s'hi desa "planificació
--     inicial". No és una replanificació i obligar a justificar-la faria
--     que ningú posés dates. Qualsevol altre canvi (inclòs esborrar la
--     data) continua exigint motiu.

create or replace function registra_canvi_data() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  columna    text := tg_argv[0];
  data_old   date := (to_jsonb(old) ->> columna)::date;
  data_new   date := (to_jsonb(new) ->> columna)::date;
  motiu      text := nullif(trim(coalesce(current_setting('app.motiu_canvi', true), '')), '');
begin
  if data_new is distinct from data_old then
    if motiu is null then
      if data_old is null then
        motiu := 'planificació inicial';
      else
        raise exception 'Cal indicar un motiu per canviar la data prevista'
          using errcode = 'P0001',
                hint = 'Fes servir la funció replanificar(taula, id, data, motiu).';
      end if;
    end if;
    insert into public.historial_dates (taula, registre_id, data_antiga, data_nova, motiu, usuari_id)
    values (tg_table_name, old.id, data_old, data_new, motiu, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_data_fases       before update on fases
  for each row execute function registra_canvi_data('data_prevista');
create trigger trg_data_entregables before update on entregables
  for each row execute function registra_canvi_data('data_prevista');
create trigger trg_data_tasques     before update on tasques
  for each row execute function registra_canvi_data('data_prevista');
create trigger trg_data_projectes   before update on projectes
  for each row execute function registra_canvi_data('data_fi_prevista');

-- ------------------------------------------------------------
-- replanificar: l'ÚNIC camí per canviar una data prevista des del client.
-- security invoker: s'hi apliquen les polítiques RLS de qui la crida.
-- ------------------------------------------------------------
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

  perform set_config('app.motiu_canvi', coalesce(trim(p_motiu), ''), true);
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

-- ------------------------------------------------------------
-- Fases per defecte d'un estudi (§4.4)
-- ------------------------------------------------------------
create or replace function crea_fases_estudi() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.tipus = 'estudi' then
    insert into public.fases (projecte_id, nom, ordre)
    select new.id, nom, ordre
    from unnest(array['Qüestionari', 'Camp', 'Tabulació', 'Revisió', 'Informe', 'Presentació'])
         with ordinality as f(nom, ordre);
  end if;
  return new;
end;
$$;

create trigger trg_fases_estudi
  after insert on projectes
  for each row execute function crea_fases_estudi();

-- ------------------------------------------------------------
-- Reordenar fases: intercanvia `ordre` amb la veïna (amunt = -1, avall = 1)
-- ------------------------------------------------------------
create or replace function mou_fase(p_id uuid, p_direccio int) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  actual  record;
  veina   record;
begin
  select id, projecte_id, ordre into actual from fases where id = p_id;
  if not found then
    raise exception 'No s''ha trobat la fase';
  end if;

  select id, ordre into veina from fases
  where projecte_id = actual.projecte_id
    and case when p_direccio < 0 then ordre < actual.ordre else ordre > actual.ordre end
  order by case when p_direccio < 0 then -ordre else ordre end
  limit 1;
  if not found then
    return;
  end if;

  set constraints all deferred;
  update fases set ordre = veina.ordre  where id = actual.id;
  update fases set ordre = actual.ordre where id = veina.id;
end;
$$;

revoke all on function mou_fase(uuid, int) from public, anon;
grant execute on function mou_fase(uuid, int) to authenticated;

-- ------------------------------------------------------------
-- projectes.actualitzat_el
-- ------------------------------------------------------------
create or replace function toca_actualitzat_el() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actualitzat_el := now();
  return new;
end;
$$;

create trigger trg_projectes_actualitzat
  before update on projectes
  for each row execute function toca_actualitzat_el();

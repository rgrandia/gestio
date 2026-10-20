-- ============================================================
-- 0008 · Color propi per persona
-- ============================================================
-- Abans el color de l'avatar sortia d'un hash del nom i dos membres podien
-- coincidir (Roc i Rocío, a més, comparteixen inicial). Ara es desa i,
-- entre membres actius, no es pot repetir.

alter table perfils add column color text;
alter table perfils add constraint perfils_color_format
  check (color is null or color ~ '^#[0-9A-F]{6}$');

-- Paleta: colors prou diferents entre ells i llegibles amb text blanc.
create or replace function paleta_colors() returns text[]
language sql immutable
as $$
  select array['#2563EB', '#DB2777', '#059669', '#EA580C',
               '#7C3AED', '#0891B2', '#CA8A04', '#475569'];
$$;

-- Primer color de la paleta que no fa servir cap membre actiu.
create or replace function color_lliure() returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select c from unnest(paleta_colors()) with ordinality as t(c, n)
      where c not in (select color from public.perfils
                       where color is not null and actiu and not extern)
      order by n limit 1),
    -- si la paleta s'esgota, es reparteix cíclicament
    (paleta_colors())[1 + (select count(*) from public.perfils) % 8]
  );
$$;

-- Colors per als perfils que ja existeixen, per ordre d'alta.
do $$
declare r record;
begin
  for r in select id from perfils where color is null order by extern, creat_el loop
    update perfils set color = color_lliure() where id = r.id;
  end loop;
end $$;

-- Perfils nous: color lliure automàticament.
create or replace function assigna_color() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.color is null then
    new.color := public.color_lliure();
  end if;
  return new;
end;
$$;

create trigger trg_assigna_color
  before insert on perfils
  for each row execute function assigna_color();

-- Dos membres actius no poden tenir el mateix color.
create or replace function comprova_color_unic() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  qui text;
begin
  if new.extern or not new.actiu or new.color is null then
    return new;
  end if;
  select nom into qui from public.perfils
   where color = new.color and actiu and not extern and id <> new.id
   limit 1;
  if qui is not null then
    -- Si no s'ha triat el color expressament (alta o reactivació), se
    -- n'assigna un de lliure; si algú l'ha triat, s'avisa.
    if tg_op = 'INSERT' or new.color is not distinct from old.color then
      new.color := public.color_lliure();
    else
      raise exception 'Aquest color ja el fa servir %. Tria''n un altre.', qui
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_comprova_color_unic
  before insert or update of color, actiu on perfils
  for each row execute function comprova_color_unic();

-- Cadascú pot canviar el seu propi color (la política editar_propi_perfil
-- ja limita l'update a la fila pròpia).
grant update (color) on perfils to authenticated;

-- Els externs també poden canviar de color per RPC.
create or replace function actualitza_persona_externa(
  p_id uuid, p_nom text, p_area text, p_actiu boolean, p_color text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_membre() then
    raise exception 'No tens permís per modificar persones' using errcode = '42501';
  end if;
  if coalesce(trim(p_nom), '') = '' then
    raise exception 'La persona necessita un nom';
  end if;
  update public.perfils
  set nom = trim(p_nom), area = nullif(trim(p_area), ''), actiu = p_actiu,
      color = coalesce(p_color, color)
  where id = p_id and extern = true;
  if not found then
    raise exception 'Només es poden modificar persones externes';
  end if;
end;
$$;

drop function if exists actualitza_persona_externa(uuid, text, text, boolean);
revoke all on function actualitza_persona_externa(uuid, text, text, boolean, text) from public, anon;
grant execute on function actualitza_persona_externa(uuid, text, text, boolean, text) to authenticated;
revoke all on function color_lliure() from public, anon;

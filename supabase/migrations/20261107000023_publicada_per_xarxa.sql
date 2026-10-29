-- ============================================================
-- 0023 · Xarxes: publicada xarxa per xarxa
-- ============================================================
-- Una publicació pot sortir a LinkedIn avui i a X demà (o no sortir-hi mai).
-- Cada canal té la seva data de publicació (`publicat_el`), amb la mateixa
-- regla que a tot arreu (§4.1): publicat ⇔ data, mai futura.
--
-- La publicació sencera continua sent «publicada» ⇔ `data_real`, però ara se
-- sincronitza sola amb els canals actius:
--   · quan tots tenen data, passa a publicada amb data_real = la més tardana;
--   · si se'n desmarca un, torna a programada (no a esborrany: l'aprovació
--     continua vigent, només falta una xarxa);
--   · marcar la publicació sencera com a publicada (o sense canals) data els
--     canals que no en tenien; reobrir-la la treu de tots.
-- Ho fan els triggers: el codi de l'app no pot deixar les dues coses
-- desquadrades.

alter table publicacio_canals add column publicat_el date;

-- Les que ja consten publicades: tots els seus canals actius, el mateix dia.
update publicacio_canals c
   set publicat_el = p.data_real
  from publicacions p
 where p.id = c.publicacio_id and p.estat = 'publicada' and c.actiu and c.publicat_el is null;

-- Abans de tocar un canal: no futur, i res en una publicació cancel·lada.
create or replace function valida_canal_publicat() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.publicat_el is not distinct from old.publicat_el then
    return new;
  end if;
  if new.publicat_el is null then
    new.enllac_publicat := null; -- desmarcat: l'enllaç ja no apunta enlloc
  elsif new.publicat_el > current_date then
    raise exception 'La data de publicació no pot ser posterior a avui.' using errcode = 'P0001';
  elsif exists (select 1 from publicacions where id = new.publicacio_id and estat = 'cancellada') then
    raise exception 'La publicació està cancel·lada: reobre-la abans.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_valida_canal_publicat
  before insert or update on publicacio_canals
  for each row execute function valida_canal_publicat();

-- Després de tocar un canal (data o actiu) o d'afegir-ne un: la publicació
-- segueix els canals.
-- Només quan el canvi ve de l'app (profunditat 1): si ve del trigger de la
-- publicació (més avall), ja és ella qui mana.
create or replace function canal_sincronitza_publicacio() returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  p publicacions%rowtype;
  falten int;
  total int;
  darrera date;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.publicat_el is not distinct from old.publicat_el
     and new.actiu is not distinct from old.actiu then
    return new;
  end if;
  select * into p from publicacions where id = new.publicacio_id;
  if p.estat = 'cancellada' then
    return new;
  end if;
  select count(*), count(*) filter (where publicat_el is null), max(publicat_el)
    into total, falten, darrera
    from publicacio_canals where publicacio_id = new.publicacio_id and actiu;

  if total = 0 then
    return new; -- sense cap xarxa activa, mana l'estat de la publicació
  elsif falten = 0 then
    if p.estat <> 'publicada' or p.data_real is distinct from darrera then
      update publicacions set estat = 'publicada', data_real = darrera where id = p.id;
    end if;
  elsif p.estat = 'publicada' then
    update publicacions set estat = 'programada' where id = p.id;
  end if;
  return new;
end;
$$;

create trigger trg_canal_sincronitza_publicacio
  after insert or update on publicacio_canals
  for each row execute function canal_sincronitza_publicacio();

-- Després de canviar l'estat de la publicació des de l'app: els canals la
-- segueixen. Publicada → data als canals actius que no en tenien. Reoberta
-- → fora totes les dates (i els enllaços, pel trigger d'abans).
create or replace function publicacio_sincronitza_canals() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.estat = 'publicada' and old.estat is distinct from 'publicada' then
    update publicacio_canals set publicat_el = new.data_real
     where publicacio_id = new.id and actiu and publicat_el is null;
  elsif old.estat = 'publicada' and new.estat not in ('publicada', 'cancellada') then
    update publicacio_canals set publicat_el = null
     where publicacio_id = new.id and publicat_el is not null;
  end if;
  return new;
end;
$$;

create trigger trg_publicacio_sincronitza_canals
  after update of estat on publicacions
  for each row execute function publicacio_sincronitza_canals();

insert into migracions_aplicades (nom) values ('20261107000023_publicada_per_xarxa') on conflict do nothing;

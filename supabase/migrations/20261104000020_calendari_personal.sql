-- ============================================================
-- 0020 · Calendari personal: teletreball, fora, vacances, festius
-- ============================================================
-- Cadascú marca com és cada dia seu (teletreball, a l'oficina, fora,
-- vacances, festiu) i qualsevol membre pot marcar festius de tot l'equip
-- (perfil_id null). Ho veu tot l'equip: serveix per saber qui hi ha i per
-- no planificar feina un dia que no hi seràs.
--
-- Límit (RGPD, §2): són dades de l'equip, no de ciutadans, però tampoc no hi
-- van motius de salut. Per això no hi ha cap tipus «baixa» ni «malaltia» i
-- la nota és curta; una absència per salut es marca «fora» sense explicar-la.
-- Res no s'esborra (§7.2): treure una marca la desactiva.

create type tipus_dia as enum ('oficina', 'teletreball', 'fora', 'vacances', 'festiu');

create table calendari_dies (
  id              uuid primary key default gen_random_uuid(),
  perfil_id       uuid references perfils(id),        -- null: tot l'equip
  data            date not null,
  tipus           tipus_dia not null,
  nota            text check (nota is null or char_length(nota) <= 80),
  actiu           boolean not null default true,
  modificat_per   uuid references perfils(id) default auth.uid(),
  actualitzat_el  timestamptz not null default now(),
  constraint calendari_equip_nomes_festius check (perfil_id is not null or tipus = 'festiu')
);
create unique index calendari_un_per_persona_i_dia on calendari_dies (perfil_id, data) where perfil_id is not null;
create unique index calendari_un_festiu_equip_per_dia on calendari_dies (data) where perfil_id is null;
create index on calendari_dies (data);

alter table calendari_dies enable row level security;
revoke all on calendari_dies from anon, authenticated;
grant select, insert on calendari_dies to authenticated;
grant update (tipus, nota, actiu, modificat_per, actualitzat_el) on calendari_dies to authenticated;

create policy llegir on calendari_dies for select to authenticated using (es_membre());
-- el propi calendari, o els festius de tot l'equip
create policy crear on calendari_dies for insert to authenticated
  with check (es_membre() and (perfil_id = auth.uid() or perfil_id is null));
create policy modificar on calendari_dies for update to authenticated
  using (es_membre() and (perfil_id = auth.uid() or perfil_id is null))
  with check (es_membre() and (perfil_id = auth.uid() or perfil_id is null));

-- Marca (o treu, amb p_tipus null) un conjunt de dies del meu calendari o,
-- amb p_equip, festius de tot l'equip. Com a molt un any de cop.
create or replace function marca_dies(p_dates date[], p_tipus text, p_nota text, p_equip boolean)
returns int
language plpgsql security invoker
set search_path = public
as $$
declare
  qui uuid := case when p_equip then null else auth.uid() end;
  nota text := nullif(trim(coalesce(p_nota, '')), '');
  n int := 0;
  d date;
begin
  if not es_membre() then
    raise exception 'Només per a membres de l''equip.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_dates, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_dates, 1) > 366 then
    raise exception 'Com a molt un any de cop.' using errcode = 'P0001';
  end if;
  if p_equip and p_tipus is not null and p_tipus <> 'festiu' then
    raise exception 'Per a tot l''equip només es poden marcar festius.' using errcode = 'P0001';
  end if;

  foreach d in array p_dates loop
    if p_tipus is null then
      update calendari_dies
         set actiu = false, modificat_per = auth.uid(), actualitzat_el = now()
       where data = d and perfil_id is not distinct from qui and actiu;
    elsif qui is null then
      insert into calendari_dies (perfil_id, data, tipus, nota)
      values (null, d, p_tipus::tipus_dia, nota)
      on conflict (data) where perfil_id is null
      do update set tipus = excluded.tipus, nota = excluded.nota, actiu = true,
                    modificat_per = auth.uid(), actualitzat_el = now();
    else
      insert into calendari_dies (perfil_id, data, tipus, nota)
      values (qui, d, p_tipus::tipus_dia, nota)
      on conflict (perfil_id, data) where perfil_id is not null
      do update set tipus = excluded.tipus, nota = excluded.nota, actiu = true,
                    modificat_per = auth.uid(), actualitzat_el = now();
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function marca_dies(date[], text, text, boolean) from public, anon;
grant execute on function marca_dies(date[], text, text, boolean) to authenticated;

insert into migracions_aplicades (nom) values ('20261104000020_calendari_personal') on conflict do nothing;

-- ============================================================
-- 0019 · Xarxes socials corporatives (funció opcional per persona)
-- ============================================================
-- Planificar, redactar, revisar i deixar constància de les publicacions dels
-- comptes corporatius. Es poden lligar a un projecte o no.
--
-- Límits (§2), igual que la resta de l'app:
--   * L'app NO publica ni llegeix res de les xarxes (cap API, cap token). Es
--     redacta aquí, es copia i es publica a la xarxa; després s'hi marca la
--     data real i l'enllaç.
--   * Cap dada de seguidors, comentaris ni missatges: només el que publiquem.
--   * Cap mètrica d'abast ni gràfic.
--   * Imatges i vídeos: només un enllaç a SharePoint/Drive.
--
-- Només ho veuen les persones que tenen la funció activada
-- (perfils.funcions conté 'xarxes'). No és un rol: no dona cap permís sobre la
-- resta de l'app (§7.1), només obre aquest mòdul. Ho decideix l'RLS, no el menú.

-- ------------------------------------------------------------
-- 1. Funcions activades per persona
-- ------------------------------------------------------------
alter table perfils add column funcions text[] not null default '{}';
alter table perfils add constraint perfils_funcions_conegudes
  check (funcions <@ array['xarxes']::text[]);
-- Sense `grant update (funcions)`: només es canvia per activa_funcio().

create or replace function te_funcio(p_funcio text) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfils
    where id = auth.uid() and actiu and not extern and p_funcio = any(funcions)
  );
$$;
revoke all on function te_funcio(text) from public, anon;
grant execute on function te_funcio(text) to authenticated;

-- Activa o desactiva una funció a un membre. La pot donar qui ja la té. Si
-- ningú no la té encara, qualsevol membre la pot activar (per començar).
create or replace function activa_funcio(p_persona uuid, p_funcio text, p_actiu boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.es_membre() then
    raise exception 'Només per a membres de l''equip.' using errcode = '42501';
  end if;
  if p_funcio is distinct from 'xarxes' then
    raise exception 'Funció desconeguda: %', p_funcio using errcode = 'P0001';
  end if;
  if not public.te_funcio(p_funcio)
     and exists (select 1 from perfils where actiu and not extern and p_funcio = any(funcions)) then
    raise exception 'Només qui ja té activada aquesta funció la pot activar o desactivar a altres.'
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from perfils where id = p_persona and actiu and not extern) then
    raise exception 'Només es pot activar a membres actius de l''equip.' using errcode = 'P0001';
  end if;

  update perfils
     set funcions = case
       when p_actiu then array(select distinct x from unnest(funcions || p_funcio) x order by x)
       else array_remove(funcions, p_funcio)
     end
   where id = p_persona;

  if p_actiu then
    perform public.notifica(p_persona, 'funcio',
      public.nom_actor() || ' t''ha activat les xarxes socials', '/xarxes');
  end if;
end;
$$;
revoke all on function activa_funcio(uuid, text, boolean) from public, anon;
grant execute on function activa_funcio(uuid, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- 2. Comptes corporatius
-- ------------------------------------------------------------
create table xarxes_comptes (
  id                 uuid primary key default gen_random_uuid(),
  plataforma         text not null check (plataforma in
                       ('x', 'linkedin', 'instagram', 'facebook', 'bluesky',
                        'threads', 'mastodon', 'youtube', 'tiktok', 'altra')),
  nom                text not null check (trim(nom) <> ''),   -- @gesop, GESOP…
  url                text,
  cadencia_setmanal  int check (cadencia_setmanal between 1 and 50), -- objectiu, opcional
  signatura          text,                                    -- hashtags o text fix
  actiu              boolean not null default true,
  creat_el           timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Publicacions
-- ------------------------------------------------------------
-- Circuit: idea → esborrany → (revisió → aprovada) → programada → publicada.
-- La revisió és opcional, però «aprovada» només la posa qui revisa.
-- Com a tot arreu (§4.1): publicada vol dir que té data_real.
create type estat_publicacio as enum
  ('idea', 'esborrany', 'revisio', 'aprovada', 'programada', 'publicada', 'cancellada');

create table publicacions (
  id               uuid primary key default gen_random_uuid(),
  titol            text not null check (trim(titol) <> ''),   -- nom intern
  text             text,                                      -- text base
  projecte_id      uuid references projectes(id),
  responsable_id   uuid references perfils(id) default auth.uid(),
  revisor_id       uuid references perfils(id),
  estat            estat_publicacio not null default 'esborrany',
  data_prevista    date,
  hora             time,
  data_real        date,
  enllac_recursos  text,          -- imatges/vídeo a SharePoint o Drive
  nota_revisio     text,          -- per què s'ha retornat
  aprovada_per     uuid references perfils(id),
  aprovada_el      timestamptz,
  notes            text,
  creada_per       uuid references perfils(id) default auth.uid(),
  creat_el         timestamptz not null default now(),
  actualitzat_el   timestamptz not null default now(),
  constraint publicacio_publicada_te_data check ((estat = 'publicada') = (data_real is not null))
);
create index on publicacions (data_prevista);
create index on publicacions (projecte_id);
create index on publicacions (responsable_id, estat);

-- A quins comptes va i, si cal, amb un text adaptat a cada xarxa.
-- No s'esborra: es desactiva.
create table publicacio_canals (
  publicacio_id    uuid not null references publicacions(id) on delete cascade,
  compte_id        uuid not null references xarxes_comptes(id),
  text_adaptat     text,
  enllac_publicat  text,
  actiu            boolean not null default true,
  primary key (publicacio_id, compte_id)
);
create index on publicacio_canals (compte_id);

-- ------------------------------------------------------------
-- 4. Dates clau per al calendari editorial
-- ------------------------------------------------------------
-- `recurrent`: cada any el mateix dia (l'any de `data` no compta).
create table efemerides (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  titol      text not null check (trim(titol) <> ''),
  recurrent  boolean not null default false,
  actiu      boolean not null default true,
  creat_el   timestamptz not null default now()
);

insert into efemerides (data, titol, recurrent)
select v.data::date, v.titol, true
from (values
  ('2000-03-08', 'Dia Internacional de les Dones'),
  ('2000-04-23', 'Sant Jordi'),
  ('2000-05-03', 'Dia Mundial de la Llibertat de Premsa'),
  ('2000-05-09', 'Dia d''Europa'),
  ('2000-09-11', 'Diada Nacional de Catalunya'),
  ('2000-09-15', 'Dia Internacional de la Democràcia'),
  ('2000-11-25', 'Dia Internacional per a l''Eliminació de la Violència contra les Dones'),
  ('2000-12-06', 'Dia de la Constitució')
) as v(data, titol)
where not exists (select 1 from efemerides);

-- ------------------------------------------------------------
-- 5. RLS: membres amb la funció activada. Cap delete (§7.2).
-- ------------------------------------------------------------
create or replace function pot_xarxes() returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.es_membre() and public.te_funcio('xarxes');
$$;
revoke all on function pot_xarxes() from public, anon;
grant execute on function pot_xarxes() to authenticated;

alter table xarxes_comptes    enable row level security;
alter table publicacions      enable row level security;
alter table publicacio_canals enable row level security;
alter table efemerides        enable row level security;

revoke all on xarxes_comptes, publicacions, publicacio_canals, efemerides from anon, authenticated;
grant select, insert, update on xarxes_comptes, publicacions, publicacio_canals, efemerides to authenticated;
-- la data prevista només per replanificar() (trigger d'historial)

create policy llegir    on xarxes_comptes for select to authenticated using (pot_xarxes());
create policy crear     on xarxes_comptes for insert to authenticated with check (pot_xarxes());
create policy modificar on xarxes_comptes for update to authenticated using (pot_xarxes()) with check (pot_xarxes());

create policy llegir    on publicacions for select to authenticated using (pot_xarxes());
create policy crear     on publicacions for insert to authenticated with check (pot_xarxes());
create policy modificar on publicacions for update to authenticated using (pot_xarxes()) with check (pot_xarxes());

create policy llegir    on publicacio_canals for select to authenticated using (pot_xarxes());
create policy crear     on publicacio_canals for insert to authenticated with check (pot_xarxes());
create policy modificar on publicacio_canals for update to authenticated using (pot_xarxes()) with check (pot_xarxes());

create policy llegir    on efemerides for select to authenticated using (pot_xarxes());
create policy crear     on efemerides for insert to authenticated with check (pot_xarxes());
create policy modificar on efemerides for update to authenticated using (pot_xarxes()) with check (pot_xarxes());

-- ------------------------------------------------------------
-- 6. Historial de dates (§4.2): també per a les publicacions
-- ------------------------------------------------------------
create trigger trg_data_publicacions before update on publicacions
  for each row execute function registra_canvi_data('data_prevista');

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
    when 'fases'        then 'data_prevista'
    when 'entregables'  then 'data_prevista'
    when 'tasques'      then 'data_prevista'
    when 'publicacions' then 'data_prevista'
    when 'projectes'    then 'data_fi_prevista'
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

-- ------------------------------------------------------------
-- 7. Regles del circuit (trigger: no es poden esquivar)
-- ------------------------------------------------------------
create or replace function valida_publicacio() returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  jo uuid := auth.uid();
begin
  new.actualitzat_el := now();

  -- Qui revisa ha de ser un altre membre amb la funció activada.
  if new.estat = 'revisio' and (tg_op = 'INSERT' or old.estat is distinct from 'revisio') then
    if new.revisor_id is null then
      raise exception 'Tria qui l''ha de revisar.' using errcode = 'P0001';
    end if;
    if new.revisor_id = coalesce(new.responsable_id, jo) then
      raise exception 'No et pots revisar tu mateix: tria una altra persona.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from perfils where id = new.revisor_id and actiu and not extern
                   and 'xarxes' = any(funcions)) then
      raise exception 'Qui revisa ha de tenir les xarxes socials activades.' using errcode = 'P0001';
    end if;
    new.nota_revisio := null;
  end if;

  -- «Aprovada» només la posa qui revisa, i només des de revisió.
  if new.estat = 'aprovada' and (tg_op = 'INSERT' or old.estat is distinct from 'aprovada') then
    if tg_op = 'INSERT' or old.estat <> 'revisio' or jo is distinct from old.revisor_id then
      raise exception 'Només qui la revisa la pot aprovar.' using errcode = 'P0001';
    end if;
    new.aprovada_per := jo;
    new.aprovada_el := now();
  end if;

  if tg_op = 'UPDATE' and old.estat = 'revisio' and new.estat = 'esborrany' then
    -- Retornar-la (qui revisa) demana una nota; retirar-la (qui la porta), no.
    if jo is not distinct from old.revisor_id
       and coalesce(trim(new.nota_revisio), '') = '' then
      raise exception 'Escriu què cal canviar per retornar-la.' using errcode = 'P0001';
    end if;
  end if;

  -- Si es toca el text d'una cosa aprovada, l'aprovació caduca.
  if tg_op = 'UPDATE' and old.estat in ('aprovada', 'programada') and new.estat = old.estat
     and new.text is distinct from old.text and old.aprovada_per is not null then
    new.estat := 'esborrany';
    new.aprovada_per := null;
    new.aprovada_el := null;
  end if;

  -- Publicada ⇔ data real (§4.1), que no pot ser futura. Reobrir treu la data.
  if new.estat = 'publicada' and new.data_real > current_date then
    raise exception 'La data real no pot ser posterior a avui.' using errcode = 'P0001';
  end if;
  if new.estat <> 'publicada' then
    new.data_real := null;
  end if;
  return new;
end;
$$;

create trigger trg_valida_publicacio
  before insert or update on publicacions
  for each row execute function valida_publicacio();

-- El text adaptat també compta: tocar-lo fa caducar l'aprovació.
create or replace function canal_toca_aprovacio() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.text_adaptat is distinct from old.text_adaptat then
    update publicacions
       set estat = 'esborrany', aprovada_per = null, aprovada_el = null
     where id = new.publicacio_id
       and estat in ('aprovada', 'programada')
       and aprovada_per is not null;
  end if;
  return new;
end;
$$;

create trigger trg_canal_toca_aprovacio
  after update on publicacio_canals
  for each row execute function canal_toca_aprovacio();

-- ------------------------------------------------------------
-- 8. Avisos (0009): revisió, aprovació, retorn i canvi de persona
-- ------------------------------------------------------------
create or replace function avisa_publicacio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  enllac text := '/xarxes/' || new.id;
begin
  if new.estat = 'revisio' and (tg_op = 'INSERT' or old.estat is distinct from 'revisio') then
    perform public.notifica(new.revisor_id, 'revisio',
      public.nom_actor() || ' et demana revisar la publicació «' || new.titol || '»', enllac);
  end if;
  if tg_op = 'UPDATE' and old.estat = 'revisio' and new.estat = 'aprovada' then
    perform public.notifica(new.responsable_id, 'revisio',
      public.nom_actor() || ' ha aprovat la publicació «' || new.titol || '»', enllac);
  end if;
  if tg_op = 'UPDATE' and old.estat = 'revisio' and new.estat = 'esborrany'
     and coalesce(trim(new.nota_revisio), '') <> '' then
    perform public.notifica(new.responsable_id, 'revisio',
      public.nom_actor() || ' ha retornat la publicació «' || new.titol || '»: ' || new.nota_revisio, enllac);
  end if;
  if tg_op = 'UPDATE' and new.responsable_id is distinct from old.responsable_id then
    perform public.notifica(new.responsable_id, 'assignacio',
      public.nom_actor() || ' t''ha passat la publicació «' || new.titol || '»', enllac);
  end if;
  return new;
end;
$$;
revoke all on function avisa_publicacio() from public, anon, authenticated;

create trigger trg_avisa_publicacio
  after insert or update on publicacions
  for each row execute function avisa_publicacio();

insert into migracions_aplicades (nom) values ('20261103000019_xarxes_socials') on conflict do nothing;

-- ============================================================
-- 0014 · Control de migracions, reobrir, fases per defecte,
--        nova onada i revisions d'entregables
-- ============================================================

-- ------------------------------------------------------------
-- 1. Quines migracions té aplicades la base de dades
-- ------------------------------------------------------------
-- Cada migració, a partir d'aquesta, acaba inserint-hi el seu nom. Així:
--   * l'app pot avisar si el codi desplegat espera una migració que la base de
--     dades no té (versio_esquema());
--   * el workflow de GitHub sap quines li falten, s'hagin aplicat a mà a
--     l'editor SQL o no.
create table migracions_aplicades (
  nom         text primary key,
  aplicada_el timestamptz not null default now()
);
alter table migracions_aplicades enable row level security;
revoke all on migracions_aplicades from anon, authenticated;
-- Sense polítiques: cap client hi llegeix ni hi escriu.

insert into migracions_aplicades (nom) values
  ('20261020000001_esquema'),
  ('20261020000002_rls'),
  ('20261020000003_triggers_rpc'),
  ('20261020000004_vistes'),
  ('20261021000005_fases_externs_numero'),
  ('20261022000006_altres_coresponsables'),
  ('20261023000007_arxivar_paperera'),
  ('20261024000008_colors_persones'),
  ('20261025000009_notificacions'),
  ('20261025000010_fases_per_defecte'),
  ('20261026000011_revisions'),
  ('20261027000012_safata_responsables'),
  ('20261028000013_transferir')
on conflict do nothing;

create or replace function versio_esquema() returns text
language sql stable security definer
set search_path = public
as $$
  select max(nom) from public.migracions_aplicades;
$$;
revoke all on function versio_esquema() from public, anon;
grant execute on function versio_esquema() to authenticated;

-- ------------------------------------------------------------
-- 2. Revisions també d'entregables
-- ------------------------------------------------------------
alter table revisions alter column tasca_id drop not null;
alter table revisions add column entregable_id uuid references entregables(id) on delete cascade;
alter table revisions add constraint revisio_un_sol_element
  check (num_nonnulls(tasca_id, entregable_id) = 1);
create unique index revisions_una_pendent_entregable on revisions (entregable_id) where estat = 'pendent';
create index on revisions (entregable_id);

create or replace function comprova_revisio_nova() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if num_nonnulls(new.tasca_id, new.entregable_id) <> 1 then
    return new;  -- ho rebutja el check revisio_un_sol_element
  end if;
  if new.tasca_id is not null then
    if not exists (select 1 from public.tasques where id = new.tasca_id and data_real is not null) then
      raise exception 'Només es pot enviar a revisar una tasca feta (amb data real).'
        using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.entregables where id = new.entregable_id and data_real is not null) then
    raise exception 'Només es pot enviar a revisar un entregable fet (amb data real).'
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfils where id = new.revisor_id and actiu and not extern) then
    raise exception 'El revisor ha de ser un membre actiu de l''equip.'
      using errcode = 'P0001';
  end if;
  new.estat := 'pendent';
  new.resolta_el := null;
  return new;
end;
$$;

-- Retornar-la reobre l'element, sigui tasca o entregable.
create or replace function reobre_tasca_retornada() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estat = 'retornada' and old.estat = 'pendent' then
    if new.tasca_id is not null then
      update public.tasques set data_real = null, estat = 'en_curs' where id = new.tasca_id;
    else
      update public.entregables set data_real = null, estat = 'en_curs' where id = new.entregable_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function avisa_revisio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  t record;
  text_base text;
begin
  if new.tasca_id is not null then
    select titol, projecte_id, assignada_a as persona into t from public.tasques where id = new.tasca_id;
  else
    select titol, projecte_id, responsable_id as persona into t from public.entregables where id = new.entregable_id;
  end if;

  if tg_op = 'INSERT' then
    perform public.notifica(new.revisor_id, 'revisio',
      public.nom_actor() || ' et demana que revisis «' || t.titol || '» · ' || public.titol_projecte(t.projecte_id),
      '/');
  elsif new.estat in ('aprovada', 'retornada') and old.estat = 'pendent' then
    text_base := public.nom_actor()
      || case when new.estat = 'aprovada' then ' ha aprovat «' else ' t''ha retornat «' end
      || t.titol || '»'
      || case when new.estat = 'retornada' then ': ' || new.comentari else '' end;
    perform public.notifica(new.demanada_per, 'revisio', text_base, '/projectes/' || t.projecte_id);
    -- si l'element és d'una altra persona, també ho sap
    if t.persona is distinct from new.demanada_per then
      perform public.notifica(t.persona, 'revisio', text_base, '/projectes/' || t.projecte_id);
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Reobrir: no es pot treure la data real a una cosa amb revisió pendent
-- ------------------------------------------------------------
-- Reobrir (tornar a pendent el que es va marcar fet o cancel·lar per error) és
-- un update normal. L'única regla: si hi ha una revisió esperant, primer
-- s'ha de resoldre o cancel·lar; si no, el revisor aprovaria una cosa oberta.
create or replace function impedeix_reobrir_en_revisio() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.data_real is not null and new.data_real is null and exists (
    select 1 from public.revisions r
    where r.estat = 'pendent'
      and case when tg_table_name = 'tasques' then r.tasca_id else r.entregable_id end = new.id
  ) then
    raise exception 'Té una revisió pendent: cancel·la-la o espera que la resolguin abans de reobrir-la.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_reobrir_tasques before update of data_real on tasques
  for each row execute function impedeix_reobrir_en_revisio();
create trigger trg_reobrir_entregables before update of data_real on entregables
  for each row execute function impedeix_reobrir_en_revisio();

-- ------------------------------------------------------------
-- 4. Passar un estudi antic a les fases per defecte de 0010
-- ------------------------------------------------------------
-- Només si no ha començat (cap fase amb data real) i les fases actives són
-- (totes o algunes de) les sis antigues. Res no s'esborra: es reanomenen
-- les que tenen equivalent (conserven dates, persona i tasques), s'afegeix
-- Briefing i Revisió, que no en té, es cancel·la amb les seves tasques a dins.
create or replace function aplica_fases_per_defecte(p_projecte uuid) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  antigues constant text[] := array['Qüestionari', 'Camp', 'Tabulació', 'Revisió', 'Informe', 'Presentació'];
  actives text[];
begin
  if not exists (select 1 from projectes where id = p_projecte and tipus = 'estudi') then
    raise exception 'Només els estudis tenen fases per defecte.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(nom), '{}') into actives
  from fases where projecte_id = p_projecte and estat <> 'cancellat';
  if cardinality(actives) = 0
     or not (actives <@ antigues)
     or cardinality(actives) <> (select count(distinct x) from unnest(actives) x) then
    raise exception 'Aquest estudi no té les fases per defecte antigues: canvia-les a mà.' using errcode = 'P0001';
  end if;
  if exists (select 1 from fases where projecte_id = p_projecte and data_real is not null) then
    raise exception 'Alguna fase ja consta acabada: l''estudi ha començat i les fases es canvien a mà.'
      using errcode = 'P0001';
  end if;

  set constraints all deferred;
  update fases set ordre = ordre + 3000 where projecte_id = p_projecte;

  update fases f set nom = m.nou, ordre = 1000 + m.ordre
  from (values ('Qüestionari', 'Qüestionari i mostra', 1),
               ('Camp', 'Camp', 3),
               ('Tabulació', 'Dades', 4),
               ('Informe', 'Informe', 5),
               ('Presentació', 'Presentació', 6)) as m(antic, nou, ordre)
  where f.projecte_id = p_projecte and f.estat <> 'cancellat' and f.nom = m.antic;

  update fases set estat = 'cancellat'
  where projecte_id = p_projecte and estat <> 'cancellat' and nom = 'Revisió';

  insert into fases (projecte_id, nom, ordre) values (p_projecte, 'Briefing', 1002);

  -- Numeració final: les actives 1..n i les cancel·lades al darrere.
  update fases f set ordre = n.r
  from (select id, row_number() over (order by (estat = 'cancellat'), ordre) as r
        from fases where projecte_id = p_projecte) n
  where f.id = n.id;
end;
$$;

revoke all on function aplica_fases_per_defecte(uuid) from public, anon;
grant execute on function aplica_fases_per_defecte(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Nova onada: duplicar un estudi amb les dates desplaçades
-- ------------------------------------------------------------
-- Copia les fases, els entregables i les tasques no cancel·lats amb la
-- mateixa gent (si continua activa) i les dates desplaçades al nou inici.
-- No copia dates reals, enllaços, notes, contactes ni historial: és una onada
-- nova, no una còpia de l'anterior.

-- Mentre es crea, ni fases per defecte ni un avís per cada tasca: en surt un
-- de resum per persona al final.
create or replace function crea_fases_estudi() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.tipus = 'estudi' and coalesce(current_setting('app.nova_onada', true), '') <> 'on' then
    insert into public.fases (projecte_id, nom, ordre)
    select new.id, nom, ordre
    from unnest(array['Qüestionari i mostra', 'Briefing', 'Camp', 'Dades', 'Informe', 'Presentació'])
         with ordinality as f(nom, ordre);
  end if;
  return new;
end;
$$;

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
  if coalesce(current_setting('app.nova_onada', true), '') = 'on' then
    return new;
  end if;

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
    perform public.notifica(dest, 'assignacio',
      public.nom_actor() || ' t''ha passat ' || que || ' «' || nom_el || '»'
        || case when abans is distinct from auth.uid() then ' (abans era de ' || coalesce(nom_abans, '?') || ')' else '' end
        || sufix,
      '/projectes/' || new.projecte_id);
    perform public.notifica(abans, 'assignacio',
      public.nom_actor() || ' ha passat ' || que || ' «' || nom_el || '» a '
        || coalesce(nom_dest, 'ningú') || sufix,
      '/projectes/' || new.projecte_id);
  end if;
  return new;
end;
$$;

-- Un sol avís per persona amb el que hi té a la nova onada. Security definer
-- perquè notifica() no és accessible als clients; només fa res amb un
-- projecte creat dins de la mateixa transacció (creat_el = now()), és a dir,
-- cridat des de nova_onada().
create or replace function avisa_nova_onada(p_projecte uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.es_membre()
     or not exists (select 1 from public.projectes where id = p_projecte and creat_el = now()) then
    return;
  end if;
  for r in
    select persona, count(*) as n from (
      select assignada_a as persona from public.tasques where projecte_id = p_projecte
      union all select responsable_id from public.fases where projecte_id = p_projecte
      union all select responsable_id from public.entregables where projecte_id = p_projecte
    ) x where persona is not null group by persona
  loop
    perform public.notifica(r.persona, 'assignacio',
      public.nom_actor() || ' ha creat la nova onada ' || public.titol_projecte(p_projecte)
        || ': hi tens ' || r.n || case when r.n = 1 then ' cosa assignada' else ' coses assignades' end,
      '/projectes/' || p_projecte);
  end loop;
end;
$$;
revoke all on function avisa_nova_onada(uuid) from public, anon;
grant execute on function avisa_nova_onada(uuid) to authenticated;

create or replace function nova_onada(
  p_origen uuid,
  p_titol  text,
  p_inici  date,
  p_numero text default null
) returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  o      projectes%rowtype;
  nou    uuid;
  base   date;
  delta  int;
  i      int := 0;
  nid    uuid;
  r      record;
  fmap   jsonb := '{}';
  emap   jsonb := '{}';
begin
  select * into o from projectes where id = p_origen;
  if not found then
    raise exception 'No s''ha trobat el projecte.' using errcode = 'P0001';
  end if;
  if o.tipus <> 'estudi' then
    raise exception 'Només es pot fer una nova onada d''un estudi.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_titol), '') = '' then
    raise exception 'Posa un títol a la nova onada.' using errcode = 'P0001';
  end if;
  if p_inici is null then
    raise exception 'Indica quan comença la nova onada.' using errcode = 'P0001';
  end if;

  -- Desplaçament: del començament de l'original (o de la primera data de
  -- fase, si no en té) al nou inici. Sense cap data, no hi ha res a desplaçar.
  base := coalesce(o.data_inici,
                   (select min(coalesce(data_inici, data_prevista)) from fases
                     where projecte_id = o.id and estat <> 'cancellat'));
  delta := p_inici - base;

  perform set_config('app.nova_onada', 'on', true);

  insert into projectes (client_id, titol, tipus, subtipus, responsable_id, data_inici,
                         data_fi_prevista, dies_silenci_max, numero_estudi)
  values (o.client_id, trim(p_titol), 'estudi', o.subtipus,
          case when exists (select 1 from perfils where id = o.responsable_id and actiu and not extern)
               then o.responsable_id else auth.uid() end,
          p_inici, o.data_fi_prevista + delta, o.dies_silenci_max,
          nullif(trim(coalesce(p_numero, '')), ''))
  returning id into nou;

  insert into projecte_responsables (projecte_id, perfil_id, actiu)
  select nou, pr.perfil_id, true
  from projecte_responsables pr join perfils pf on pf.id = pr.perfil_id
  where pr.projecte_id = o.id and pr.actiu and pf.actiu and not pf.extern
    and pr.perfil_id <> (select responsable_id from projectes where id = nou);

  for r in select * from fases where projecte_id = o.id and estat <> 'cancellat' order by ordre loop
    i := i + 1;
    insert into fases (projecte_id, nom, ordre, data_inici, data_prevista, responsable_id)
    values (nou, r.nom, i, r.data_inici + delta, r.data_prevista + delta,
            (select id from perfils where id = r.responsable_id and actiu))
    returning id into nid;
    fmap := fmap || jsonb_build_object(r.id::text, nid);
  end loop;

  for r in select * from entregables where projecte_id = o.id and estat <> 'cancellat' loop
    insert into entregables (projecte_id, titol, tipus, data_prevista, responsable_id)
    values (nou, r.titol, r.tipus, r.data_prevista + delta,
            (select id from perfils where id = r.responsable_id and actiu))
    returning id into nid;
    emap := emap || jsonb_build_object(r.id::text, nid);
  end loop;

  insert into tasques (projecte_id, fase_id, entregable_id, titol, descripcio, assignada_a,
                       data_prevista, prioritat)
  select nou,
         (fmap ->> t.fase_id::text)::uuid,
         (emap ->> t.entregable_id::text)::uuid,
         t.titol, t.descripcio,
         (select id from perfils where id = t.assignada_a and actiu),
         t.data_prevista + delta, t.prioritat
  from tasques t
  where t.projecte_id = o.id and t.estat <> 'cancellat';

  perform set_config('app.nova_onada', '', true);

  perform public.avisa_nova_onada(nou);

  return nou;
end;
$$;

revoke all on function nova_onada(uuid, text, date, text) from public, anon;
grant execute on function nova_onada(uuid, text, date, text) to authenticated;

insert into migracions_aplicades (nom) values ('20261029000014_reobrir_onades_versio') on conflict do nothing;

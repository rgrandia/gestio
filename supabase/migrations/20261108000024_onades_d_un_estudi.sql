-- ============================================================
-- 0024 · Onades d'un mateix estudi
-- ============================================================
-- Un estudi de diverses onades (p. ex. un baròmetre de 6) és UN estudi a
-- l'app: les onades es veuen juntes a la fitxa, amb un desplegable per onada.
--
-- Cada onada continua sent un projecte (§1: una sola entitat `projectes`),
-- amb les seves fases, tasques, entregables, dates i historial. Així la
-- safata, el cronograma, la cascada i l'historial no canvien. El que s'hi
-- afegeix és l'enllaç:
--   · `estudi_id`: la primera onada de l'estudi (l'arrel; s'apunta a si mateixa);
--   · `onada`: el número d'onada (1..N), per ordre d'inici.
-- Un projecte sense `estudi_id` és un estudi d'una sola onada, com fins ara.
--
-- Funcions:
--   · nova_onada()       ara la posa dins del mateix estudi (abans en feia un de solt);
--   · crea_onades()      crea de cop les que falten fins a N, cada X setmanes o mesos;
--   · agrupa_onades()    ajunta projectes que ja existien com a onades d'un estudi;
--   · treu_de_l_estudi() desfà l'enllaç d'una onada (no esborra res, §7.2).

alter table projectes
  add column estudi_id uuid references projectes(id),
  add column onada     int;
alter table projectes add constraint onada_amb_estudi
  check ((estudi_id is null) = (onada is null));
create index on projectes (estudi_id);

-- Coherència de l'enllaç, també per a updates directes: només estudis,
-- l'arrel s'apunta a si mateixa i les altres onades, a una arrel del mateix
-- client.
create or replace function valida_onada() returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  arrel projectes%rowtype;
begin
  if new.estudi_id is null then
    return new;
  end if;
  if new.tipus <> 'estudi' then
    raise exception 'Només els estudis poden tenir onades.' using errcode = 'P0001';
  end if;
  if new.estudi_id <> new.id then
    select * into arrel from projectes where id = new.estudi_id;
    if not found or arrel.estudi_id is distinct from arrel.id then
      raise exception 'L''estudi d''aquesta onada no existeix.' using errcode = 'P0001';
    end if;
    if arrel.client_id <> new.client_id then
      raise exception 'Totes les onades d''un estudi han de ser del mateix client.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_valida_onada
  before insert or update of estudi_id, onada, tipus, client_id on projectes
  for each row execute function valida_onada();

-- Numera les onades d'un estudi per ordre d'inici (les de la paperera no compten).
create or replace function renumera_onades(p_estudi uuid) returns void
language sql security invoker
set search_path = public
as $$
  update projectes p set onada = x.n
    from (select id, row_number() over (order by coalesce(data_inici, creat_el::date), creat_el, id) as n
            from projectes where estudi_id = p_estudi and eliminat_el is null) x
   where p.id = x.id and p.onada is distinct from x.n;
$$;

-- ------------------------------------------------------------
-- Nova onada: com a la 0014, però dins del mateix estudi. Si l'original
-- era solt, passa a ser la primera onada. Amb `app.onades_de_cop` (des de
-- crea_onades) no avisa per onada: crea_onades fa un sol avís de resum.
-- ------------------------------------------------------------
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
  estudi uuid;
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

  -- L'original entra a l'estudi (si no hi era) com a primera onada.
  estudi := coalesce(o.estudi_id, o.id);
  if o.estudi_id is null then
    update projectes set estudi_id = o.id, onada = 1 where id = o.id;
  end if;

  base := coalesce(o.data_inici,
                   (select min(coalesce(data_inici, data_prevista)) from fases
                     where projecte_id = o.id and estat <> 'cancellat'));
  delta := p_inici - base;

  perform set_config('app.nova_onada', 'on', true);

  insert into projectes (client_id, titol, tipus, subtipus, responsable_id, data_inici,
                         data_fi_prevista, dies_silenci_max, numero_estudi, estudi_id, onada)
  values (o.client_id, trim(p_titol), 'estudi', o.subtipus,
          case when exists (select 1 from perfils where id = o.responsable_id and actiu and not extern)
               then o.responsable_id else auth.uid() end,
          p_inici, o.data_fi_prevista + delta, o.dies_silenci_max,
          nullif(trim(coalesce(p_numero, '')), ''), estudi,
          (select coalesce(max(onada), 0) + 1 from projectes where estudi_id = estudi))
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
  perform renumera_onades(estudi);

  if coalesce(current_setting('app.onades_de_cop', true), '') <> 'on' then
    perform public.avisa_nova_onada(nou);
  end if;

  return nou;
end;
$$;

-- Un sol avís per persona quan es creen diverses onades de cop.
create or replace function avisa_noves_onades(p_estudi uuid, p_n int) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.es_membre() then
    return;
  end if;
  for r in
    select persona, count(*) as n from (
      select t.assignada_a as persona from public.tasques t join public.projectes p on p.id = t.projecte_id
        where p.estudi_id = p_estudi and p.creat_el = now()
      union all select f.responsable_id from public.fases f join public.projectes p on p.id = f.projecte_id
        where p.estudi_id = p_estudi and p.creat_el = now()
      union all select e.responsable_id from public.entregables e join public.projectes p on p.id = e.projecte_id
        where p.estudi_id = p_estudi and p.creat_el = now()
    ) x where persona is not null group by persona
  loop
    perform public.notifica(r.persona, 'assignacio',
      public.nom_actor() || ' ha creat ' || p_n || ' onades noves de ' || public.titol_projecte(p_estudi)
        || ': hi tens ' || r.n || case when r.n = 1 then ' cosa assignada' else ' coses assignades' end,
      '/projectes/' || p_estudi);
  end loop;
end;
$$;
revoke all on function avisa_noves_onades(uuid, int) from public, anon;
grant execute on function avisa_noves_onades(uuid, int) to authenticated;

-- ------------------------------------------------------------
-- Crear de cop les onades que falten fins a `p_total`, cada `p_cada`
-- setmanes o mesos des de l'onada d'origen (amb les seves fases, tasques i
-- dates). Torna quantes n'ha creat.
-- ------------------------------------------------------------
create or replace function crea_onades(
  p_origen uuid,
  p_total  int,
  p_cada   int,
  p_unitat text
) returns int
language plpgsql security invoker
set search_path = public
as $$
declare
  o       projectes%rowtype;
  estudi  uuid;
  ara     int;
  k       int;
  pas     interval;
  base    text;
  creades int := 0;
begin
  select * into o from projectes where id = p_origen;
  if not found then
    raise exception 'No s''ha trobat el projecte.' using errcode = 'P0001';
  end if;
  if o.tipus <> 'estudi' then
    raise exception 'Només els estudis poden tenir onades.' using errcode = 'P0001';
  end if;
  if o.data_inici is null then
    raise exception 'Posa primer la data d''inici de l''estudi: les onades es calculen a partir d''aquí.'
      using errcode = 'P0001';
  end if;
  if p_total is null or p_total < 2 or p_total > 52 then
    raise exception 'Indica quantes onades (entre 2 i 52).' using errcode = 'P0001';
  end if;
  if p_cada is null or p_cada < 1 or p_unitat not in ('setmanes', 'mesos') then
    raise exception 'Indica cada quantes setmanes o mesos.' using errcode = 'P0001';
  end if;
  pas := case p_unitat when 'setmanes' then make_interval(weeks => p_cada) else make_interval(months => p_cada) end;

  estudi := coalesce(o.estudi_id, o.id);
  ara := coalesce((select max(onada) from projectes where estudi_id = estudi and eliminat_el is null), 1);
  if ara >= p_total then
    raise exception 'L''estudi ja té % onades.', ara using errcode = 'P0001';
  end if;
  -- títol sense el «· onada N» del final, si en té
  base := regexp_replace(o.titol, '\s*[·-]\s*onada\s+\d+\s*$', '', 'i');

  perform set_config('app.onades_de_cop', 'on', true);
  for k in (ara + 1)..p_total loop
    perform nova_onada(o.id, base || ' · onada ' || k,
                       (o.data_inici + pas * (k - coalesce(o.onada, 1)))::date, null);
    creades := creades + 1;
  end loop;
  perform set_config('app.onades_de_cop', '', true);

  perform public.avisa_noves_onades(estudi, creades);
  return creades;
end;
$$;

-- ------------------------------------------------------------
-- Ajuntar projectes que ja existien com a onades d'un estudi: `p_estudi`
-- (o el seu estudi, si ja n'és una onada) i els projectes de la llista,
-- que han de ser estudis solts del mateix client. Es numeren per data.
-- ------------------------------------------------------------
create or replace function agrupa_onades(p_estudi uuid, p_projectes uuid[]) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  o      projectes%rowtype;
  estudi uuid;
  n      int;
begin
  select * into o from projectes where id = p_estudi;
  if not found or o.tipus <> 'estudi' then
    raise exception 'Només els estudis poden tenir onades.' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_projectes, 1), 0) = 0 then
    raise exception 'Tria quins projectes són onades d''aquest estudi.' using errcode = 'P0001';
  end if;
  select count(*) into n from projectes
   where id = any(p_projectes) and id <> p_estudi and tipus = 'estudi'
     and client_id = o.client_id and estudi_id is null and intern_de is null;
  if n <> (select count(distinct x) from unnest(p_projectes) x where x <> p_estudi) then
    raise exception 'Només es poden ajuntar estudis del mateix client que encara no són d''un altre estudi.'
      using errcode = 'P0001';
  end if;

  estudi := coalesce(o.estudi_id, o.id);
  if o.estudi_id is null then
    update projectes set estudi_id = o.id, onada = 1 where id = o.id;
  end if;
  update projectes set estudi_id = estudi,
         onada = 1000 + array_position(p_projectes, id)   -- provisional; es renumera tot seguit
   where id = any(p_projectes) and id <> p_estudi;
  perform renumera_onades(estudi);
end;
$$;

-- ------------------------------------------------------------
-- Treure una onada de l'estudi: torna a ser un estudi solt. Si és l'arrel,
-- la següent onada passa a ser-ne l'arrel. No s'esborra res.
-- ------------------------------------------------------------
create or replace function treu_de_l_estudi(p_projecte uuid) returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  o         projectes%rowtype;
  nova_arrel uuid;
  resten    int;
begin
  select * into o from projectes where id = p_projecte;
  if not found or o.estudi_id is null then
    raise exception 'Aquest projecte no és una onada de cap estudi.' using errcode = 'P0001';
  end if;
  if o.estudi_id = o.id then
    select id into nova_arrel from projectes
     where estudi_id = o.id and id <> o.id
     order by onada, creat_el limit 1;
    if nova_arrel is not null then
      -- primer la nova arrel s'apunta a si mateixa, després la resta hi apunta
      update projectes set estudi_id = nova_arrel where id = nova_arrel;
      update projectes set estudi_id = nova_arrel where estudi_id = o.id and id <> o.id;
    end if;
  else
    nova_arrel := o.estudi_id;
  end if;
  update projectes set estudi_id = null, onada = null where id = o.id;

  if nova_arrel is not null then
    select count(*) into resten from projectes where estudi_id = nova_arrel;
    if resten = 1 then
      -- una sola onada ja no és un estudi d'onades
      update projectes set estudi_id = null, onada = null where id = nova_arrel;
    else
      perform renumera_onades(nova_arrel);
    end if;
  end if;
end;
$$;

revoke all on function renumera_onades(uuid), crea_onades(uuid, int, int, text),
  agrupa_onades(uuid, uuid[]), treu_de_l_estudi(uuid) from public, anon;
grant execute on function renumera_onades(uuid), crea_onades(uuid, int, int, text),
  agrupa_onades(uuid, uuid[]), treu_de_l_estudi(uuid) to authenticated;

insert into migracions_aplicades (nom) values ('20261108000024_onades_d_un_estudi') on conflict do nothing;

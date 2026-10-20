-- ============================================================
-- 0009 · Notificacions dins de l'app
-- ============================================================
-- Avisos per a membres (mai externs) quan algú altre:
--   * els assigna una tasca, una fase o un entregable;
--   * els fa responsable o co-responsable d'un projecte;
--   * replanifica una cosa que és seva.
-- Les escriuen només els triggers (security definer). Cadascú veu i marca com
-- a llegides només les seves. No s'esborren (§7.2).

create table notificacions (
  id          bigserial primary key,
  perfil_id   uuid not null references perfils(id),   -- destinatari
  actor_id    uuid references perfils(id),            -- qui ho ha fet
  tipus       text not null,                          -- assignacio | responsable | replanificacio
  text        text not null,
  enllac      text,
  llegida_el  timestamptz,
  creat_el    timestamptz not null default now()
);
create index on notificacions (perfil_id, creat_el desc);
create index on notificacions (perfil_id) where llegida_el is null;

alter table notificacions enable row level security;
revoke all on notificacions from anon, authenticated;
grant select on notificacions to authenticated;
grant update (llegida_el) on notificacions to authenticated;

create policy llegir_propies on notificacions
  for select to authenticated using (perfil_id = auth.uid() and es_membre());
create policy marcar_propies on notificacions
  for update to authenticated
  using (perfil_id = auth.uid() and es_membre())
  with check (perfil_id = auth.uid());

-- ------------------------------------------------------------
-- Funció base: avisa un destinatari si és un membre actiu i no és qui ho fa.
-- ------------------------------------------------------------
create or replace function notifica(p_dest uuid, p_tipus text, p_text text, p_enllac text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_dest is null or p_dest is not distinct from auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.perfils where id = p_dest and actiu and not extern) then
    return;
  end if;
  insert into public.notificacions (perfil_id, actor_id, tipus, text, enllac)
  values (p_dest, auth.uid(), p_tipus, p_text, p_enllac);
end;
$$;

create or replace function nom_actor() returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce((select nom from public.perfils where id = auth.uid()), 'Algú');
$$;

create or replace function titol_projecte(p_id uuid) returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select case when numero_estudi is not null then numero_estudi || ' · ' else '' end || titol
       from public.projectes where id = p_id),
    'un projecte');
$$;

revoke all on function notifica(uuid, text, text, text) from public, anon, authenticated;
revoke all on function nom_actor() from public, anon;
revoke all on function titol_projecte(uuid) from public, anon;

-- ------------------------------------------------------------
-- Assignacions de tasques, fases i entregables
-- ------------------------------------------------------------
create or replace function avisa_assignacio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  dest     uuid;
  abans    uuid;
  que      text;
  nom_el   text;
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

  if dest is distinct from abans then
    perform public.notifica(
      dest, 'assignacio',
      public.nom_actor() || ' t''ha assignat ' || que || ' «' || nom_el || '» · '
        || public.titol_projecte(new.projecte_id),
      '/projectes/' || new.projecte_id);
  end if;
  return new;
end;
$$;

create trigger trg_avisa_tasca
  after insert or update of assignada_a on tasques
  for each row execute function avisa_assignacio();
create trigger trg_avisa_fase
  after insert or update of responsable_id on fases
  for each row execute function avisa_assignacio();
create trigger trg_avisa_entregable
  after insert or update of responsable_id on entregables
  for each row execute function avisa_assignacio();

-- ------------------------------------------------------------
-- Responsable i co-responsables de projecte
-- ------------------------------------------------------------
create or replace function avisa_responsable_projecte() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.responsable_id is distinct from old.responsable_id then
    perform public.notifica(
      new.responsable_id, 'responsable',
      public.nom_actor() || ' t''ha fet responsable de ' || public.titol_projecte(new.id),
      '/projectes/' || new.id);
  end if;
  return new;
end;
$$;

create trigger trg_avisa_responsable_projecte
  after insert or update of responsable_id on projectes
  for each row execute function avisa_responsable_projecte();

create or replace function avisa_coresponsable() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.actiu and (tg_op = 'INSERT' or not old.actiu) then
    perform public.notifica(
      new.perfil_id, 'responsable',
      public.nom_actor() || ' t''ha afegit com a co-responsable de ' || public.titol_projecte(new.projecte_id),
      '/projectes/' || new.projecte_id);
  end if;
  return new;
end;
$$;

create trigger trg_avisa_coresponsable
  after insert or update of actiu on projecte_responsables
  for each row execute function avisa_coresponsable();

-- ------------------------------------------------------------
-- Replanificacions: avisa qui en respon (el membre assignat o, si no n'hi
-- ha, tots els responsables del projecte). La primera planificació no avisa.
-- ------------------------------------------------------------
create or replace function avisa_replanificacio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  projecte  uuid;
  assignat  uuid;
  nom_el    text;
  dest      uuid;
  canvi     text;
begin
  if new.motiu = 'planificació inicial' then
    return new;
  end if;

  if new.taula = 'tasques' then
    select projecte_id, assignada_a, titol into projecte, assignat, nom_el from tasques where id = new.registre_id;
  elsif new.taula = 'fases' then
    select projecte_id, responsable_id, nom into projecte, assignat, nom_el from fases where id = new.registre_id;
  elsif new.taula = 'entregables' then
    select projecte_id, responsable_id, titol into projecte, assignat, nom_el from entregables where id = new.registre_id;
  else
    select id, null, 'la data de fi' into projecte, assignat, nom_el from projectes where id = new.registre_id;
  end if;
  if projecte is null then
    return new;
  end if;

  canvi := case
    when new.data_antiga is not null and new.data_nova is not null then
      ' (' || case when new.data_nova > new.data_antiga then '+' else '' end
           || (new.data_nova - new.data_antiga) || 'd)'
    else '' end;

  -- un membre assignat concret, o tots els responsables del projecte
  if assignat is not null
     and exists (select 1 from perfils where id = assignat and actiu and not extern) then
    perform public.notifica(assignat, 'replanificacio',
      public.nom_actor() || ' ha replanificat «' || nom_el || '»' || canvi || ': ' || new.motiu,
      '/projectes/' || projecte || '?pestanya=historial');
  else
    foreach dest in array public.responsables_projecte(projecte) loop
      perform public.notifica(dest, 'replanificacio',
        public.nom_actor() || ' ha replanificat «' || nom_el || '»' || canvi || ' a '
          || public.titol_projecte(projecte) || ': ' || new.motiu,
        '/projectes/' || projecte || '?pestanya=historial');
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_avisa_replanificacio
  after insert on historial_dates
  for each row execute function avisa_replanificacio();

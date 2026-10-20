-- ============================================================
-- 0011 · Enviar a revisar una tasca feta
-- ============================================================
-- Qui ha fet una tasca la pot enviar a revisar a un altre membre. El revisor
-- l'aprova o la retorna amb un comentari; retornar-la la reobre (se li treu la
-- data real: §4.1, una cosa està acabada quan té data_real). Cada ronda queda
-- desada; res no s'esborra (§7.2).

create type estat_revisio as enum ('pendent', 'aprovada', 'retornada', 'cancellada');

create table revisions (
  id            uuid primary key default gen_random_uuid(),
  tasca_id      uuid not null references tasques(id) on delete cascade,
  demanada_per  uuid not null references perfils(id) default auth.uid(),
  revisor_id    uuid not null references perfils(id),
  estat         estat_revisio not null default 'pendent',
  comentari     text,
  creat_el      timestamptz not null default now(),
  resolta_el    timestamptz,
  constraint revisio_a_un_altre check (revisor_id <> demanada_per),
  constraint revisio_retornada_amb_comentari
    check (estat <> 'retornada' or coalesce(trim(comentari), '') <> '')
);
-- Com a molt una revisió pendent per tasca.
create unique index revisions_una_pendent on revisions (tasca_id) where estat = 'pendent';
create index on revisions (revisor_id) where estat = 'pendent';
create index on revisions (demanada_per) where estat = 'pendent';

alter table revisions enable row level security;
revoke all on revisions from anon, authenticated;
grant select, insert on revisions to authenticated;
grant update (estat, comentari) on revisions to authenticated;

create policy llegir on revisions
  for select to authenticated using (es_membre());
-- Només es pot demanar en nom propi.
create policy demanar on revisions
  for insert to authenticated
  with check (es_membre() and demanada_per = auth.uid());
-- Només el revisor (per resoldre) o qui l'ha demanada (per cancel·lar-la).
create policy resoldre on revisions
  for update to authenticated
  using (es_membre() and estat = 'pendent' and auth.uid() in (revisor_id, demanada_per))
  with check (es_membre());

-- ------------------------------------------------------------
-- Regles en demanar-la: tasca feta i revisor membre actiu.
-- ------------------------------------------------------------
create or replace function comprova_revisio_nova() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.tasques where id = new.tasca_id and data_real is not null) then
    raise exception 'Només es pot enviar a revisar una tasca feta (amb data real).'
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

create trigger trg_comprova_revisio_nova
  before insert on revisions
  for each row execute function comprova_revisio_nova();

-- ------------------------------------------------------------
-- Regles en resoldre-la: el revisor aprova o retorna; qui la demana cancel·la.
-- ------------------------------------------------------------
create or replace function comprova_resolucio_revisio() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estat <> 'pendent' then
    raise exception 'Aquesta revisió ja està resolta.' using errcode = 'P0001';
  end if;
  if new.estat in ('aprovada', 'retornada') and auth.uid() is distinct from old.revisor_id then
    raise exception 'Només la persona revisora la pot aprovar o retornar.' using errcode = 'P0001';
  end if;
  if new.estat = 'cancellada' and auth.uid() is distinct from old.demanada_per then
    raise exception 'Només qui l''ha demanada la pot cancel·lar.' using errcode = 'P0001';
  end if;
  if new.estat <> 'pendent' then
    new.resolta_el := now();
  end if;
  return new;
end;
$$;

create trigger trg_comprova_resolucio_revisio
  before update on revisions
  for each row execute function comprova_resolucio_revisio();

-- Retornar-la reobre la tasca (security invoker: el revisor és membre i té
-- permís per modificar tasques).
create or replace function reobre_tasca_retornada() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estat = 'retornada' and old.estat = 'pendent' then
    update public.tasques set data_real = null, estat = 'en_curs' where id = new.tasca_id;
  end if;
  return new;
end;
$$;

create trigger trg_reobre_tasca_retornada
  after update on revisions
  for each row execute function reobre_tasca_retornada();

-- ------------------------------------------------------------
-- Avisos
-- ------------------------------------------------------------
create or replace function avisa_revisio() returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  t record;
  text_base text;
begin
  select titol, projecte_id, assignada_a into t from public.tasques where id = new.tasca_id;

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
    -- si la tasca és d'una altra persona, també ho sap
    if t.assignada_a is distinct from new.demanada_per then
      perform public.notifica(t.assignada_a, 'revisio', text_base, '/projectes/' || t.projecte_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_avisa_revisio
  after insert or update of estat on revisions
  for each row execute function avisa_revisio();

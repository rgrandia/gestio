-- ============================================================
-- 0002 · RLS i privilegis (CLAUDE.md §7)
-- ============================================================
-- Correccions respecte al text de referència:
--
--   1. "Sense política de delete, Postgres el denega" és cert només a mitges:
--      amb RLS i sense política, un DELETE NO falla, afecta 0 files en
--      silenci. Perquè falli de debò (comprovació 2 de §7.3) cal treure el
--      privilegi DELETE als rols `anon` i `authenticated`. Es fa a sota.
--
--   2. La política `editar_propi_perfil` de referència permetia que un
--      usuari desactivat es reactivés ell mateix (`update perfils set
--      actiu = true where id = auth.uid()`). Ara només es pot modificar la
--      columna `nom`; `actiu` i `email` només es toquen des del panell.
--
--   3. Les funcions `security definer` fixen `search_path` (si no, es poden
--      segrestar creant objectes amb el mateix nom en un altre esquema).

alter table perfils          enable row level security;
alter table clients          enable row level security;
alter table projectes        enable row level security;
alter table fases            enable row level security;
alter table entregables      enable row level security;
alter table tasques          enable row level security;
alter table contactes        enable row level security;
alter table idees            enable row level security;
alter table historial_dates  enable row level security;

-- ------------------------------------------------------------
-- Privilegis de taula. `anon` no toca res; `authenticated` mai esborra.
-- ------------------------------------------------------------
revoke all on perfils, clients, projectes, fases, entregables, tasques,
              contactes, idees, historial_dates
  from anon, authenticated;

grant select, insert, update on clients, projectes, fases, entregables,
                                tasques, contactes, idees
  to authenticated;

grant select on perfils to authenticated;
grant update (nom) on perfils to authenticated;

grant select on historial_dates to authenticated;

-- ------------------------------------------------------------
-- Funció auxiliar
-- ------------------------------------------------------------
create or replace function es_membre() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfils where id = auth.uid() and actiu = true
  );
$$;

revoke all on function es_membre() from public, anon;
grant execute on function es_membre() to authenticated;

-- ------------------------------------------------------------
-- Patró general: només select, insert i update. Cap delete, enlloc.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'projectes', 'fases', 'entregables',
                           'tasques', 'contactes', 'idees']
  loop
    execute format('create policy llegir on %I for select to authenticated using (es_membre())', t);
    execute format('create policy crear on %I for insert to authenticated with check (es_membre())', t);
    execute format('create policy modificar on %I for update to authenticated using (es_membre()) with check (es_membre())', t);
  end loop;
end;
$$;

-- Perfils: cadascú modifica només el seu (i només el nom, vegeu grant)
create policy llegir_perfils on perfils
  for select to authenticated using (es_membre());

create policy editar_propi_perfil on perfils
  for update to authenticated
  using (id = auth.uid() and es_membre())
  with check (id = auth.uid());

-- Historial: append-only. Només hi escriu el trigger (security definer).
create policy llegir_historial on historial_dates
  for select to authenticated using (es_membre());

-- ------------------------------------------------------------
-- Alta de perfils
-- ------------------------------------------------------------
-- Cada usuari nou d'auth.users rep un perfil INACTIU. S'activa a mà:
--   update perfils set actiu = true where email = '...';
-- Motiu: amb Entra ID, qualsevol persona del tenant de GESOP que entri
-- crearia un usuari; si el perfil naixés actiu, tindria accés a tot.
create or replace function crea_perfil_nou() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.perfils (id, nom, email, actiu)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             split_part(new.email, '@', 1)),
    new.email,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_crea_perfil
  after insert on auth.users
  for each row execute function crea_perfil_nou();

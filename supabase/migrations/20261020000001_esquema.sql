-- ============================================================
-- 0001 · Esquema base (CLAUDE.md §4.3)
-- ============================================================
-- Diferències respecte a l'esquema de referència, totes additives:
--   * check `*_fet_te_data_real`: una cosa és `fet` només si té `data_real`
--     (regla central §4.1). Sense el check, es pot marcar `fet` sense data
--     i la comparació previst/real queda coixa.
--   * check `clients_tipus`: valors tancats del comentari de l'esquema.
--   * zona horària Europe/Madrid perquè `current_date` no canviï de dia a
--     les 22:00/23:00 hora local (Supabase treballa en UTC per defecte).

alter database postgres set timezone to 'Europe/Madrid';

-- ------------------------------------------------------------
-- TIPUS
-- ------------------------------------------------------------
create type tipus_projecte as enum ('estudi', 'consultoria');
create type estat_item     as enum ('pendent', 'en_curs', 'fet', 'cancellat');
create type estat_projecte as enum ('actiu', 'pausat', 'tancat', 'cancellat');
create type estat_idea     as enum ('proposada', 'valorada', 'assignada', 'descartada');
create type prioritat      as enum ('alta', 'normal', 'baixa');

-- ------------------------------------------------------------
-- PERFILS (1:1 amb auth.users)
-- ------------------------------------------------------------
create table perfils (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  email       text not null,
  actiu       boolean not null default true,
  creat_el    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CLIENTS
-- ------------------------------------------------------------
create table clients (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  tipus           text not null,
  territori       text,
  responsable_id  uuid references perfils(id),
  notes           text,
  actiu           boolean not null default true,
  creat_el        timestamptz not null default now(),
  constraint clients_tipus
    check (tipus in ('municipi', 'partit', 'institucio', 'altre'))
);

-- ------------------------------------------------------------
-- PROJECTES
-- ------------------------------------------------------------
create table projectes (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id),
  titol             text not null,
  tipus             tipus_projecte not null,
  subtipus          text,
  responsable_id    uuid not null references perfils(id),
  estat             estat_projecte not null default 'actiu',
  data_inici        date,
  data_fi_prevista  date,
  data_fi_real      date,
  dies_silenci_max  int not null default 45 check (dies_silenci_max > 0),
  notes             text,
  creat_el          timestamptz not null default now(),
  actualitzat_el    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- FASES (només projectes de tipus 'estudi')
-- ------------------------------------------------------------
create table fases (
  id              uuid primary key default gen_random_uuid(),
  projecte_id     uuid not null references projectes(id) on delete cascade,
  nom             text not null,
  ordre           int not null,
  data_prevista   date,
  data_real       date,
  estat           estat_item not null default 'pendent',
  revisat_el      date,
  responsable_id  uuid references perfils(id),
  notes           text,
  unique (projecte_id, ordre) deferrable initially immediate,
  constraint fases_fet_te_data_real check (estat <> 'fet' or data_real is not null)
);

-- ------------------------------------------------------------
-- ENTREGABLES
-- ------------------------------------------------------------
create table entregables (
  id              uuid primary key default gen_random_uuid(),
  projecte_id     uuid not null references projectes(id) on delete cascade,
  titol           text not null,
  tipus           text,
  data_prevista   date,
  data_real       date,
  estat           estat_item not null default 'pendent',
  revisat_el      date,
  responsable_id  uuid references perfils(id),
  enllac          text,
  notes           text,
  constraint entregables_fet_te_data_real check (estat <> 'fet' or data_real is not null)
);

-- ------------------------------------------------------------
-- TASQUES — pengen SEMPRE del projecte
-- ------------------------------------------------------------
create table tasques (
  id              uuid primary key default gen_random_uuid(),
  projecte_id     uuid not null references projectes(id) on delete cascade,
  fase_id         uuid references fases(id) on delete set null,
  entregable_id   uuid references entregables(id) on delete set null,
  titol           text not null,
  descripcio      text,
  assignada_a     uuid references perfils(id),
  data_prevista   date,
  data_real       date,
  estat           estat_item not null default 'pendent',
  prioritat       prioritat not null default 'normal',
  revisat_el      date,
  creada_per      uuid references perfils(id) default auth.uid(),
  creat_el        timestamptz not null default now(),
  constraint tasca_una_sola_ancora
    check (fase_id is null or entregable_id is null),
  constraint tasques_fet_te_data_real check (estat <> 'fet' or data_real is not null)
);

-- ------------------------------------------------------------
-- CONTACTES (alimenta l'estat "mut")
-- ------------------------------------------------------------
create table contactes (
  id            uuid primary key default gen_random_uuid(),
  projecte_id   uuid not null references projectes(id) on delete cascade,
  data          date not null default current_date,
  tipus         text,
  resum         text,
  usuari_id     uuid references perfils(id) default auth.uid(),
  creat_el      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- IDEES
-- ------------------------------------------------------------
create table idees (
  id              uuid primary key default gen_random_uuid(),
  titol           text not null,
  descripcio      text,
  client_id       uuid references clients(id),
  projecte_id     uuid references projectes(id),
  estat           estat_idea not null default 'proposada',
  proposada_per   uuid references perfils(id) default auth.uid(),
  data_objectiu   date,
  creat_el        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- HISTORIAL DE DATES (append-only)
-- ------------------------------------------------------------
create table historial_dates (
  id              bigserial primary key,
  taula           text not null,
  registre_id     uuid not null,
  data_antiga     date,
  data_nova       date,
  motiu           text not null,
  usuari_id       uuid references perfils(id) default auth.uid(),
  creat_el        timestamptz not null default now()
);

create index on historial_dates (taula, registre_id);
create index on tasques (assignada_a, estat);
create index on tasques (projecte_id);
create index on fases (projecte_id);
create index on entregables (projecte_id);
create index on contactes (projecte_id, data desc);
create index on projectes (client_id);
create index on idees (client_id);

# CLAUDE.md — App de gestió del Departament d'Estudis Polítics i Estratègia (GESOP)

Aquest fitxer és l'especificació de referència del projecte. Qualsevol decisió que
contradigui aquest document s'ha de consultar abans d'implementar-la.

---

## 1. Què és aquesta app

Eina interna de supervisió de projectes del departament. Gestiona **metadades de
projectes**: qui porta què, en quina fase està, quan havia d'estar acabat i què
s'ha de revisar avui.

El departament fa dues coses i totes dues han de cabre al mateix model:

1. **Estudis** — projectes de recerca amb procés lineal i fases fixes.
2. **Consultoria d'estratègia** — workflow no lineal, basat en entregables solts
   i contacte continuat amb el client.

### Principi de disseny

Una sola entitat `projectes` amb un camp `tipus`. El tipus només determina dues
coses: si el projecte té fases predefinides i quines vistes es mostren. Tota la
resta (client, tasques, responsables, dates, idees) és compartida.

**No facis dos mòduls separats.** És l'error que mataria el projecte.

---

## 2. Límits d'abast — regles dures

### Què NO hi entra mai

- **Cap microdada d'enquesta.** Ni respostes individuals, ni fitxers SAV/SPSS, ni
  res identificable de persones entrevistades. Les opinions polítiques són
  categoria especial de l'article 9 del RGPD i aquesta app no està dissenyada per
  tractar-les. Només metadades de projecte.
- **Cap dada personal de ciutadans.** Els únics noms de persones que hi ha són
  els usuaris del departament i, com a molt, el càrrec de contacte del client.
- **Imputació d'hores.** Si ja es fa en un altre sistema, no es duplica aquí.

### Què NO fa l'MVP

- Sincronització bidireccional amb Planner, To Do, Asana o similars.
- Lectura de correu electrònic.
- Gràfics, percentatges d'avanç o mètriques agregades. (El **cronograma**
  —Gantt de projectes i fases— s'hi va afegir com a prova l'octubre de 2026,
  per decisió del client.)
- Notificacions per correu o Teams. (Hi ha **avisos dins de l'app** des de
  l'octubre de 2026, migració 0009; el correu continua fora.)
- Pujada de fitxers (només enllaços a SharePoint/Drive).
- App mòbil nativa (només web responsive).

Si una funció no apareix a la secció 6, no s'implementa sense preguntar.

---

## 3. Stack

| Capa | Tecnologia |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Base de dades | Supabase (Postgres) — **regió europea** (Frankfurt o París) |
| Autenticació | Supabase Auth |
| Desplegament | Vercel |
| Repositori | GitHub |
| Estils | Tailwind CSS |

### Autenticació — decisió pendent de confirmar

L'opció preferida és **Entra ID (Azure) com a proveïdor OAuth de Supabase**, de
manera que tothom entri amb el compte de GESOP. Requereix que l'IT de GESOP faci
l'app registration al tenant.

Si l'IT no ho autoritza, el pla B és **email + password de Supabase**, amb convit
manual (sense registre obert). En aquest cas:

- Registre públic desactivat. Els usuaris es creen des del panell de Supabase.
- Contrasenya mínima de 12 caràcters.
- Avís explícit a la documentació: no reutilitzar la contrasenya corporativa.

Implementa l'autenticació aïllada en un mòdul propi perquè canviar de proveïdor
no obligui a tocar la resta de l'app.

### Seguretat — no negociable

- **RLS activat a totes les taules des del primer dia.** Cap taula es crea sense
  la seva política. Supabase exposa Postgres al client: una taula sense RLS és
  llegible per qualsevol usuari autenticat amb la clau `anon`.
- `.env.local` al `.gitignore` abans del primer commit.
- La clau `service_role` no surt mai del servidor ni entra al repositori. Si
  apareix en codi de client, és un bug crític.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` pot ser pública (és el disseny previst), però
  només perquè les polítiques RLS la contenen.

---

## 4. Model de dades

### 4.1 Regla central de les dates

> **Una cosa està acabada quan té `data_real`, no quan algú canvia l'estat.**

Cada fase, entregable i tasca té `data_prevista` i `data_real`. `data_real` pot
ser anterior a avui (es marca a posteriori). Això permet comparar sempre previst
contra real.

### 4.2 Historial de replanificacions

Qualsevol canvi de `data_prevista` escriu una fila a `historial_dates` amb motiu
obligatori. Sense això, al cap de tres mesos tot constarà entregat a temps perquè
les dates hauran anat lliscant en silenci. És el que permet veure que l'informe
d'un client s'ha ajornat quatre vegades abans d'una reunió amb ell.

Implementar-ho amb un **trigger de Postgres**, no a l'aplicació, perquè no es
pugui esquivar.

### 4.3 Esquema SQL

```sql
-- ============================================================
-- TIPUS
-- ============================================================
create type tipus_projecte as enum ('estudi', 'consultoria');
create type estat_item     as enum ('pendent', 'en_curs', 'fet', 'cancellat');
create type estat_projecte as enum ('actiu', 'pausat', 'tancat', 'cancellat');
create type estat_idea     as enum ('proposada', 'valorada', 'assignada', 'descartada');
create type prioritat      as enum ('alta', 'normal', 'baixa');

-- ============================================================
-- PERFILS (1:1 amb auth.users)
-- ============================================================
create table perfils (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  email       text not null,
  actiu       boolean not null default true,
  creat_el    timestamptz not null default now()
);

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  tipus           text not null,          -- municipi | partit | institucio | altre
  territori       text,                   -- comarca o àmbit
  responsable_id  uuid references perfils(id),
  notes           text,
  actiu           boolean not null default true,
  creat_el        timestamptz not null default now()
);

-- ============================================================
-- PROJECTES
-- ============================================================
create table projectes (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id),
  titol             text not null,
  tipus             tipus_projecte not null,
  subtipus          text,                 -- barometre | electoral | qualitatiu |
                                          -- pla_comunicacio | acompanyament | ...
  responsable_id    uuid not null references perfils(id),
  estat             estat_projecte not null default 'actiu',
  data_inici        date,
  data_fi_prevista  date,
  data_fi_real      date,
  dies_silenci_max  int not null default 45,  -- llindar "mut", per projecte
  notes             text,
  creat_el          timestamptz not null default now(),
  actualitzat_el    timestamptz not null default now()
);

-- ============================================================
-- FASES (només projectes de tipus 'estudi')
-- ============================================================
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
  unique (projecte_id, ordre)
);

-- ============================================================
-- ENTREGABLES (sobretot consultoria; un estudi també en pot tenir)
-- ============================================================
create table entregables (
  id              uuid primary key default gen_random_uuid(),
  projecte_id     uuid not null references projectes(id) on delete cascade,
  titol           text not null,
  tipus           text,                   -- informe | discurs | nota | pla | altre
  data_prevista   date,
  data_real       date,
  estat           estat_item not null default 'pendent',
  revisat_el      date,
  responsable_id  uuid references perfils(id),
  enllac          text,                   -- SharePoint / Drive
  notes           text
);

-- ============================================================
-- TASQUES
-- Pengen SEMPRE del projecte. Fase i entregable són opcionals.
-- ============================================================
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
  creada_per      uuid references perfils(id),
  creat_el        timestamptz not null default now(),
  constraint tasca_una_sola_ancora
    check (fase_id is null or entregable_id is null)
);

-- ============================================================
-- CONTACTES (alimenta l'estat "mut")
-- ============================================================
create table contactes (
  id            uuid primary key default gen_random_uuid(),
  projecte_id   uuid not null references projectes(id) on delete cascade,
  data          date not null default current_date,
  tipus         text,                     -- reunio | trucada | correu | presentacio
  resum         text,
  usuari_id     uuid references perfils(id),
  creat_el      timestamptz not null default now()
);

-- ============================================================
-- IDEES
-- ============================================================
create table idees (
  id              uuid primary key default gen_random_uuid(),
  titol           text not null,
  descripcio      text,
  client_id       uuid references clients(id),
  projecte_id     uuid references projectes(id),
  estat           estat_idea not null default 'proposada',
  proposada_per   uuid references perfils(id),
  data_objectiu   date,                   -- moment polític en què té sentit
  creat_el        timestamptz not null default now()
);

-- ============================================================
-- HISTORIAL DE DATES (append-only)
-- ============================================================
create table historial_dates (
  id              bigserial primary key,
  taula           text not null,          -- fases | entregables | tasques | projectes
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
```

### 4.4 Fases per defecte d'un estudi

En crear un projecte de tipus `estudi`, es generen aquestes sis fases amb
`ordre` 1..6. Són editables: se'n poden afegir, reordenar o cancel·lar (mai
esborrar, vegeu 7.2). Aquest és el punt de partida:

1. Qüestionari i mostra
2. Briefing
3. Camp
4. Dades
5. Informe
6. Presentació

(Canviades l'octubre de 2026, migració 0010; abans: Qüestionari, Camp,
Tabulació, Revisió, Informe, Presentació. Els estudis ja creats no es toquen.)

Un projecte de tipus `consultoria` **no genera cap fase**.

### 4.4 bis Ampliacions (octubre 2026, migració 0005)

- **Fases amb inici previst** (`fases.data_inici`). `data_prevista` és el final
  previst: és el que mira la safata i l'únic amb historial obligatori.
  L'inici es canvia directament, sense motiu.
- **Número d'estudi** (`projectes.numero_estudi`): 4 xifres, opcional, únic.
- **Persones externes** (`perfils.extern = true`, amb `area`): gent sense accés
  a l'app (p. ex. algú de dades) a qui s'assigna una fase, un entregable o una
  tasca només per saber qui ho fa. Es creen per RPC (`crea_persona_externa`),
  mai no poden entrar (`es_membre()` les exclou) i no poden ser responsables
  de projecte ni de client. A la safata, el que és d'un extern, d'una persona
  inactiva o de ningú li surt al responsable del projecte.
- Per això `perfils.id` ja no és clau forana d'`auth.users`. Esborrar un usuari
  d'auth desactiva el seu perfil en lloc d'esborrar-lo.

### 4.4 ter Ampliacions (octubre 2026, migració 0006)

- **Tipus `altre`** a `tipus_projecte`: ni estudi ni consultoria. No genera
  fases, té entregables i tasques i no pot ser "mut".
- **Co-responsables** (`projecte_responsables`, amb `actiu` en lloc d'esborrar):
  `projectes.responsable_id` continua sent el principal. Els co-responsables
  veuen a la seva safata el que és del projecte (sense assignar o d'un extern);
  el que està assignat a un membre concret només el veu ell. Ni el principal ni
  els co-responsables poden ser externs (trigger). La safata exposa
  `responsables uuid[]` i "els meus" filtra per pertinença.

### 4.4 quater Colors de persona (migració 0008)

`perfils.color`: cada persona té un color propi de la paleta (`paleta_colors()`),
assignat automàticament en donar-la d'alta. Entre membres actius no es pot
repetir (trigger). Cadascú canvia el seu des de la pantalla d'equip; els
externs, per RPC. Serveix per distingir persones amb la mateixa inicial.

### 4.5 Qui actualitza les fases

**Només el responsable del projecte** (membre del departament). El camp i la
tabulació els fan altres equips o proveïdors i no entraran mai a l'app.

Conseqüència de disseny: l'app **no sap** si una fase ha acabat de veritat. El que
fa és dir-te què hauria d'haver acabat i no consta acabat, perquè ho preguntis.
No escriguis enlloc missatges que donin a entendre que l'estat és automàtic.

---

## 5. Lògica de la safata de revisió

Els tres estats són **calculats en vistes SQL, mai desats en columnes**.

| Estat | Condició |
|---|---|
| **Vençut** | `data_prevista < current_date` i `data_real is null` i estat no és `fet`/`cancellat` |
| **En risc** | `data_prevista` entre avui i avui+5 dies, no acabat |
| **Mut** | Projecte `actiu` de tipus `consultoria` sense cap contacte ni entregable amb `data_real` en els darrers `dies_silenci_max` dies |

### Snooze de 7 dies

Un element amb `revisat_el` dins dels darrers 7 dies **no apareix** a la safata.
Passats 7 dies, hi torna. No és descartar: és ajornar la molèstia.

Sense aquest mecanisme la safata és inútil en una setmana. Amb un snooze sense
caducitat es convertiria en una paperera. Els 7 dies són fixos, no configurables.

### Vista SQL

```sql
create or replace view v_safata as
with items as (
  select 'tasca'::text as tipus_item, t.id, t.titol, t.projecte_id,
         t.data_prevista, t.data_real, t.estat::text, t.revisat_el,
         t.assignada_a as responsable_id
  from tasques t
  union all
  select 'fase', f.id, f.nom, f.projecte_id,
         f.data_prevista, f.data_real, f.estat::text, f.revisat_el,
         coalesce(f.responsable_id, p.responsable_id)
  from fases f join projectes p on p.id = f.projecte_id
  union all
  select 'entregable', e.id, e.titol, e.projecte_id,
         e.data_prevista, e.data_real, e.estat::text, e.revisat_el,
         coalesce(e.responsable_id, p.responsable_id)
  from entregables e join projectes p on p.id = e.projecte_id
)
select i.*,
       pr.titol as projecte, pr.tipus as tipus_projecte,
       c.nom as client,
       case
         when i.data_prevista < current_date then 'vencut'
         else 'en_risc'
       end as motiu,
       current_date - i.data_prevista as dies_retard
from items i
join projectes pr on pr.id = i.projecte_id
join clients   c  on c.id  = pr.client_id
where i.data_real is null
  and i.estat not in ('fet', 'cancellat')
  and pr.estat = 'actiu'
  and i.data_prevista is not null
  and i.data_prevista <= current_date + 5
  and (i.revisat_el is null or i.revisat_el < current_date - 7);
```

```sql
create or replace view v_projectes_muts as
select p.id, p.titol, c.nom as client, p.responsable_id,
       greatest(
         coalesce(max(co.data), '1900-01-01'::date),
         coalesce(max(e.data_real), '1900-01-01'::date)
       ) as darrer_senyal
from projectes p
join clients c on c.id = p.client_id
left join contactes   co on co.projecte_id = p.id
left join entregables e  on e.projecte_id = p.id and e.data_real is not null
where p.estat = 'actiu' and p.tipus = 'consultoria'
group by p.id, c.nom
having greatest(
         coalesce(max(co.data), '1900-01-01'::date),
         coalesce(max(e.data_real), '1900-01-01'::date)
       ) < current_date - (select dies_silenci_max from projectes x where x.id = p.id);
```

### Accions de cada línia de la safata

Cada línia ha de tenir aquestes quatre accions **sense sortir de la pantalla**.
Si cal navegar al detall del projecte per resoldre una línia, el disseny falla.

1. **Marcar fet** → demana `data_real` (per defecte avui, pot ser anterior).
2. **Replanificar** → demana nova `data_prevista` + motiu obligatori → trigger a
   `historial_dates`.
3. **Revisat, encara viu** → `revisat_el = current_date`. Desapareix 7 dies.
4. **Cancel·lar** → `estat = 'cancellat'`. Deixa de comptar.

---

## 6. Pantalles de l'MVP

Quatre, més les afegides l'octubre de 2026: **equip** (membres i persones
externes), **avisos** (notificacions dins de l'app), **cronograma** (prova de
Gantt) i **feina de l'equip** (què té obert cadascú), a més d'una **cerca
global** al menú (tecla `/`). Cap més sense preguntar. Estil visual: secció 11.

### 6.1 La meva setmana (pàgina d'inici)

Llistes accionables, sense gràfics ni percentatges:

- **A revisar** — la safata (secció 5), filtrada per on soc responsable, amb
  commutador per veure-ho tot.
- **Aquesta setmana** — les meves tasques amb `data_prevista` dins dels 7 dies.
- **Projectes muts** — només si en soc responsable.
- **Les meves idees** en estat `proposada`.

Criteri: si l'obro cada matí i hi ha feina concreta a fer, l'app viu. Si hi ha
percentatges d'avanç, mor.

### 6.2 Projectes

Llista amb filtres per tipus, client, responsable i estat. Detall del projecte:

- Capçalera: client, responsable, dates, estat.
- Si és **estudi**: línia de fases amb previst/real i el retard de cadascuna.
- Si és **consultoria**: entregables i historial de contactes.
- Tasques del projecte en tots dos casos.
- Pestanya d'historial de replanificacions.

### 6.3 Idees

Safata simple amb el circuit `proposada → valorada → assignada → descartada`.
Des de "assignada" es pot convertir en projecte o entregable.

### 6.4 Clients

Fitxa per client: projectes actius i tancats, data de darrer contacte, idees
obertes. Serveix per preparar una reunió en trenta segons.

---

## 7. Usuaris i polítiques RLS

### 7.1 Usuaris

Tres persones, **totes amb els mateixos permisos**: Roc, Rocío i Aina.

No hi ha rols. Amb un equip de tres, un rol d'administrador només hauria servit
per obligar algú a demanar permís per esborrar una tasca mal creada, i això
acaba en "ja ho deixo, total no molesta". Si algun dia l'equip creix i cal
diferenciar permisos, s'afegeix llavors.

### 7.2 Res no s'esborra mai

**Cap taula té política de `delete`.** Sense política, Postgres el denega: no és
una convenció que es pugui oblidar, és una impossibilitat tècnica.

El que es fa en lloc d'esborrar:

- Tasques, fases i entregables → `estat = 'cancellat'`.
- Projectes → `estat = 'cancellat'` o `'tancat'`. A més (migració 0007):
  **arxivar** (`arxivat_el`: fora de safata, llistes i comptadors; filtre
  "arxivats") i **eliminar** (`eliminat_el`: a la paperera, amagat de tot
  arreu i restaurable des del filtre "paperera"). Cap dels dos esborra res.
  Un projecte a la paperera allibera el seu número d'estudi.
- Clients i perfils → `actiu = false`.
- Idees → `estat = 'descartada'`.

Tot el que estigui cancel·lat, tancat o inactiu queda **fora de la safata i de
les vistes per defecte**, amb un filtre per recuperar-ho. En una eina de
supervisió, l'esborrat físic és gairebé sempre un error: el que vols saber d'aquí
a sis mesos és precisament què es va cancel·lar i quan.

### 7.3 Polítiques

Model simple per a un equip petit: **tothom veu tot i tothom escriu**; la
restricció real és que res no desapareix.

```sql
alter table perfils          enable row level security;
alter table clients          enable row level security;
alter table projectes        enable row level security;
alter table fases            enable row level security;
alter table entregables      enable row level security;
alter table tasques          enable row level security;
alter table contactes        enable row level security;
alter table idees            enable row level security;
alter table historial_dates  enable row level security;

-- Funció auxiliar
create or replace function es_membre() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from perfils where id = auth.uid() and actiu = true
  );
$$;

-- Patró general (repetir per a clients, projectes, fases,
-- entregables, tasques, contactes, idees).
-- NOMÉS select, insert i update. Cap política de delete, enlloc.
create policy llegir on projectes
  for select using (es_membre());

create policy crear on projectes
  for insert with check (es_membre());

create policy modificar on projectes
  for update using (es_membre()) with check (es_membre());

-- Perfils: cadascú modifica només el seu
create policy llegir_perfils on perfils
  for select using (es_membre());

create policy editar_propi_perfil on perfils
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Historial: append-only, ningú el modifica ni l'esborra
create policy llegir_historial on historial_dates
  for select using (es_membre());
-- Sense polítiques d'insert/update/delete: només hi escriu el trigger
-- (security definer). Cap client pot tocar-lo.
```

**Comprova-ho abans de desplegar:**

1. Amb un usuari sense fila a `perfils` (o amb `actiu = false`), cap consulta ha
   de retornar res.
2. Un `delete` sobre qualsevol taula ha de fallar per a tots els usuaris.
3. Un `update` directe de `data_prevista` sense passar per la RPC ha de fallar
   pel trigger de la secció 8.

---

## 8. Trigger d'historial

```sql
create or replace function registra_canvi_data() returns trigger
language plpgsql security definer as $$
begin
  if new.data_prevista is distinct from old.data_prevista then
    if coalesce(nullif(trim(current_setting('app.motiu_canvi', true)), ''), '') = '' then
      raise exception 'Cal indicar un motiu per canviar la data prevista';
    end if;
    insert into historial_dates (taula, registre_id, data_antiga, data_nova, motiu, usuari_id)
    values (tg_table_name, old.id, old.data_prevista, new.data_prevista,
            current_setting('app.motiu_canvi', true), auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_data_fases       before update on fases
  for each row execute function registra_canvi_data();
create trigger trg_data_entregables before update on entregables
  for each row execute function registra_canvi_data();
create trigger trg_data_tasques     before update on tasques
  for each row execute function registra_canvi_data();
```

L'aplicació ha de cridar la replanificació mitjançant una funció RPC que faci
`set_config('app.motiu_canvi', $motiu, true)` dins de la mateixa transacció.
No permetis mai actualitzar `data_prevista` amb un update directe des del client.

---

## 9. Ordre de treball recomanat

1. Esquema + RLS + triggers a Supabase (migracions versionades al repositori).
2. Autenticació i taula `perfils`.
3. CRUD de clients i projectes, amb generació automàtica de fases per a estudis.
4. Tasques, entregables i contactes.
5. Vistes de safata i pantalla "La meva setmana" amb les quatre accions.
6. Idees i fitxa de client.

Després d'això: **aturar-se i fer-ho servir tres setmanes amb dues persones**
abans d'afegir res. Les funcions que semblin imprescindibles ara probablement no
ho seran, i les que faltin de debò es veuran de seguida.

---

## 10. Riscos coneguts

- **El risc principal no és tècnic, és l'hàbit.** Si ningú entra les `data_real`,
  al cap d'un mes hi haurà quaranta línies vençudes i deixaràs de mirar la safata.
  Si passa, la resposta correcta és reduir l'abast (només projectes on tu ets
  responsable), no afegir funcions.
- **Adopció asimètrica.** Roc i Rocío tenen un incentiu clar: l'app els dona una
  visió de supervisió que ara no tenen. Aina, si és qui executa, el que hi veu és
  feina administrativa afegida — entrar `data_real`, justificar cada data que
  llisca. Si per a ella l'app només és un lloc on explicar retards, deixarà
  d'actualitzar-la i en sis setmanes les dades seran mentida.

  Contrapartida que ha de tenir des del primer dia: "La meva setmana" li ha de
  substituir la llista que ara porta pel seu compte, i ningú li ha de tornar a
  preguntar per Teams com va una cosa, perquè ja es veu. Si això no es compleix,
  l'app no s'aguanta.
- **RGPD.** El límit de la secció 2 és el que manté aquest projecte fora d'una
  conversa molt més complicada amb l'IT de GESOP. No el creuis.

---

---

## 11. Estil visual

Lliure. Només dues constants: tipografia **Montserrat** i **cantonades rectes**
(`border-radius: 0`). La resta (color, jerarquia, icones, ombres) s'ha de decidir
per fer l'app clara i agradable d'utilitzar.

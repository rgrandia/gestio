-- ============================================================
-- Verificació prèvia al desplegament (CLAUDE.md §7.3)
-- ============================================================
-- Es pot executar a l'editor SQL d'un projecte Supabase de proves o en
-- local (vegeu scripts/prova-sql.sh). Tot passa dins d'una transacció que
-- es desfà al final: no deixa cap rastre.
--
-- Si alguna comprovació falla, l'script s'atura amb un error que diu quina.

begin;

-- Usuaris de prova
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'membre@prova.test'),
  ('00000000-0000-0000-0000-00000000000b', 'inactiu@prova.test');
update perfils set actiu = true where id = '00000000-0000-0000-0000-00000000000a';

-- Comprovació 0: els perfils neixen inactius
do $$ begin
  assert (select actiu from perfils where id = '00000000-0000-0000-0000-00000000000b') = false,
    'un perfil nou hauria de néixer inactiu';
end $$;

-- ------------------------------------------------------------
-- Dades de prova, com a membre actiu
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

insert into clients (id, nom, tipus) values
  ('10000000-0000-0000-0000-000000000001', 'Ajuntament de Prova', 'municipi');

insert into projectes (id, client_id, titol, tipus, responsable_id, data_inici) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Baròmetre', 'estudi', '00000000-0000-0000-0000-00000000000a', current_date - 60),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Acompanyament', 'consultoria', '00000000-0000-0000-0000-00000000000a', current_date - 60),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'Pla nou', 'consultoria', '00000000-0000-0000-0000-00000000000a', null);

-- Fases per defecte
do $$ begin
  assert (select count(*) from fases where projecte_id = '20000000-0000-0000-0000-000000000001') = 6,
    'un estudi ha de néixer amb 6 fases';
  assert (select count(*) from fases where projecte_id = '20000000-0000-0000-0000-000000000002') = 0,
    'una consultoria no ha de tenir fases';
  assert (select string_agg(nom, ',' order by ordre) from fases
          where projecte_id = '20000000-0000-0000-0000-000000000001')
         = 'Qüestionari,Camp,Tabulació,Revisió,Informe,Presentació',
    'les fases per defecte no coincideixen amb §4.4';
end $$;

insert into tasques (id, projecte_id, titol, data_prevista) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Vençuda', current_date - 3),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'En risc', current_date + 2),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Lluny', current_date + 20),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Revisada fa 6 dies', current_date - 1),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Revisada fa 7 dies', current_date - 1);
update tasques set revisat_el = current_date - 6 where id = '30000000-0000-0000-0000-000000000004';
update tasques set revisat_el = current_date - 7 where id = '30000000-0000-0000-0000-000000000005';

-- ------------------------------------------------------------
-- Safata (§5)
-- ------------------------------------------------------------
do $$ begin
  assert (select motiu from v_safata where id = '30000000-0000-0000-0000-000000000001') = 'vencut',
    'tasca vençuda no surt com a vencut';
  assert (select motiu from v_safata where id = '30000000-0000-0000-0000-000000000002') = 'en_risc',
    'tasca a +2d no surt com a en_risc';
  assert not exists (select 1 from v_safata where id = '30000000-0000-0000-0000-000000000003'),
    'tasca a +20d no hauria de sortir';
  assert not exists (select 1 from v_safata where id = '30000000-0000-0000-0000-000000000004'),
    'snooze: revisada fa 6 dies no hauria de sortir';
  assert exists (select 1 from v_safata where id = '30000000-0000-0000-0000-000000000005'),
    'snooze: revisada fa 7 dies hauria de tornar';
end $$;

-- Projectes muts: el de 60 dies sense senyal sí; el nou sense data_inici no.
do $$ begin
  assert exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000002'),
    'consultoria sense senyal en 60 dies hauria de ser muda';
  assert not exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000003'),
    'una consultoria creada avui no pot ser muda';
  assert not exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000001'),
    'un estudi no pot ser mut';
end $$;
insert into contactes (projecte_id, data) values ('20000000-0000-0000-0000-000000000002', current_date - 10);
do $$ begin
  assert not exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000002'),
    'un contacte recent ha de treure el projecte de muts';
end $$;

-- ------------------------------------------------------------
-- Regla §4.1: fet exigeix data_real
-- ------------------------------------------------------------
do $$ begin
  begin
    update tasques set estat = 'fet' where id = '30000000-0000-0000-0000-000000000003';
    raise exception 'FALLA: s''ha pogut marcar fet sense data_real';
  exception when check_violation then null;
  end;
end $$;

-- ------------------------------------------------------------
-- Comprovació 3: update directe de data_prevista ha de fallar
-- ------------------------------------------------------------
do $$ begin
  begin
    update tasques set data_prevista = current_date + 30 where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: update directe de data_prevista no ha fallat';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- ...i per la RPC funciona i deixa rastre
select replanificar('tasques', '30000000-0000-0000-0000-000000000001', current_date + 30, 'el client ajorna la reunió');
select replanificar('projectes', '20000000-0000-0000-0000-000000000001', current_date + 90, 'canvi de calendari electoral');
do $$ begin
  assert (select data_prevista from tasques where id = '30000000-0000-0000-0000-000000000001') = current_date + 30,
    'replanificar no ha canviat la data';
  assert (select count(*) from historial_dates where registre_id = '30000000-0000-0000-0000-000000000001') = 1,
    'replanificar no ha escrit a historial_dates';
  assert (select motiu from historial_dates where registre_id = '30000000-0000-0000-0000-000000000001')
         = 'el client ajorna la reunió', 'motiu incorrecte a l''historial';
  assert (select count(*) from v_historial_projecte where projecte_id = '20000000-0000-0000-0000-000000000001') = 2,
    'la vista d''historial del projecte no recull tasques i projecte';
end $$;

-- motiu buit a la RPC ha de fallar
do $$ begin
  begin
    perform replanificar('tasques', '30000000-0000-0000-0000-000000000001', current_date + 40, '   ');
    raise exception 'FALLA: replanificar amb motiu buit no ha fallat';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- la configuració del motiu no es filtra a updates posteriors de la mateixa transacció
do $$ begin
  begin
    update tasques set data_prevista = current_date + 50 where id = '30000000-0000-0000-0000-000000000002';
    raise exception 'FALLA: el motiu de la RPC s''ha reaprofitat en un update directe';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- primera planificació (NULL → data) no exigeix motiu
do $$
declare f uuid;
begin
  select id into f from fases where projecte_id = '20000000-0000-0000-0000-000000000001' and ordre = 1;
  update fases set data_prevista = current_date + 7 where id = f;
  assert (select motiu from historial_dates where registre_id = f) = 'planificació inicial',
    'la primera planificació hauria de quedar com a planificació inicial';
end $$;

-- Reordenar fases
do $$
declare f uuid;
begin
  select id into f from fases where projecte_id = '20000000-0000-0000-0000-000000000001' and ordre = 2;
  perform mou_fase(f, -1);
  assert (select ordre from fases where id = f) = 1, 'mou_fase no ha pujat la fase';
end $$;

-- historial: cap client hi pot escriure
do $$ begin
  begin
    insert into historial_dates (taula, registre_id, motiu) values ('tasques', gen_random_uuid(), 'x');
    raise exception 'FALLA: un client ha pogut escriure a historial_dates';
  exception when insufficient_privilege then null;
  end;
  begin
    update historial_dates set motiu = 'manipulat';
    raise exception 'FALLA: un client ha pogut modificar historial_dates';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ------------------------------------------------------------
-- Comprovació 2: cap delete, enlloc, ni per a membres actius
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfils', 'clients', 'projectes', 'fases', 'entregables',
                           'tasques', 'contactes', 'idees', 'historial_dates']
  loop
    begin
      execute format('delete from %I', t);
      raise exception 'FALLA: delete permès a %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

-- Perfils: només el nom propi; un usuari no es pot activar ell mateix
update perfils set nom = 'Nom nou' where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  begin
    update perfils set actiu = false where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALLA: un usuari ha pogut canviar actiu';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ------------------------------------------------------------
-- Comprovació 1: usuari inactiu (o sense perfil) no veu res
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
do $$ begin
  assert (select count(*) from clients) = 0,         'inactiu veu clients';
  assert (select count(*) from projectes) = 0,       'inactiu veu projectes';
  assert (select count(*) from fases) = 0,           'inactiu veu fases';
  assert (select count(*) from tasques) = 0,         'inactiu veu tasques';
  assert (select count(*) from contactes) = 0,       'inactiu veu contactes';
  assert (select count(*) from historial_dates) = 0, 'inactiu veu historial';
  assert (select count(*) from perfils) = 0,         'inactiu veu perfils';
  assert (select count(*) from v_safata) = 0,        'inactiu veu la safata (vista sense security_invoker?)';
  assert (select count(*) from v_projectes_muts) = 0,'inactiu veu projectes muts';
  assert (select count(*) from v_historial_projecte) = 0, 'inactiu veu historial de projecte';
end $$;
do $$ begin
  update perfils set actiu = true where id = '00000000-0000-0000-0000-00000000000b';
  raise exception 'FALLA: un usuari inactiu ha pogut intentar activar-se';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  begin
    insert into clients (nom, tipus) values ('Intrús', 'altre');
    raise exception 'FALLA: inactiu ha pogut crear un client';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ff"}';
do $$ begin
  assert (select count(*) from projectes) = 0, 'usuari sense perfil veu projectes';
  assert (select count(*) from v_safata) = 0,  'usuari sense perfil veu la safata';
end $$;

-- anon no veu res
reset request.jwt.claims;
set local role anon;
do $$ begin
  begin
    perform 1 from projectes limit 1;
    raise exception 'FALLA: anon pot llegir projectes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from v_safata limit 1;
    raise exception 'FALLA: anon pot llegir la safata';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'verificacio: totes les comprovacions superades' as resultat;
rollback;

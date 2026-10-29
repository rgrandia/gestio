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
  ('00000000-0000-0000-0000-00000000000b', 'inactiu@prova.test'),
  ('00000000-0000-0000-0000-00000000000c', 'company@prova.test');
update perfils set actiu = true
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');

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
         = 'Qüestionari i mostra,Briefing,Camp,Dades,Informe,Presentació',
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

-- 0015: motiu buit a la RPC: es desa igualment, com a «sense motiu»
select replanificar('tasques', '30000000-0000-0000-0000-000000000001', current_date + 40, '   ');
do $$ begin
  assert (select data_prevista from tasques where id = '30000000-0000-0000-0000-000000000001') = current_date + 40,
    'replanificar sense motiu no ha canviat la data';
  assert exists (select 1 from historial_dates
                  where registre_id = '30000000-0000-0000-0000-000000000001'
                    and data_nova = current_date + 40 and motiu = 'sense motiu'),
    'replanificar sense motiu no ha deixat rastre a l''historial';
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

-- primera planificació per la RPC sense motiu: «planificació inicial», no «sense motiu»
select replanificar('tasques', '30000000-0000-0000-0000-000000000003', null, 'esborrem la data per provar');
select replanificar('tasques', '30000000-0000-0000-0000-000000000003', current_date + 20, '');
do $$ begin
  assert (select motiu from historial_dates where registre_id = '30000000-0000-0000-0000-000000000003'
           and data_antiga is null order by id desc limit 1) = 'planificació inicial',
    'la primera planificació sense motiu per la RPC no queda com a planificació inicial';
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

-- ------------------------------------------------------------
-- 0005: inici de fase, número d'estudi, persones externes
-- ------------------------------------------------------------
do $$
declare f uuid;
begin
  select id into f from fases where projecte_id = '20000000-0000-0000-0000-000000000001'
    and data_prevista is not null limit 1;
  update fases set data_inici = (select data_prevista from fases where id = f) - 3 where id = f;
  begin
    update fases set data_inici = (select data_prevista from fases where id = f) + 1 where id = f;
    raise exception 'FALLA: una fase ha pogut començar després d''acabar';
  exception when check_violation then null;
  end;
end $$;

update projectes set numero_estudi = '1234' where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  begin
    update projectes set numero_estudi = '12a4' where id = '20000000-0000-0000-0000-000000000002';
    raise exception 'FALLA: número d''estudi amb format incorrecte acceptat';
  exception when check_violation then null;
  end;
  begin
    update projectes set numero_estudi = '1234' where id = '20000000-0000-0000-0000-000000000002';
    raise exception 'FALLA: número d''estudi repetit acceptat';
  exception when unique_violation then null;
  end;
end $$;

-- un membre crea un extern i li assigna una fase i una tasca
do $$
declare ext uuid; f uuid;
begin
  ext := crea_persona_externa('Marta (dades)', 'dades');
  perform crea_persona_externa('Extern actiu', 'camp');
  assert (select extern and actiu from perfils where id = ext), 'l''extern no s''ha creat bé';
  select id into f from fases where projecte_id = '20000000-0000-0000-0000-000000000001' and ordre = 2;
  update fases set responsable_id = ext where id = f;
  update tasques set assignada_a = ext where id = '30000000-0000-0000-0000-000000000005';
  -- a la safata, el que és d'un extern és del responsable del projecte
  assert (select responsable_id from v_safata where id = '30000000-0000-0000-0000-000000000005')
         = '00000000-0000-0000-0000-00000000000a',
    'una tasca d''un extern hauria de sortir al responsable del projecte';
  perform actualitza_persona_externa(ext, 'Marta', 'dades', false);
  assert not (select actiu from perfils where id = ext), 'no s''ha pogut desactivar l''extern';
  begin
    perform actualitza_persona_externa('00000000-0000-0000-0000-00000000000a', 'X', null, false);
    raise exception 'FALLA: s''ha pogut modificar un membre com si fos extern';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  -- inserir perfils directament continua prohibit
  begin
    insert into perfils (id, nom, email) values ('00000000-0000-0000-0000-00000000000b', 'x', 'x');
    raise exception 'FALLA: un membre ha pogut inserir un perfil directament';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ------------------------------------------------------------
-- 0006: projectes "altre" i co-responsables
-- ------------------------------------------------------------
insert into projectes (id, client_id, titol, tipus, responsable_id) values
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   'Formació interna', 'altre', '00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from fases where projecte_id = '20000000-0000-0000-0000-000000000004') = 0,
    'un projecte "altre" no ha de tenir fases';
end $$;

-- el company passa a co-responsable de l'estudi: veu el que és del projecte
insert into projecte_responsables (projecte_id, perfil_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select responsables_projecte('20000000-0000-0000-0000-000000000001'))
         = array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c']::uuid[],
    'responsables_projecte no retorna principal + co-responsable';
  -- tasca assignada a un extern: la veuen tots dos
  assert (select '00000000-0000-0000-0000-00000000000c'::uuid = any(responsables)
            from v_safata where id = '30000000-0000-0000-0000-000000000005'),
    'el co-responsable no veu una tasca d''un extern del projecte';
  -- tasca sense assignar: també
  assert (select '00000000-0000-0000-0000-00000000000c'::uuid = any(responsables)
            from v_safata where id = '30000000-0000-0000-0000-000000000002'),
    'el co-responsable no veu una tasca sense assignar del projecte';
end $$;

-- desactivar el co-responsable el treu
update projecte_responsables set actiu = false
  where projecte_id = '20000000-0000-0000-0000-000000000001'
    and perfil_id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select responsables_projecte('20000000-0000-0000-0000-000000000001'))
         = array['00000000-0000-0000-0000-00000000000a']::uuid[],
    'un co-responsable desactivat continua comptant';
end $$;

-- un extern no pot ser responsable de projecte, ni principal ni co-
do $$
declare ext uuid := (select id from perfils where extern and actiu limit 1);
begin
  begin
    insert into projecte_responsables (projecte_id, perfil_id)
      values ('20000000-0000-0000-0000-000000000001', ext);
    raise exception 'FALLA: un extern ha pogut ser co-responsable';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    update projectes set responsable_id = ext where id = '20000000-0000-0000-0000-000000000004';
    raise exception 'FALLA: un extern ha pogut ser responsable principal';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- ------------------------------------------------------------
-- 0007: arxivar i paperera
-- ------------------------------------------------------------
do $$ begin
  assert exists (select 1 from v_safata where projecte_id = '20000000-0000-0000-0000-000000000001'),
    'precondició: l''estudi hauria de tenir elements a la safata';
end $$;
update projectes set arxivat_el = now() where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert not exists (select 1 from v_safata where projecte_id = '20000000-0000-0000-0000-000000000001'),
    'un projecte arxivat no hauria de sortir a la safata';
end $$;
update projectes set arxivat_el = null where id = '20000000-0000-0000-0000-000000000001';

-- consultoria muda: a la paperera deixa de ser muda i allibera el número
update projectes set numero_estudi = '9999' where id = '20000000-0000-0000-0000-000000000003';
update contactes set data = current_date - 100 where projecte_id = '20000000-0000-0000-0000-000000000002';
do $$ begin
  assert exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000002'),
    'precondició: la consultoria hauria de ser muda';
end $$;
update projectes set eliminat_el = now() where id in ('20000000-0000-0000-0000-000000000002',
                                                     '20000000-0000-0000-0000-000000000003');
do $$ begin
  assert not exists (select 1 from v_projectes_muts where id = '20000000-0000-0000-0000-000000000002'),
    'un projecte a la paperera no hauria de sortir com a mut';
end $$;
update projectes set numero_estudi = '9999' where id = '20000000-0000-0000-0000-000000000004';
-- restaurar-lo amb el número ocupat ha de fallar
do $$ begin
  begin
    update projectes set eliminat_el = null where id = '20000000-0000-0000-0000-000000000003';
    raise exception 'FALLA: s''ha restaurat un projecte amb el número d''estudi repetit';
  exception when unique_violation then null;
  end;
end $$;
update projectes set eliminat_el = null where id = '20000000-0000-0000-0000-000000000002';
update projectes set numero_estudi = null where id = '20000000-0000-0000-0000-000000000004';

-- ------------------------------------------------------------
-- 0008: colors
-- ------------------------------------------------------------
do $$
declare ca text; cc text;
begin
  select color into ca from perfils where id = '00000000-0000-0000-0000-00000000000a';
  select color into cc from perfils where id = '00000000-0000-0000-0000-00000000000c';
  assert ca is not null and cc is not null, 'els membres haurien de tenir color';
  assert ca <> cc, 'dos membres actius tenen el mateix color';
  begin
    update perfils set color = cc where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALLA: un membre ha pogut agafar el color d''un altre';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  update perfils set color = '#475569' where id = '00000000-0000-0000-0000-00000000000a';
  assert (select color from perfils where id = '00000000-0000-0000-0000-00000000000a') = '#475569',
    'un membre no ha pogut canviar el seu color';
  update perfils set color = '#475568' where id = '00000000-0000-0000-0000-00000000000c';
  assert (select color from perfils where id = '00000000-0000-0000-0000-00000000000c') = cc,
    'un membre ha pogut canviar el color d''un altre';
end $$;

-- ------------------------------------------------------------
-- 0009: notificacions
-- ------------------------------------------------------------
insert into tasques (id, projecte_id, titol, assignada_a, data_prevista) values
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001',
   'Tasca per al company', '00000000-0000-0000-0000-00000000000c', current_date + 10);
-- una tasca que m'assigno jo mateix no em notifica
insert into tasques (projecte_id, titol, assignada_a)
  values ('20000000-0000-0000-0000-000000000001', 'Tasca meva', '00000000-0000-0000-0000-00000000000a');
select replanificar('tasques', '30000000-0000-0000-0000-000000000009', current_date + 15, 'ho demana el client');
-- assignar a un extern no notifica ningú
update tasques set assignada_a = (select id from perfils where extern limit 1)
  where id = '30000000-0000-0000-0000-000000000002';

do $$ begin
  assert (select count(*) from notificacions) = 0, 'un membre veu notificacions que no són seves';
  begin
    update notificacions set text = 'manipulat';
    raise exception 'FALLA: s''ha pogut modificar el text d''una notificació';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into notificacions (perfil_id, tipus, text) values ('00000000-0000-0000-0000-00000000000c', 'x', 'x');
    raise exception 'FALLA: un client ha pogut crear una notificació';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select count(*) from notificacions
           where perfil_id = '00000000-0000-0000-0000-00000000000c' and tipus = 'assignacio'
             and text like '%Tasca per al company%') = 1,
    'el company no ha rebut l''avís d''assignació';
  assert (select count(*) from notificacions
           where perfil_id = '00000000-0000-0000-0000-00000000000c' and tipus = 'replanificacio'
             and text like '%(+5d)%') = 1,
    'el company no ha rebut l''avís de replanificació amb el desplaçament';
  assert not exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000a'
                      and text like '%Tasca meva%'),
    'algú ha rebut un avís d''una cosa que s''ha fet ell mateix';
  assert not exists (select 1 from notificacions n join perfils p on p.id = n.perfil_id where p.extern),
    'un extern ha rebut una notificació';
end $$;
set local role authenticated;

-- el company veu les seves i les pot marcar com a llegides
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  assert (select count(*) from notificacions) >= 2, 'el company no veu les seves notificacions';
end $$;
update notificacions set llegida_el = now();
do $$ begin
  assert not exists (select 1 from notificacions where llegida_el is null), 'no s''han pogut marcar com a llegides';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

-- ------------------------------------------------------------
-- 0011: revisions
-- ------------------------------------------------------------
-- una tasca no feta no es pot enviar a revisar
do $$ begin
  begin
    insert into revisions (tasca_id, revisor_id)
      values ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: s''ha enviat a revisar una tasca no feta';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

update tasques set estat = 'fet', data_real = current_date where id = '30000000-0000-0000-0000-000000000009';

do $$ begin
  -- a si mateix, no
  begin
    insert into revisions (tasca_id, revisor_id)
      values ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a');
    raise exception 'FALLA: algú s''ha enviat una revisió a si mateix';
  exception when check_violation then null;
  end;
  -- a un extern, no
  begin
    insert into revisions (tasca_id, revisor_id)
      values ('30000000-0000-0000-0000-000000000009', (select id from perfils where extern limit 1));
    raise exception 'FALLA: s''ha enviat a revisar a un extern';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  -- en nom d'un altre, no
  begin
    insert into revisions (tasca_id, revisor_id, demanada_per)
      values ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a',
              '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: s''ha demanat una revisió en nom d''un altre';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into revisions (id, tasca_id, revisor_id) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-00000000000c');

do $$ begin
  -- dues de pendents per a la mateixa tasca, no
  begin
    insert into revisions (tasca_id, revisor_id)
      values ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: dues revisions pendents per a la mateixa tasca';
  exception when unique_violation then null;
  end;
  -- qui la demana no la pot aprovar
  begin
    update revisions set estat = 'aprovada' where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: qui demana la revisió l''ha pogut aprovar';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- el revisor la retorna: cal comentari, i la tasca es reobre
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  begin
    update revisions set estat = 'retornada' where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: s''ha retornat sense comentari';
  exception when check_violation then null;
  end;
end $$;
update revisions set estat = 'retornada', comentari = 'falta la taula de quotes'
  where id = '40000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select data_real is null and estat = 'en_curs' from tasques
           where id = '30000000-0000-0000-0000-000000000009'),
    'retornar la revisió no ha reobert la tasca';
  assert (select resolta_el is not null from revisions where id = '40000000-0000-0000-0000-000000000001'),
    'la revisió resolta no té data de resolució';
  begin
    update revisions set estat = 'aprovada' where id = '40000000-0000-0000-0000-000000000001';
    -- l'RLS (estat = 'pendent') fa que no afecti cap fila
    assert (select estat from revisions where id = '40000000-0000-0000-0000-000000000001') = 'retornada',
      'una revisió resolta s''ha pogut tornar a canviar';
  end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

reset role;
do $$ begin
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000c'
                   and tipus = 'revisio' and text like '%et demana que revisis%'),
    'el revisor no ha rebut l''avís';
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000a'
                   and tipus = 'revisio' and text like '%falta la taula de quotes%'),
    'qui la demanava no ha rebut l''avís de retorn amb el comentari';
end $$;
set local role authenticated;

-- ------------------------------------------------------------
-- 0012: el responsable del projecte veu el que està assignat a un altre
-- ------------------------------------------------------------
insert into tasques (id, projecte_id, titol, assignada_a, data_prevista) values
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001',
   'Vençuda del company', '00000000-0000-0000-0000-00000000000c', current_date - 2);
do $$ begin
  assert (select '00000000-0000-0000-0000-00000000000a'::uuid = any(responsables)
            and '00000000-0000-0000-0000-00000000000c'::uuid = any(responsables)
            from v_safata where id = '30000000-0000-0000-0000-000000000012'),
    'una tasca vençuda assignada a un altre no surt al responsable del projecte';
end $$;

-- ------------------------------------------------------------
-- 0013: passar tasques
-- ------------------------------------------------------------
-- la tasca 0012 és del company (c); el membre (a) la passa a un extern amb nota
select transfereix('tasques', '30000000-0000-0000-0000-000000000012',
                   (select id from perfils where extern and actiu limit 1), 'tu tens les dades');
do $$ begin
  assert (select assignada_a from tasques where id = '30000000-0000-0000-0000-000000000012')
         = (select id from perfils where extern and actiu limit 1),
    'transfereix no ha canviat la persona assignada';
  -- a la mateixa persona, no
  begin
    perform transfereix('tasques', '30000000-0000-0000-0000-000000000012',
                        (select id from perfils where extern and actiu limit 1), null);
    raise exception 'FALLA: s''ha passat una tasca a qui ja la tenia';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  -- a una persona inactiva, no
  begin
    perform transfereix('tasques', '30000000-0000-0000-0000-000000000012',
                        '00000000-0000-0000-0000-00000000000b', null);
    raise exception 'FALLA: s''ha passat una tasca a una persona inactiva';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;
-- ara la torna al company amb una altra nota
select transfereix('tasques', '30000000-0000-0000-0000-000000000012',
                   '00000000-0000-0000-0000-00000000000c', 'torna-hi tu');

reset role;
do $$ begin
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000c'
                   and text like '%ha passat la tasca «Vençuda del company» a %tu tens les dades%'),
    'qui tenia la tasca no ha rebut l''avís que l''han passada (amb la nota)';
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000c'
                   and text like '%t''ha passat la tasca «Vençuda del company» (abans era de %torna-hi tu%'),
    'qui rep la tasca no ha rebut l''avís amb de qui era i la nota';
end $$;
set local role authenticated;

-- ------------------------------------------------------------
-- 0014: versió de l'esquema
-- ------------------------------------------------------------
do $$ begin
  assert versio_esquema() >= '20261029000014_reobrir_onades_versio',
    'versio_esquema() no retorna la darrera migració';
  begin
    perform 1 from migracions_aplicades;
    raise exception 'FALLA: un client llegeix migracions_aplicades';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ------------------------------------------------------------
-- 0014: reobrir, i no amb una revisió pendent
-- ------------------------------------------------------------
update tasques set estat = 'fet', data_real = current_date where id = '30000000-0000-0000-0000-000000000009';
insert into revisions (id, tasca_id, revisor_id) values
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    update tasques set estat = 'en_curs', data_real = null where id = '30000000-0000-0000-0000-000000000009';
    raise exception 'FALLA: s''ha reobert una tasca amb una revisió pendent';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;
update revisions set estat = 'cancellada' where id = '40000000-0000-0000-0000-000000000002';
update tasques set estat = 'en_curs', data_real = null where id = '30000000-0000-0000-0000-000000000009';
do $$ begin
  assert (select data_real is null from tasques where id = '30000000-0000-0000-0000-000000000009'),
    'no s''ha pogut reobrir una tasca sense revisió pendent';
end $$;

-- ------------------------------------------------------------
-- 0014: revisions d'entregables
-- ------------------------------------------------------------
insert into entregables (id, projecte_id, titol, data_prevista) values
  ('50000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000002', 'Informe de diagnosi', current_date);
do $$ begin
  begin
    insert into revisions (entregable_id, revisor_id)
      values ('50000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: s''ha enviat a revisar un entregable no fet';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    insert into revisions (revisor_id) values ('00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: una revisió sense tasca ni entregable';
  exception when check_violation then null;
  end;
end $$;
update entregables set estat = 'fet', data_real = current_date where id = '50000000-0000-0000-0000-000000000014';
do $$ begin
  begin
    insert into revisions (tasca_id, entregable_id, revisor_id)
      values ('30000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000014',
              '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: una revisió de tasca i entregable alhora';
  exception when check_violation then null;
  end;
end $$;
insert into revisions (id, entregable_id, revisor_id) values
  ('40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    insert into revisions (entregable_id, revisor_id)
      values ('50000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: dues revisions pendents per al mateix entregable';
  exception when unique_violation then null;
  end;
  begin
    update entregables set estat = 'en_curs', data_real = null where id = '50000000-0000-0000-0000-000000000014';
    raise exception 'FALLA: s''ha reobert un entregable amb una revisió pendent';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
update revisions set estat = 'retornada', comentari = 'falten les conclusions'
  where id = '40000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  assert (select data_real is null and estat = 'en_curs' from entregables
           where id = '50000000-0000-0000-0000-000000000014'),
    'retornar la revisió no ha reobert l''entregable';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000c'
                   and text like '%et demana que revisis «Informe de diagnosi»%'),
    'el revisor de l''entregable no ha rebut l''avís';
  assert exists (select 1 from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000a'
                   and text like '%t''ha retornat «Informe de diagnosi»: falten les conclusions%'),
    'qui demanava la revisió de l''entregable no ha rebut el retorn';
end $$;
set local role authenticated;

-- ------------------------------------------------------------
-- 0014: passar un estudi antic a les fases per defecte noves
-- ------------------------------------------------------------
insert into projectes (id, client_id, titol, tipus, responsable_id) values
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
   'Estudi antic', 'estudi', '00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    perform aplica_fases_per_defecte('20000000-0000-0000-0000-000000000005');
    raise exception 'FALLA: s''han aplicat les fases noves a un estudi que ja les té';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    perform aplica_fases_per_defecte('20000000-0000-0000-0000-000000000002');
    raise exception 'FALLA: s''han aplicat fases a una consultoria';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;
-- el deixem com un estudi creat abans de 0010
update fases f set nom = v.nom
from (values (1, 'Qüestionari'), (2, 'Camp'), (3, 'Tabulació'), (4, 'Revisió'), (5, 'Informe'), (6, 'Presentació')) v(ordre, nom)
where f.projecte_id = '20000000-0000-0000-0000-000000000005' and f.ordre = v.ordre;
update fases set data_inici = current_date + 1, responsable_id = '00000000-0000-0000-0000-00000000000c'
  where projecte_id = '20000000-0000-0000-0000-000000000005' and nom = 'Tabulació';
insert into tasques (id, projecte_id, fase_id, titol) values
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000005',
   (select id from fases where projecte_id = '20000000-0000-0000-0000-000000000005' and nom = 'Tabulació'),
   'Plantilla de taules');
-- si ha començat, no
update fases set estat = 'fet', data_real = current_date
  where projecte_id = '20000000-0000-0000-0000-000000000005' and nom = 'Qüestionari';
do $$ begin
  begin
    perform aplica_fases_per_defecte('20000000-0000-0000-0000-000000000005');
    raise exception 'FALLA: s''han canviat les fases d''un estudi començat';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;
update fases set estat = 'pendent', data_real = null
  where projecte_id = '20000000-0000-0000-0000-000000000005' and nom = 'Qüestionari';
select aplica_fases_per_defecte('20000000-0000-0000-0000-000000000005');
do $$ begin
  assert (select string_agg(nom, ',' order by ordre) from fases
          where projecte_id = '20000000-0000-0000-0000-000000000005' and estat <> 'cancellat')
         = 'Qüestionari i mostra,Briefing,Camp,Dades,Informe,Presentació',
    'aplica_fases_per_defecte no deixa les fases noves en ordre';
  assert (select string_agg(ordre::text, ',' order by ordre) from fases
          where projecte_id = '20000000-0000-0000-0000-000000000005') = '1,2,3,4,5,6,7',
    'aplica_fases_per_defecte no numera les fases de l''1 al 7';
  assert (select estat from fases where projecte_id = '20000000-0000-0000-0000-000000000005' and nom = 'Revisió')
         = 'cancellat',
    'la fase Revisió no s''ha cancel·lat';
  assert (select f.nom = 'Dades' and f.data_inici = current_date + 1
                 and f.responsable_id = '00000000-0000-0000-0000-00000000000c'
          from tasques t join fases f on f.id = t.fase_id
          where t.id = '30000000-0000-0000-0000-000000000014'),
    'Tabulació no ha passat a Dades conservant tasques, dates i persona';
  begin
    perform aplica_fases_per_defecte('20000000-0000-0000-0000-000000000005');
    raise exception 'FALLA: s''han pogut aplicar dues vegades';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;
end $$;

-- ------------------------------------------------------------
-- 0014: nova onada
-- ------------------------------------------------------------
update tasques set estat = 'cancellat' where id = '30000000-0000-0000-0000-000000000003';
do $$
declare
  nou uuid;
  delta int;
begin
  begin
    perform nova_onada('20000000-0000-0000-0000-000000000002', 'x', current_date, null);
    raise exception 'FALLA: nova onada d''una consultoria';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
  end;

  nou := nova_onada('20000000-0000-0000-0000-000000000001', 'Baròmetre onada 2', current_date + 10, '9876');
  delta := (current_date + 10) - (current_date - 60);

  assert (select numero_estudi = '9876' and data_inici = current_date + 10 and estat = 'actiu'
          from projectes where id = nou),
    'la nova onada no té el número o l''inici que toca';
  assert (select string_agg(nom, ',' order by ordre) from fases where projecte_id = nou)
         = (select string_agg(nom, ',' order by ordre) from fases
             where projecte_id = '20000000-0000-0000-0000-000000000001' and estat <> 'cancellat'),
    'la nova onada no té les mateixes fases (ni ha de generar les per defecte)';
  assert (select count(*) from tasques where projecte_id = nou)
         = (select count(*) from tasques
             where projecte_id = '20000000-0000-0000-0000-000000000001' and estat <> 'cancellat'),
    'la nova onada no copia les tasques no cancel·lades';
  assert not exists (select 1 from tasques where projecte_id = nou and titol = 'Lluny'),
    'la nova onada ha copiat una tasca cancel·lada';
  assert not exists (
    select 1 from tasques n
    where n.projecte_id = nou and n.data_prevista is not null
      and not exists (select 1 from tasques o
                       where o.projecte_id = '20000000-0000-0000-0000-000000000001'
                         and o.titol = n.titol and o.data_prevista + delta = n.data_prevista)),
    'les dates de les tasques no s''han desplaçat igual que l''inici';
  assert not exists (
    select 1 from fases n
    where n.projecte_id = nou and n.data_prevista is not null
      and not exists (select 1 from fases o
                       where o.projecte_id = '20000000-0000-0000-0000-000000000001'
                         and o.nom = n.nom and o.data_prevista + delta = n.data_prevista)),
    'les dates de les fases no s''han desplaçat';
  assert not exists (select 1 from tasques t left join fases f on f.id = t.fase_id
                      where t.projecte_id = nou and t.fase_id is not null and f.projecte_id <> nou),
    'una tasca de la nova onada penja d''una fase de l''onada anterior';
  assert not exists (select 1 from tasques where projecte_id = nou and data_real is not null)
     and not exists (select 1 from fases where projecte_id = nou and data_real is not null),
    'la nova onada hereta dates reals';
  assert (select count(*) from tasques where projecte_id = nou and assignada_a = '00000000-0000-0000-0000-00000000000c') >= 1,
    'la nova onada no conserva a qui està assignada cada tasca';
end $$;
reset role;
do $$ begin
  assert (select count(*) from notificacions where perfil_id = '00000000-0000-0000-0000-00000000000c'
           and text like '%ha creat la nova onada 9876 · Baròmetre onada 2: hi tens%') = 1,
    'el company no ha rebut un sol avís de resum de la nova onada';
  assert not exists (select 1 from notificacions n join projectes p on n.enllac = '/projectes/' || p.id
                      where p.numero_estudi = '9876' and n.text like '%t''ha assignat%'),
    'la nova onada ha enviat un avís per cada tasca';
end $$;
set local role authenticated;

-- ------------------------------------------------------------
-- 0016: gestió interna
-- ------------------------------------------------------------
do $$
declare
  p1 uuid;
  p2 uuid;
begin
  p1 := projecte_intern();
  p2 := projecte_intern();
  assert p1 = p2, 'projecte_intern() n''ha de crear un segon projecte intern';
  assert (select tipus = 'altre' and intern_de = '00000000-0000-0000-0000-00000000000a'
                 and responsable_id = intern_de
            from projectes where id = p1),
    'el projecte intern no és de tipus altre o no és de qui l''ha creat';
  assert (select c.intern from projectes pr join clients c on c.id = pr.client_id where pr.id = p1),
    'el projecte intern no penja del client intern';
  insert into tasques (id, projecte_id, titol, assignada_a, data_prevista) values
    ('30000000-0000-0000-0000-000000000016', p1, 'Renovar el certificat', '00000000-0000-0000-0000-00000000000a', current_date - 1);
  assert (select intern from v_safata where id = '30000000-0000-0000-0000-000000000016'),
    'una tasca interna vençuda no surt marcada com a interna a la safata';
  assert not exists (select 1 from v_safata v join projectes pr on pr.id = v.projecte_id
                      where v.intern and pr.intern_de is null),
    'una tasca d''un projecte de client surt com a interna';
  assert exists (select 1 from v_safata where not intern),
    'cap tasca de client a la safata: la comprovació anterior no prova res';
end $$;
-- ningú no pot fer-se passar per un altre en el projecte intern
do $$ begin
  begin
    insert into projectes (client_id, titol, tipus, responsable_id, intern_de)
    values ((select id from clients where intern), 'x', 'altre',
            '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
    raise exception 'FALLA: projecte intern amb responsable diferent de la persona';
  exception when check_violation then null;
  end;
end $$;

-- ------------------------------------------------------------
-- 0016: plantilles de tasques
-- ------------------------------------------------------------
do $$ begin
  begin
    insert into plantilles_tasques (subtipus, titol) values (' Barometre ', 'x');
    raise exception 'FALLA: plantilla amb subtipus no normalitzat';
  exception when check_violation then null;
  end;
end $$;
insert into plantilles_tasques (id, subtipus, titol, fase, dies, ordre) values
  ('60000000-0000-0000-0000-000000000001', 'barometre', 'Enviar el qüestionari al client', 'qüestionari i mostra', 5, 1),
  ('60000000-0000-0000-0000-000000000002', 'barometre', 'Preparar la presentació', 'Presentació', 40, 2),
  ('60000000-0000-0000-0000-000000000003', 'barometre', 'Tasca desactivada', null, null, 3);
update plantilles_tasques set actiu = false where id = '60000000-0000-0000-0000-000000000003';
insert into projectes (id, client_id, titol, tipus, subtipus, responsable_id, data_inici) values
  ('20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001',
   'Baròmetre amb plantilla', 'estudi', 'Barometre', '00000000-0000-0000-0000-00000000000a', current_date);
do $$
declare
  nou uuid;
begin
  assert (select count(*) from tasques where projecte_id = '20000000-0000-0000-0000-000000000016') = 2,
    'la plantilla no ha creat les dues tasques actives';
  assert (select f.nom = 'Qüestionari i mostra' and t.data_prevista = current_date + 5
            from tasques t join fases f on f.id = t.fase_id
           where t.projecte_id = '20000000-0000-0000-0000-000000000016'
             and t.titol = 'Enviar el qüestionari al client'),
    'la tasca de plantilla no penja de la fase o no té la data de l''inici + dies';
  -- la nova onada copia les tasques i no hi torna a aplicar la plantilla
  nou := nova_onada('20000000-0000-0000-0000-000000000016', 'Baròmetre amb plantilla 2', current_date + 30, null);
  assert (select count(*) from tasques where projecte_id = nou) = 2,
    'la nova onada ha duplicat les tasques de la plantilla';
end $$;

-- ------------------------------------------------------------
-- 0016: preferències al perfil
-- ------------------------------------------------------------
update perfils set tema = 'fosc', menu = 'desplegat' where id = '00000000-0000-0000-0000-00000000000a';
update perfils set tema = 'fosc' where id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select tema = 'fosc' and menu = 'desplegat' from perfils where id = '00000000-0000-0000-0000-00000000000a'),
    'no s''han pogut desar les preferències pròpies';
  assert (select tema is null from perfils where id = '00000000-0000-0000-0000-00000000000c'),
    'algú ha canviat les preferències d''un altre';
  begin
    update perfils set tema = 'lila' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALLA: tema no vàlid acceptat';
  exception when check_violation then null;
  end;
end $$;

-- ------------------------------------------------------------
-- 0018: salut de l'esquema i projectes sense moviment
-- ------------------------------------------------------------
do $$ begin
  assert falten_objectes(array['transfereix(text,uuid,uuid,text)', 'no_existeix()'],
                         array['tasques.titol', 'tasques.no_hi_es', 'v_safata.intern'])
         = array['no_existeix() (funció)', 'tasques.no_hi_es (columna)'],
    'falten_objectes() no detecta bé el que hi és i el que no';
end $$;

insert into projectes (id, client_id, titol, tipus, responsable_id, creat_el, actualitzat_el) values
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001',
   'Projecte oblidat', 'consultoria', '00000000-0000-0000-0000-00000000000a',
   now() - interval '90 days', now() - interval '90 days');
do $$ begin
  assert exists (select 1 from v_projectes_quiets where id = '20000000-0000-0000-0000-000000000018'),
    'un projecte actiu sense moviment en 90 dies no surt com a quiet';
  assert not exists (select 1 from v_projectes_quiets where id = '20000000-0000-0000-0000-000000000001'),
    'un projecte amb moviment recent surt com a quiet';
end $$;
-- un projecte intern sense moviment tampoc hi surt (cal saltar-se el trigger
-- d'actualitzat_el per envellir-lo; tot es desfà en acabar)
reset role;
alter table projectes disable trigger trg_projectes_actualitzat;
-- Només el projecte intern de l'usuari de prova: a producció, les tasques
-- internes reals poden estar fetes (data_real obligatòria) i no s'han de tocar.
update projectes set creat_el = now() - interval '90 days', actualitzat_el = now() - interval '90 days'
  where intern_de = '00000000-0000-0000-0000-00000000000a';
update tasques set creat_el = now() - interval '90 days', data_real = null, estat = 'pendent'
  where projecte_id in (select id from projectes where intern_de = '00000000-0000-0000-0000-00000000000a');
alter table projectes enable trigger trg_projectes_actualitzat;
set local role authenticated;
do $$ begin
  assert exists (select 1 from projectes where intern_de = '00000000-0000-0000-0000-00000000000a'),
    'cap projecte intern per provar: la comprovació següent no provaria res';
  assert not exists (select 1 from v_projectes_quiets v join projectes p on p.id = v.id
                     where p.intern_de = '00000000-0000-0000-0000-00000000000a'),
    'un projecte intern surt com a quiet';
end $$;
insert into contactes (projecte_id, data, tipus) values
  ('20000000-0000-0000-0000-000000000018', current_date, 'trucada');
do $$ begin
  assert not exists (select 1 from v_projectes_quiets where id = '20000000-0000-0000-0000-000000000018'),
    'un contacte d''avui no treu el projecte de quiets';
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
-- Xarxes socials (0019): només per a qui té la funció activada
-- ------------------------------------------------------------
-- A producció hi pot haver gent amb la funció activada; per provar el cas
-- «ningú no la té» se'ls treu dins d'aquesta transacció (es desfà al final).
reset role;
update perfils set funcions = array_remove(funcions, 'xarxes') where 'xarxes' = any(funcions);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  assert not te_funcio('xarxes'), 'ningú no hauria de tenir xarxes per defecte';
  assert (select count(*) from efemerides) = 0, 'sense la funció es veuen les dates clau';
  begin
    insert into xarxes_comptes (plataforma, nom) values ('x', '@intrus');
    raise exception 'FALLA: sense la funció s''ha pogut crear un compte';
  exception when insufficient_privilege then null;
  end;
  begin
    update perfils set funcions = '{xarxes}' where id = auth.uid();
    raise exception 'FALLA: un usuari s''ha pogut activar funcions directament';
  exception when insufficient_privilege then null;
  end;
end $$;

-- la primera persona l'activa per a si mateixa (ningú no la tenia)
select activa_funcio('00000000-0000-0000-0000-00000000000a', 'xarxes', true);
do $$ begin
  assert te_funcio('xarxes'), 'activa_funcio no ha activat la funció';
  assert (select count(*) from efemerides) >= 8, 'falten les dates clau inicials';
end $$;

insert into xarxes_comptes (id, plataforma, nom, cadencia_setmanal) values
  ('70000000-0000-0000-0000-000000000001', 'linkedin', 'GESOP', 3),
  ('70000000-0000-0000-0000-000000000002', 'x', '@gesop', null);
insert into publicacions (id, titol, text, projecte_id, data_prevista) values
  ('71000000-0000-0000-0000-000000000001', 'Resultats baròmetre', 'Text base',
   '20000000-0000-0000-0000-000000000001', current_date + 3),
  ('71000000-0000-0000-0000-000000000002', 'Sense projecte', null, null, null);
insert into publicacio_canals (publicacio_id, compte_id, text_adaptat) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', null),
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'Text curt');

-- el company no la té: no veu res, no pot donar-se-la i no pot revisar
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  assert (select count(*) from publicacions) = 0, 'sense la funció es veuen publicacions';
  assert (select count(*) from xarxes_comptes) = 0, 'sense la funció es veuen comptes';
  assert (select count(*) from publicacio_canals) = 0, 'sense la funció es veuen canals';
  begin
    perform activa_funcio('00000000-0000-0000-0000-00000000000c', 'xarxes', true);
    raise exception 'FALLA: algú sense la funció se l''ha donada';
  exception when raise_exception then null;
  end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  begin
    update publicacions set estat = 'revisio', revisor_id = '00000000-0000-0000-0000-00000000000c'
      where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: s''ha enviat a revisar a algú sense la funció';
  exception when raise_exception then null;
  end;
  begin
    update publicacions set estat = 'revisio', revisor_id = '00000000-0000-0000-0000-00000000000a'
      where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: algú s''ha pogut revisar ell mateix';
  exception when raise_exception then null;
  end;
end $$;

-- validar directament, sense revisió (0022): queda qui i que no s'ha revisat
update publicacions set estat = 'aprovada' where id = '71000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select estat from publicacions where id = '71000000-0000-0000-0000-000000000002') = 'aprovada',
    'no s''ha pogut validar directament';
  assert (select aprovada_per = auth.uid() and sense_revisio from publicacions
          where id = '71000000-0000-0000-0000-000000000002'), 'no consta qui l''ha validada sense revisió';
end $$;
update publicacions set text = 'Text nou' where id = '71000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select estat = 'esborrany' and aprovada_per is null and not sense_revisio from publicacions
          where id = '71000000-0000-0000-0000-000000000002'), 'tocar el text no fa caducar la validació directa';
end $$;
update publicacions set estat = 'cancellada' where id = '71000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    update publicacions set estat = 'aprovada' where id = '71000000-0000-0000-0000-000000000002';
    raise exception 'FALLA: s''ha validat una publicació cancel·lada';
  exception when raise_exception then null;
  end;
  begin
    insert into publicacions (titol, estat) values ('Neix aprovada', 'aprovada');
    raise exception 'FALLA: una publicació nova ha nascut aprovada';
  exception when raise_exception then null;
  end;
end $$;

select activa_funcio('00000000-0000-0000-0000-00000000000c', 'xarxes', true);
update publicacions set estat = 'revisio', revisor_id = '00000000-0000-0000-0000-00000000000c'
  where id = '71000000-0000-0000-0000-000000000001';
do $$ begin
  begin
    update publicacions set estat = 'aprovada' where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: en revisió, qui la porta se l''ha aprovada';
  exception when raise_exception then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  assert (select count(*) from publicacions where id in ('71000000-0000-0000-0000-000000000001',
          '71000000-0000-0000-0000-000000000002')) = 2, 'amb la funció activada no es veuen les publicacions';
  assert exists (select 1 from notificacions where tipus = 'funcio'), 'no ha arribat l''avís d''activació';
  assert exists (select 1 from notificacions where text like '%et demana revisar la publicació%'),
    'no ha arribat l''avís de revisió';
  begin
    update publicacions set estat = 'esborrany' where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: s''ha retornat sense nota';
  exception when raise_exception then null;
  end;
end $$;
update publicacions set estat = 'aprovada' where id = '71000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select aprovada_per from publicacions where id = '71000000-0000-0000-0000-000000000001')
         = '00000000-0000-0000-0000-00000000000c', 'no consta qui l''ha aprovada';
  assert not (select sense_revisio from publicacions where id = '71000000-0000-0000-0000-000000000001'),
    'una aprovació per revisió no és «sense revisió»';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
-- tocar el text adaptat fa caducar l'aprovació
update publicacio_canals set text_adaptat = 'Text curt canviat'
  where publicacio_id = '71000000-0000-0000-0000-000000000001' and compte_id = '70000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select estat from publicacions where id = '71000000-0000-0000-0000-000000000001') = 'esborrany',
    'canviar el text d''una publicació aprovada no l''ha tornat a esborrany';
  assert (select aprovada_per from publicacions where id = '71000000-0000-0000-0000-000000000001') is null,
    'l''aprovació no ha caducat';
  -- data prevista: com a tot arreu, només per replanificar() i amb historial
  begin
    update publicacions set data_prevista = current_date + 9 where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: update directe de la data d''una publicació';
  exception when raise_exception then null;
  end;
end $$;
select replanificar('publicacions', '71000000-0000-0000-0000-000000000001', current_date + 9, null);
do $$ begin
  assert exists (select 1 from historial_dates where taula = 'publicacions'
                 and registre_id = '71000000-0000-0000-0000-000000000001' and motiu = 'sense motiu'),
    'replanificar una publicació no deixa historial';
  -- publicada ⇔ data real, que no pot ser futura
  begin
    update publicacions set estat = 'publicada', data_real = current_date + 1
      where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: publicada amb data futura';
  exception when raise_exception then null;
  end;
  begin
    update publicacions set estat = 'publicada' where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'FALLA: publicada sense data real';
  exception when check_violation then null;
  end;
end $$;
update publicacions set estat = 'publicada', data_real = current_date
  where id = '71000000-0000-0000-0000-000000000001';
update publicacions set estat = 'esborrany' where id = '71000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select data_real from publicacions where id = '71000000-0000-0000-0000-000000000001') is null,
    'reobrir una publicació no li treu la data real';
end $$;

-- es pot desactivar; qui no la té ja no la pot tornar a donar
select activa_funcio('00000000-0000-0000-0000-00000000000c', 'xarxes', false);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  assert (select count(*) from publicacions) = 0, 'desactivada, encara es veuen publicacions';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

-- ------------------------------------------------------------
-- Calendari personal (0020)
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select marca_dies(array[current_date + 1, current_date + 2]::date[], 'teletreball', 'casa', false);
select marca_dies(array[current_date + 1]::date[], 'vacances', null, false);   -- canvia, no duplica
select marca_dies(array['2099-01-06'::date], 'festiu', 'Reis', true);           -- tot l'equip
do $$ begin
  assert (select count(*) from calendari_dies where perfil_id = auth.uid() and actiu
          and data in (current_date + 1, current_date + 2)) = 2, 'marca_dies no ha marcat els dos dies';
  assert (select tipus from calendari_dies where perfil_id = auth.uid() and data = current_date + 1) = 'vacances',
    'tornar a marcar un dia no el canvia';
  assert exists (select 1 from calendari_dies where perfil_id is null and data = '2099-01-06' and actiu),
    'no s''ha marcat el festiu de l''equip';
  begin
    perform marca_dies(array['2099-01-07'::date], 'teletreball', null, true);
    raise exception 'FALLA: s''ha marcat un teletreball per a tot l''equip';
  exception when raise_exception then null;
  end;
  begin
    insert into calendari_dies (perfil_id, data, tipus)
    values ('00000000-0000-0000-0000-00000000000c', current_date, 'vacances');
    raise exception 'FALLA: algú ha marcat el calendari d''un altre';
  exception when insufficient_privilege then null;
  end;
end $$;
select marca_dies(array[current_date + 2]::date[], null, null, false);         -- treure
do $$ begin
  assert (select actiu from calendari_dies where perfil_id = auth.uid() and data = current_date + 2) = false,
    'treure una marca no la desactiva';
end $$;
-- el company ho veu, però no ho pot tocar
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  assert exists (select 1 from calendari_dies where perfil_id = '00000000-0000-0000-0000-00000000000a'),
    'l''equip no veu el calendari dels altres';
end $$;
update calendari_dies set tipus = 'oficina' where perfil_id = '00000000-0000-0000-0000-00000000000a';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  assert not exists (select 1 from calendari_dies where perfil_id = auth.uid() and tipus = 'oficina'),
    'un company ha canviat el calendari d''un altre';
end $$;

-- ------------------------------------------------------------
-- Replanificar en cascada i motiu d'un clic (0021)
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
insert into projectes (id, client_id, titol, tipus, responsable_id) values
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001',
   'Estudi en cascada', 'estudi', '00000000-0000-0000-0000-00000000000a');
-- fases amb dates (planificació inicial: update directe des de null)
update fases set data_inici = current_date + ordre * 10 - 5, data_prevista = current_date + ordre * 10
 where projecte_id = '20000000-0000-0000-0000-000000000021';
update fases set data_real = current_date - 1, estat = 'fet'
 where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 5;  -- feta: no es mou
insert into tasques (id, projecte_id, fase_id, titol, data_prevista)
select '30000000-0000-0000-0000-000000000021', projecte_id, id, 'Tasca del camp', current_date + 28
  from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 3;
insert into tasques (id, projecte_id, fase_id, titol, data_prevista)
select '30000000-0000-0000-0000-000000000022', projecte_id, id, 'Tasca del briefing', current_date + 18
  from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 2;
do $$
declare
  r jsonb;
  f2 uuid := (select id from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 2);
begin
  r := replanifica_en_cascada(f2, current_date + 25, 'el client');
  assert (r->>'fases')::int = 3, 'la cascada havia de moure 3 fases (3, 4 i 6; la 5 és feta): ' || r::text;
  assert (r->>'tasques')::int = 1, 'la cascada havia de moure 1 tasca (la del camp): ' || r::text;
  assert (select data_prevista from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 3) = current_date + 35,
    'la fase 3 no s''ha mogut 5 dies';
  assert (select data_inici from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 3) = current_date + 30,
    'l''inici de la fase 3 no s''ha mogut';
  assert (select data_prevista from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 5) = current_date + 50,
    'una fase feta no s''ha de moure';
  assert (select data_prevista from tasques where id = '30000000-0000-0000-0000-000000000021') = current_date + 33,
    'la tasca de la fase 3 no s''ha mogut';
  assert (select data_prevista from tasques where id = '30000000-0000-0000-0000-000000000022') = current_date + 18,
    'les tasques de la fase moguda no s''han de moure';
  assert exists (select 1 from historial_dates h join fases x on x.id = h.registre_id
                  where x.projecte_id = '20000000-0000-0000-0000-000000000021' and x.ordre = 4
                    and h.motiu = 'en cascada (Briefing): el client'),
    'la cascada no deixa historial amb el motiu';
  -- endarrere també (l'inici es mou abans per no passar del final)
  r := replanifica_en_cascada(f2, current_date + 20, null);
  assert (select data_prevista from fases where projecte_id = '20000000-0000-0000-0000-000000000021' and ordre = 3) = current_date + 30,
    'la cascada enrere no ha funcionat';
end $$;

-- motiu després d'arrossegar: només el propi, recent i «sense motiu»
select replanificar('tasques', '30000000-0000-0000-0000-000000000022', current_date + 19, null);
select posa_motiu('tasques', '30000000-0000-0000-0000-000000000022', 'ho demana el client');
do $$ begin
  assert (select motiu from historial_dates where registre_id = '30000000-0000-0000-0000-000000000022'
          order by id desc limit 1) = 'ho demana el client', 'posa_motiu no ha posat el motiu';
  begin
    perform posa_motiu('tasques', '30000000-0000-0000-0000-000000000022', 'un altre');
    raise exception 'FALLA: s''ha canviat un motiu ja escrit';
  exception when raise_exception then null;
  end;
end $$;
select replanificar('tasques', '30000000-0000-0000-0000-000000000022', current_date + 20, null);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  begin
    perform posa_motiu('tasques', '30000000-0000-0000-0000-000000000022', 'no és meu');
    raise exception 'FALLA: algú ha posat el motiu al canvi d''un altre';
  exception when raise_exception then null;
  end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

-- ------------------------------------------------------------
-- Comprovació 2: cap delete, enlloc, ni per a membres actius
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['perfils', 'clients', 'projectes', 'fases', 'entregables',
                           'tasques', 'contactes', 'idees', 'historial_dates',
                           'projecte_responsables', 'notificacions', 'revisions',
                           'migracions_aplicades', 'plantilles_tasques',
                           'xarxes_comptes', 'publicacions', 'publicacio_canals', 'efemerides',
                           'calendari_dies']
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
  assert (select count(*) from calendari_dies) = 0,  'inactiu veu calendaris';
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

do $$ begin
  begin
    perform crea_persona_externa('Intrús', null);
    raise exception 'FALLA: un usuari inactiu ha pogut crear un extern';
  exception when insufficient_privilege then null;
  end;
end $$;

-- un token amb l'id d'un extern no dona accés
reset role;
do $$
declare ext uuid := (select id from perfils where extern and actiu limit 1);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ext)::text, true);
end $$;
set local role authenticated;
do $$ begin
  assert (select count(*) from projectes) = 0, 'un token amb id d''extern veu projectes';
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

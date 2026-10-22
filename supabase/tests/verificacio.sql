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
                           'tasques', 'contactes', 'idees', 'historial_dates',
                           'projecte_responsables', 'notificacions', 'revisions']
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

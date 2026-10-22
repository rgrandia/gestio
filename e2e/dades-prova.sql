-- Dades de prova per a e2e/funcions.mjs. NOMÉS per a l'entorn de proves:
-- buida les taules de l'app. Usa els usuaris de scripts/e2e/entorn.sh.
truncate clients, projectes, fases, entregables, tasques, contactes, idees, historial_dates cascade;
delete from perfils where extern;
do $$
declare
  roc uuid := (select id from perfils where email='roc@prova.test');
  aina uuid := (select id from perfils where email='aina@prova.test');
  marta uuid; f_tab uuid; f_camp uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid;
begin
  insert into clients (nom,tipus,territori,responsable_id) values ('Ajuntament de Mataró','municipi','Maresme',roc) returning id into c1;
  insert into clients (nom,tipus,territori,responsable_id) values ('Ajuntament de Mollet','municipi','Vallès Oriental',aina) returning id into c2;
  insert into clients (nom,tipus,territori,responsable_id) values ('Ajuntament de Vilanova','municipi','Garraf',roc) returning id into c3;
  insert into clients (nom,tipus,territori,responsable_id) values ('Diputació de Tarragona','institucio','Camp de Tarragona',aina) returning id into c4;
  insert into projectes (client_id,titol,tipus,subtipus,responsable_id,data_inici,data_fi_prevista) values (c1,'Baròmetre municipal onada 2','estudi','barometre',roc,current_date-40,current_date+30) returning id into p1;
  insert into projectes (client_id,titol,tipus,subtipus,responsable_id,data_inici,data_fi_prevista) values (c2,'Enquesta de serveis','estudi','barometre',roc,current_date-20,current_date+50) returning id into p2;
  insert into projectes (client_id,titol,tipus,subtipus,responsable_id,data_inici) values (c3,'Acompanyament comunicació 2027','consultoria','acompanyament',roc,current_date-70) returning id into p3;
  insert into projectes (client_id,titol,tipus,subtipus,responsable_id,data_inici) values (c4,'Pla de comunicació institucional','consultoria','pla_comunicacio',aina,current_date-10) returning id into p4;
  update fases set data_prevista = current_date - 30 + ordre*9 where projecte_id=p1;
  update fases set data_real = data_prevista, estat='fet' where projecte_id=p1 and ordre=1;
  update fases set data_inici = data_prevista - 7 where projecte_id=p1;
  update projectes set numero_estudi = '2614' where id = p1;
  update projectes set numero_estudi = '2631' where id = p2;
  insert into perfils (nom, area, extern, actiu) values ('Marta', 'dades', true, true) returning id into marta;
  select id into f_tab from fases where projecte_id=p1 and nom='Dades';
  select id into f_camp from fases where projecte_id=p1 and nom='Camp';
  update fases set responsable_id = marta where id = f_tab;
  insert into tasques (projecte_id,fase_id,titol,assignada_a,data_prevista) values
    (p1,f_tab,'Preparar plantilla de taules',marta,current_date-5),
    (p1,f_tab,'Revisar ponderació',roc,current_date+2),
    (p1,f_camp,'Seguiment de quotes diari',aina,current_date-8);
  update fases set data_prevista = current_date - 3 + (ordre-1)*12 where projecte_id=p2;
  insert into entregables (projecte_id,titol,tipus,data_prevista) values (p3,'Nota de posicionament pressupostos','nota',current_date+2),(p3,'Argumentari ple d''octubre','discurs',current_date-6),(p4,'Diagnosi inicial','informe',current_date+12);
  insert into contactes (projecte_id,data,tipus,resum,usuari_id) values (p4,current_date-3,'reunio','Reunió de kick-off amb gabinet',aina);
  insert into tasques (projecte_id,titol,assignada_a,data_prevista,prioritat) values
    (p1,'Revisar literals del qüestionari',roc,current_date+1,'alta'),
    (p1,'Enviar fitxer de quotes al proveïdor',roc,current_date+4,'normal'),
    (p2,'Validar mostra amb el client',roc,current_date-1,'normal'),
    (p3,'Preparar briefing per a l''alcaldessa',roc,current_date+6,'normal');
  insert into idees (titol,descripcio,client_id,estat,proposada_per,data_objectiu) values
    ('Enquesta flash pressupostos participatius','Abans de la votació de febrer',c1,'proposada',roc,current_date+90),
    ('Panel qualitatiu amb joves','Per al pla de joventut',c2,'valorada',aina,null),
    ('Baròmetre comarcal compartit',null,c4,'proposada',roc,current_date+150);
end $$;
do $$
declare e uuid; f uuid;
begin
  select id into e from entregables where titol like 'Nota de posicionament%';
  perform set_config('app.motiu_canvi', 'el gabinet demana més temps', true);
  update entregables set data_prevista = data_prevista - 9 where id = e;
  update entregables set data_prevista = data_prevista + 4 where id = e;
  update entregables set data_prevista = data_prevista + 5 where id = e;
  select id into f from fases where nom = 'Dades' and projecte_id = (select id from projectes where numero_estudi='2614');
  update fases set data_prevista = data_prevista + 3 where id = f;
  update fases set data_prevista = data_prevista - 3 where id = f;
  perform set_config('app.motiu_canvi', '', true);
end $$;

-- Un estudi creat abans de la migració 0010 (fases antigues) i no començat.
update fases f set nom = v.nom
from (values (1, 'Qüestionari'), (2, 'Camp'), (3, 'Tabulació'), (4, 'Revisió'), (5, 'Informe'), (6, 'Presentació')) v(o, nom)
where f.ordre = v.o and f.projecte_id = (select id from projectes where titol = 'Enquesta de serveis');

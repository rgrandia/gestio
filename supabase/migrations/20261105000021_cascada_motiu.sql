-- ============================================================
-- 0021 · Replanificar fases en cascada i motiu d'un clic després
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cascada: si una fase llisca, les següents llisquen igual
-- ------------------------------------------------------------
-- Mou la fase a p_data i, si ja tenia data, mou també les fases següents
-- del mateix estudi (ordre més alt, no acabades ni cancel·lades, amb data)
-- i les seves tasques obertes, el mateix nombre de dies. Cada canvi passa
-- per replanificar(): queda a l'historial (§4.2) amb el motiu «en cascada
-- (fase)». L'inici previst de les fases mogudes també es desplaça.
-- Les tasques de la fase moguda no es toquen: poden anar bé igualment.
-- Retorna quantes fases i tasques s'han mogut a més de la fase.
create or replace function replanifica_en_cascada(p_fase uuid, p_data date, p_motiu text)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  f        fases;
  delta    int;
  motiu_c  text;
  r        record;
  t        record;
  n_fases  int := 0;
  n_tasq   int := 0;
begin
  select * into f from fases where id = p_fase;
  if not found then
    raise exception 'No s''ha trobat la fase o no hi tens accés' using errcode = 'P0001';
  end if;

  perform replanificar('fases', p_fase, p_data, p_motiu);
  if f.data_prevista is null or p_data is null or p_data = f.data_prevista then
    return jsonb_build_object('fases', 0, 'tasques', 0);
  end if;

  delta := p_data - f.data_prevista;
  motiu_c := 'en cascada (' || f.nom || ')' || coalesce(': ' || nullif(trim(p_motiu), ''), '');

  for r in
    select id, data_prevista, data_inici from fases
     where projecte_id = f.projecte_id and ordre > f.ordre
       and data_real is null and estat not in ('fet', 'cancellat')
       and data_prevista is not null
     order by ordre
  loop
    -- l'inici no pot quedar després del final: l'ordre depèn del sentit
    if delta < 0 and r.data_inici is not null then
      update fases set data_inici = r.data_inici + delta where id = r.id;
    end if;
    perform replanificar('fases', r.id, r.data_prevista + delta, motiu_c);
    if delta > 0 and r.data_inici is not null then
      update fases set data_inici = r.data_inici + delta where id = r.id;
    end if;
    n_fases := n_fases + 1;

    for t in
      select id, data_prevista from tasques
       where fase_id = r.id and data_real is null and estat not in ('fet', 'cancellat')
         and data_prevista is not null
    loop
      perform replanificar('tasques', t.id, t.data_prevista + delta, motiu_c);
      n_tasq := n_tasq + 1;
    end loop;
  end loop;

  return jsonb_build_object('fases', n_fases, 'tasques', n_tasq);
end;
$$;
revoke all on function replanifica_en_cascada(uuid, date, text) from public, anon;
grant execute on function replanifica_en_cascada(uuid, date, text) to authenticated;

-- ------------------------------------------------------------
-- 2. Posar el motiu just després d'arrossegar
-- ------------------------------------------------------------
-- Arrossegar desa «sense motiu» per no trencar el gest. Durant 5 minuts,
-- qui ha fet el canvi hi pot posar el motiu amb un clic. És l'única escriptura
-- permesa a historial_dates fora del trigger: només omple un «sense motiu»
-- propi i recent; no canvia dates, ni el de ningú altre, ni un motiu escrit.
create or replace function posa_motiu(p_taula text, p_id uuid, p_motiu text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  nou_motiu text := nullif(trim(coalesce(p_motiu, '')), '');
  darrer bigint;
  n int;
begin
  if not es_membre() then
    raise exception 'Només per a membres de l''equip.' using errcode = '42501';
  end if;
  if nou_motiu is null or char_length(nou_motiu) > 200 then
    raise exception 'Escriu un motiu (com a molt 200 caràcters).' using errcode = 'P0001';
  end if;
  select id into darrer from historial_dates
   where taula = p_taula and registre_id = p_id
   order by id desc limit 1;
  update historial_dates set motiu = nou_motiu
   where id = darrer
     and historial_dates.motiu = 'sense motiu'
     and usuari_id = auth.uid()
     and creat_el > now() - interval '5 minutes';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Ja no s''hi pot afegir el motiu (passats 5 minuts, o el canvi no és teu).' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function posa_motiu(text, uuid, text) from public, anon;
grant execute on function posa_motiu(text, uuid, text) to authenticated;

insert into migracions_aplicades (nom) values ('20261105000021_cascada_motiu') on conflict do nothing;

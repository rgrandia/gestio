-- ============================================================
-- 0022 · Xarxes: validar una publicació directament, sense revisió
-- ============================================================
-- Decisió de l'equip (octubre 2026): la revisió per una altra persona és
-- opcional. Des d'idea o esborrany, qualsevol membre amb les xarxes la pot
-- marcar com a aprovada ell mateix. Queda constància de qui i que ha estat
-- sense revisió (`sense_revisio`), i l'aprovació continua caducant si es toca
-- el text. El que no canvia: si està en revisió, només l'aprova qui revisa.

alter table publicacions add column sense_revisio boolean not null default false;

create or replace function valida_publicacio() returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  jo uuid := auth.uid();
begin
  new.actualitzat_el := now();

  -- Qui revisa ha de ser un altre membre amb la funció activada.
  if new.estat = 'revisio' and (tg_op = 'INSERT' or old.estat is distinct from 'revisio') then
    if new.revisor_id is null then
      raise exception 'Tria qui l''ha de revisar.' using errcode = 'P0001';
    end if;
    if new.revisor_id = coalesce(new.responsable_id, jo) then
      raise exception 'No et pots revisar tu mateix: tria una altra persona.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from perfils where id = new.revisor_id and actiu and not extern
                   and 'xarxes' = any(funcions)) then
      raise exception 'Qui revisa ha de tenir les xarxes socials activades.' using errcode = 'P0001';
    end if;
    new.nota_revisio := null;
  end if;

  -- «Aprovada»: des de revisió, només qui revisa; des d'idea o esborrany,
  -- directament (sense revisió), per qui la marca.
  if new.estat = 'aprovada' and (tg_op = 'INSERT' or old.estat is distinct from 'aprovada') then
    if tg_op = 'INSERT' then
      raise exception 'Una publicació nova no pot néixer aprovada.' using errcode = 'P0001';
    elsif old.estat = 'revisio' then
      if jo is distinct from old.revisor_id then
        raise exception 'Està en revisió: només qui la revisa la pot aprovar.' using errcode = 'P0001';
      end if;
      new.sense_revisio := false;
    elsif old.estat in ('idea', 'esborrany') then
      new.sense_revisio := true;
    else
      raise exception 'Només es pot validar una publicació en idea, esborrany o revisió.' using errcode = 'P0001';
    end if;
    new.aprovada_per := jo;
    new.aprovada_el := now();
  end if;

  if tg_op = 'UPDATE' and old.estat = 'revisio' and new.estat = 'esborrany' then
    -- Retornar-la (qui revisa) demana una nota; retirar-la (qui la porta), no.
    if jo is not distinct from old.revisor_id
       and coalesce(trim(new.nota_revisio), '') = '' then
      raise exception 'Escriu què cal canviar per retornar-la.' using errcode = 'P0001';
    end if;
  end if;

  -- Si es toca el text d'una cosa aprovada, l'aprovació caduca.
  if tg_op = 'UPDATE' and old.estat in ('aprovada', 'programada') and new.estat = old.estat
     and new.text is distinct from old.text and old.aprovada_per is not null then
    new.estat := 'esborrany';
  end if;
  -- Fora d'aprovada o programada no hi ha aprovació vigent.
  if new.estat not in ('aprovada', 'programada', 'publicada') then
    new.aprovada_per := null;
    new.aprovada_el := null;
    new.sense_revisio := false;
  end if;

  -- Publicada ⇔ data real (§4.1), que no pot ser futura. Reobrir treu la data.
  if new.estat = 'publicada' and new.data_real > current_date then
    raise exception 'La data real no pot ser posterior a avui.' using errcode = 'P0001';
  end if;
  if new.estat <> 'publicada' then
    new.data_real := null;
  end if;
  return new;
end;
$$;

-- El text adaptat també compta: tocar-lo fa caducar l'aprovació (ara també
-- treu la marca de validada sense revisió, via el trigger de publicacions).
create or replace function canal_toca_aprovacio() returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.text_adaptat is distinct from old.text_adaptat then
    update publicacions
       set estat = 'esborrany'
     where id = new.publicacio_id
       and estat in ('aprovada', 'programada')
       and aprovada_per is not null;
  end if;
  return new;
end;
$$;

insert into migracions_aplicades (nom) values ('20261106000022_validar_sense_revisio') on conflict do nothing;

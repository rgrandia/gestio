import Link from "next/link";
import { CalendarDays, CheckSquare, GripVertical, House, Megaphone } from "lucide-react";
import { diesMarcats } from "@/lib/dades-calendari";
import { SetmanaArrossegable, type CitaSetmana, type DiaSetmana } from "@/components/SetmanaArrossegable";
import { createClient } from "@/lib/supabase/server";
import { teXarxes } from "@/lib/funcions";
import { comptes } from "@/lib/dades-xarxes";
import { diaCurt, sumaDies } from "@/lib/dates";
import { NOM_ESTAT, PLATAFORMES, type EstatPublicacio, type Plataforma } from "@/lib/xarxes";

const capDeSetmana = (iso: string) => [0, 6].includes(new Date(iso + "T12:00:00Z").getUTCDay());

export type CitaInici = { id: string; titol: string; data: string; alta: boolean; projecte_id: string; on: string; intern: boolean };

type Pub = {
  id: string;
  titol: string;
  estat: EstatPublicacio;
  data_prevista: string | null;
  data_real: string | null;
  hora: string | null;
  publicacio_canals: { compte_id: string; actiu: boolean }[];
};

// Els 7 dies que venen, d'una ullada: les meves tasques de projecte, les
// internes, (si tinc les xarxes activades) les meves publicacions i com és
// cada dia al meu calendari (teletreball, vacances, festiu…). Es poden
// arrossegar a un altre dia (SetmanaArrossegable); les altres accions es fan
// a «a revisar», a «gestió interna» i a la fitxa de cada publicació.
export async function CalendariSetmanaInici({ cites, hui, jo }: { cites: CitaInici[]; hui: string; jo: string }) {
  const dies = Array.from({ length: 7 }, (_, i) => sumaDies(hui, i));
  const fi = dies[6];

  let pubs: Pub[] = [];
  let xarxes = new Map<string, { plataforma: Plataforma; nom: string }>();
  if (await teXarxes()) {
    const supabase = await createClient();
    const [{ data }, cs] = await Promise.all([
      supabase
        .from("publicacions")
        .select("id, titol, estat, data_prevista, data_real, hora, publicacio_canals(compte_id, actiu)")
        .neq("estat", "cancellada")
        .or(`responsable_id.eq.${jo},revisor_id.eq.${jo}`)
        .or(`and(data_prevista.gte.${hui},data_prevista.lte.${fi}),and(data_real.gte.${hui},data_real.lte.${fi})`)
        .order("hora", { nullsFirst: false }),
      comptes(),
    ]);
    pubs = (data ?? []) as Pub[];
    xarxes = new Map(cs.map((c) => [c.id, c]));
  }

  const marques = await diesMarcats(hui, fi);
  const items: CitaSetmana[] = [
    ...cites.map((c) => ({
      clau: `t:${c.id}`,
      titol: c.titol,
      data: c.data,
      href: c.intern ? "#intern" : `/projectes/${c.projecte_id}`,
      on: c.intern ? "gestió interna" : c.on.split(" · ")[0],
      alta: c.alta,
      tipus: c.intern ? ("interna" as const) : ("tasca" as const),
      xarxes: [],
      fixa: false,
    })),
    ...pubs.map((p) => {
      const canals = p.publicacio_canals.filter((k) => k.actiu && xarxes.has(k.compte_id)).map((k) => xarxes.get(k.compte_id)!);
      return {
        clau: `p:${p.id}`,
        titol: p.titol,
        data: (p.data_real ?? p.data_prevista)!,
        href: `/xarxes/${p.id}`,
        on: `${p.hora ? p.hora.slice(0, 5) + " · " : ""}${NOM_ESTAT[p.estat]}`,
        alta: false,
        tipus: "pub" as const,
        estat: p.estat,
        xarxes: canals.map((k) => ({ curt: PLATAFORMES[k.plataforma].curt, color: PLATAFORMES[k.plataforma].color, nom: k.nom })),
        fixa: p.estat === "publicada",
      };
    }),
  ];
  const infoDies: DiaSetmana[] = dies.map((d) => {
    const meva = marques.find((m) => m.perfil_id === jo && m.data === d);
    const equip = marques.find((m) => m.perfil_id === null && m.data === d);
    const m = equip ?? meva; // un festiu de tot l'equip mana
    return {
      data: d,
      etiqueta: d === hui ? "avui" : d === dies[1] ? "demà" : diaCurt(d).split(" ")[0],
      capDeSetmana: capDeSetmana(d),
      marca: m ? { tipus: m.tipus, nota: m.nota, equip: m.perfil_id === null } : null,
    };
  });

  return (
    <section className="seccio" id="setmana">
      <header>
        <span className="titol">
          <CalendarDays className="icona-petita" aria-hidden /> els propers 7 dies
        </span>
        <span className="meta">
          <span><CheckSquare className="icona-petita inline" aria-hidden /> tasques</span>
          <span><House className="icona-petita inline" aria-hidden /> internes</span>
          {xarxes.size > 0 && <span><Megaphone className="icona-petita inline" aria-hidden /> xarxes</span>}
          <span><GripVertical className="icona-petita inline" aria-hidden /> arrossega per canviar el dia</span>
          <Link href="/calendari">el meu calendari →</Link>
        </span>
      </header>
      <SetmanaArrossegable key={items.map((i) => `${i.clau}:${i.data}`).join(",")} dies={infoDies} items={items} hui={hui} />
    </section>
  );
}

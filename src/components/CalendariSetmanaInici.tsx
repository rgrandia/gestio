import Link from "next/link";
import { CalendarDays, CheckSquare, House, Megaphone } from "lucide-react";
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
// internes i (si tinc les xarxes activades) les meves publicacions. És per
// veure què ve: les accions es fan a «a revisar», a «gestió interna» i a la
// fitxa de cada publicació (aquí no es repeteixen botons).
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

  // Un cap de setmana sense res ocupa menys: l'espai és per als dies amb feina.
  const teAlgo = (d: string) => cites.some((c) => c.data === d) || pubs.some((p) => (p.data_real ?? p.data_prevista) === d);
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
        </span>
      </header>
      <div
        className="setmana-inici"
        style={{ gridTemplateColumns: dies.map((d) => (capDeSetmana(d) && !teAlgo(d) ? "minmax(0, .5fr)" : "minmax(0, 1fr)")).join(" ") }}
      >
        {dies.map((d) => {
          const tasques = cites.filter((c) => c.data === d);
          const delDia = pubs.filter((p) => (p.data_real ?? p.data_prevista) === d);
          const buit = tasques.length + delDia.length === 0;
          return (
            <div key={d} className={["dia-inici", d === hui ? "avui" : "", buit ? "sense-res" : "", capDeSetmana(d) ? "festiu" : ""].join(" ")}>
              <div className="cap-dia-inici">
                {d === hui ? "avui" : d === dies[1] ? "demà" : diaCurt(d).split(" ")[0]}
                <span>{Number(d.slice(8))}</span>
              </div>
              {tasques.map((c) => (
                <div key={c.id} className={`cita ${c.intern ? "cita-interna" : "cita-tasca"}`}>
                  {c.intern ? (
                    <a href="#intern">{c.titol}</a>
                  ) : (
                    <Link href={`/projectes/${c.projecte_id}`}>{c.titol}</Link>
                  )}
                  {c.alta && <span className="etiqueta tag-vencut">alta</span>}
                  <span className="on" title={c.on}>{c.on.split(" · ")[0]}</span>
                </div>
              ))}
              {delDia.map((p) => {
                const canals = p.publicacio_canals.filter((k) => k.actiu && xarxes.has(k.compte_id)).map((k) => xarxes.get(k.compte_id)!);
                return (
                  <div
                    key={p.id}
                    className="cita cita-xarxa"
                    data-estat={p.estat}
                    style={{ borderLeftColor: canals[0] ? PLATAFORMES[canals[0].plataforma].color : undefined }}
                  >
                    <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                    <span className="on">
                      {canals.map((k, i) => (
                        <span key={i} className="xarxa" style={{ background: PLATAFORMES[k.plataforma].color }} title={k.nom}>
                          {PLATAFORMES[k.plataforma].curt}
                        </span>
                      ))}{" "}
                      {p.hora ? `${p.hora.slice(0, 5)} · ` : ""}
                      {NOM_ESTAT[p.estat]}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

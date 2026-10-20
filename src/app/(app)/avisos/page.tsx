import Link from "next/link";
import { BellOff, CalendarClock, ClipboardCheck, UserCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePersones } from "@/lib/dades";
import { marcaAvisosLlegits } from "@/lib/accions";
import { Persona } from "@/components/Persona";

export const dynamic = "force-dynamic";

type Avis = {
  id: number;
  actor_id: string | null;
  tipus: string;
  text: string;
  enllac: string | null;
  llegida_el: string | null;
  creat_el: string;
};

const ICONA: Record<string, React.ReactNode> = {
  assignacio: <UserPlus className="icona-petita" aria-hidden />,
  responsable: <UserCheck className="icona-petita" aria-hidden />,
  replanificacio: <CalendarClock className="icona-petita" aria-hidden />,
  revisio: <ClipboardCheck className="icona-petita" aria-hidden />,
};

function quan(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ara mateix";
  if (min < 60) return `fa ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `fa ${h} h`;
  const dies = Math.round(h / 24);
  return dies === 1 ? "ahir" : `fa ${dies} dies`;
}

export default async function Avisos() {
  const supabase = await createClient();
  const [avisosR, persones] = await Promise.all([
    supabase.from("notificacions").select("*").order("creat_el", { ascending: false }).limit(100),
    obtePersones(),
  ]);
  const avisos = comprova(avisosR) as Avis[];
  const noLlegits = avisos.filter((a) => !a.llegida_el).length;

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>avisos</h1>
          <div className="sub">
            quan algú t&apos;assigna feina, et fa responsable, et replanifica alguna cosa o et demana una revisió
          </div>
        </div>
        {noLlegits > 0 && (
          <form action={marcaAvisosLlegits}>
            <button className="boto">marcar-los tots com a llegits</button>
          </form>
        )}
      </div>

      <section className="seccio">
        {avisos.length === 0 ? (
          <div className="buit">
            <BellOff className="icona" aria-hidden />
            <span>cap avís de moment</span>
          </div>
        ) : (
          <table className="taula">
            <tbody>
              {avisos.map((a) => (
                <tr key={a.id} className={a.llegida_el ? "avis-llegit" : "avis-nou"}>
                  <td className="nowrap">
                    <Persona p={persones.get(a.actor_id ?? "")} nomesAvatar />
                  </td>
                  <td className="ample element">
                    <Link href={`/avisos/${a.id}`} className="titol-el avis-text">
                      <span className="avis-icona">{ICONA[a.tipus]}</span> {a.text}
                    </Link>
                  </td>
                  <td className="num suau petit">{quan(a.creat_el)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";
import { creaPlantilla } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { BotoPlantilla } from "@/components/BotoPlantilla";

export const dynamic = "force-dynamic";

const FASES = ["Qüestionari i mostra", "Briefing", "Camp", "Dades", "Informe", "Presentació"];

type Linia = { id: string; subtipus: string; titol: string; fase: string | null; dies: number | null; actiu: boolean };

// Tasques que es creen soles en donar d'alta un projecte d'un subtipus.
export default async function Plantilles() {
  const supabase = await createClient();
  const linies = comprova(
    await supabase.from("plantilles_tasques").select("id, subtipus, titol, fase, dies, actiu").order("subtipus").order("ordre").order("creat_el"),
  ) as Linia[];
  const perSubtipus = new Map<string, Linia[]>();
  for (const l of linies) perSubtipus.set(l.subtipus, [...(perSubtipus.get(l.subtipus) ?? []), l]);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <div className="molla"><Link href="/projectes">projectes</Link> /</div>
          <h1>plantilles de tasques</h1>
          <div className="sub">
            en crear un projecte amb aquest subtipus, se&apos;n creen aquestes tasques (sense persona: van al responsable)
          </div>
        </div>
      </div>

      {[...perSubtipus].map(([subtipus, files]) => (
        <section className="seccio" key={subtipus}>
          <header>
            <span className="titol">{subtipus}</span>
            <span className="meta">{files.filter((l) => l.actiu).length} tasques actives</span>
          </header>
          <table className="taula">
            <thead>
              <tr>
                <th>tasca</th>
                <th>fase</th>
                <th className="num">dies des de l&apos;inici</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((l) => (
                <tr key={l.id} className={l.actiu ? "" : "inactiu"}>
                  <td>{l.titol}</td>
                  <td className="suau">{l.fase ?? "—"}</td>
                  <td className="num">{l.dies ?? "—"}</td>
                  <td className="accions"><BotoPlantilla id={l.id} actiu={l.actiu} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="seccio">
        <header>
          <span className="titol">afegir una tasca a una plantilla</span>
        </header>
        <Formulari accio={creaPlantilla} boto="afegir" className="en-linia" buidaEnDesar>
          <input name="subtipus" list="subtipus-plantilla" placeholder="subtipus (barometre…)" aria-label="subtipus" required />
          <datalist id="subtipus-plantilla">
            {[...new Set(["barometre", "electoral", "qualitatiu", "pla_comunicacio", "acompanyament", ...perSubtipus.keys()])].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input name="titol" placeholder="tasca" aria-label="títol de la tasca" required className="flex-1" />
          <select name="fase" aria-label="fase" defaultValue="">
            <option value="">sense fase</option>
            {FASES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input name="dies" type="number" min={-365} max={730} placeholder="dies" aria-label="dies des de l'inici" style={{ width: "6rem" }} />
        </Formulari>
      </section>
    </>
  );
}

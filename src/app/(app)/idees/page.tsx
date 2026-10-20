import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { comprova, nomsPerfils, obteClientsActius } from "@/lib/dades";
import { creaIdea } from "@/lib/accions";
import { dataCurta } from "@/lib/dates";
import { AccionsIdea } from "@/components/AccionsIdea";
import { Formulari } from "@/components/Formulari";
import { Persona } from "@/components/Persona";
import type { EstatIdea, Idea } from "@/lib/tipus";

export const dynamic = "force-dynamic";

const CIRCUIT: EstatIdea[] = ["proposada", "valorada", "assignada"];

type FilaIdea = Idea & {
  clients: { nom: string } | null;
  projectes: { id: string; titol: string } | null;
};

export default async function Idees({ searchParams }: { searchParams: Promise<{ descartades?: string }> }) {
  const { descartades } = await searchParams;
  const ambDescartades = descartades === "1";
  const supabase = await createClient();

  let q = supabase
    .from("idees")
    .select("*, clients(nom), projectes(id, titol)")
    .order("data_objectiu", { nullsFirst: false })
    .order("creat_el", { ascending: false });
  if (!ambDescartades) q = q.neq("estat", "descartada");

  const [ideesR, projectesR, clients, noms] = await Promise.all([
    q,
    supabase
      .from("projectes")
      .select("id, titol")
      .eq("estat", "actiu")
      .is("arxivat_el", null)
      .is("eliminat_el", null)
      .order("titol"),
    obteClientsActius(),
    nomsPerfils(),
  ]);
  const idees = comprova(ideesR) as FilaIdea[];
  const projectes = comprova(projectesR) as { id: string; titol: string }[];

  const estats: EstatIdea[] = ambDescartades ? [...CIRCUIT, "descartada"] : CIRCUIT;

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>idees</h1>
          <div className="sub">
            proposada → valorada → assignada · des d&apos;assignada es converteix en projecte o entregable
          </div>
        </div>
        {ambDescartades ? <Link href="/idees" className="boto">amaga descartades</Link> : <Link href="/idees?descartades=1" className="boto">mostra descartades</Link>}
      </div>

      <section className="seccio">
        <header><span className="titol">proposar una idea</span></header>
      <Formulari accio={creaIdea} boto="proposar" className="en-linia" buidaEnDesar>
        <input name="titol" placeholder="nova idea" aria-label="títol" required className="flex-1" />
        <select name="client_id" aria-label="client" defaultValue="">
          <option value="">sense client</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <input name="data_objectiu" type="date" aria-label="moment polític objectiu" title="moment polític en què té sentit" />
        <input name="descripcio" placeholder="per què ara (opcional)" aria-label="descripció" className="font-sans flex-1" />
      </Formulari>
      </section>

      {estats.map((estat) => {
        const llista = idees.filter((i) => i.estat === estat);
        return (
          <section className="seccio" key={estat}>
            <header>
              <span className="titol">{estat}</span>
              <span className="comptador">{llista.length}</span>
            </header>
            {llista.length === 0 ? (
              <div className="buit">cap idea {estat}</div>
            ) : (
              <div className="desplacable">
                <table className="taula">
                  <tbody>
                    {llista.map((i) => (
                      <tr key={i.id} data-estat={estat === "descartada" ? "cancellat" : undefined}>
                        <td>
                          {i.titol}
                          {i.descripcio && <div className="petit suau font-sans">{i.descripcio}</div>}
                        </td>
                        <td className="suau">{i.clients?.nom ?? ""}</td>
                        <td className="num" title="moment polític objectiu">{i.data_objectiu ? dataCurta(i.data_objectiu) : ""}</td>
                        <td className="nowrap"><Persona nom={noms.get(i.proposada_per ?? "")} nomesAvatar /></td>
                        <td>
                          {i.projectes && <Link href={`/projectes/${i.projectes.id}`}>→ {i.projectes.titol}</Link>}
                        </td>
                        <td className="accions">
                          <AccionsIdea
                            id={i.id}
                            titol={i.titol}
                            estat={i.estat}
                            convertida={Boolean(i.projecte_id)}
                            projectes={projectes}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

import { UserPlus } from "lucide-react";
import { obtePerfils } from "@/lib/dades";
import { actualitzaPersonaExterna, creaPersonaExterna } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { Persona } from "@/components/Persona";

export const dynamic = "force-dynamic";

export default async function Equip() {
  const perfils = await obtePerfils();
  const membres = perfils.filter((p) => !p.extern);
  const externs = perfils.filter((p) => p.extern);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>equip</h1>
          <div className="sub">qui fa servir l&apos;app i a qui més es pot assignar feina</div>
        </div>
      </div>

      <section className="seccio">
        <header>
          <span className="titol">
            membres <span className="comptador">{membres.filter((p) => p.actiu).length}</span>
          </span>
          <span className="meta">tenen accés · es donen d&apos;alta des del panell de Supabase</span>
        </header>
        <table className="taula">
          <tbody>
            {membres.map((p) => (
              <tr key={p.id} data-estat={p.actiu ? undefined : "cancellat"}>
                <td className="ample"><Persona nom={p.nom} /></td>
                <td className="suau nowrap">{p.email}</td>
                <td className="nowrap">
                  <span className={`etiqueta ${p.actiu ? "tag-fet" : ""}`}>{p.actiu ? "actiu" : "inactiu"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="seccio">
        <header>
          <span className="titol">
            persones externes <span className="comptador">{externs.filter((p) => p.actiu).length}</span>
          </span>
          <span className="meta">sense accés · només per saber qui fa cada cosa</span>
        </header>
        {externs.length === 0 ? (
          <div className="buit">
            <UserPlus className="icona" aria-hidden />
            <span>cap persona externa. Afegeix-ne, per exemple, algú de dades per assignar-li la tabulació.</span>
          </div>
        ) : (
          <table className="taula">
            <tbody>
              {externs.map((p) => (
                <tr key={p.id} data-estat={p.actiu ? undefined : "cancellat"}>
                  <td className="ample">
                    <Formulari accio={actualitzaPersonaExterna} boto="desar" className="flex flex-wrap items-center gap-2">
                      <Persona nom={p.nom} extern nomesAvatar />
                      <input type="hidden" name="id" value={p.id} />
                      <input name="nom" defaultValue={p.nom} aria-label="nom" required />
                      <input name="area" defaultValue={p.area ?? ""} placeholder="àrea (dades, camp…)" aria-label="àrea" />
                      <label className="flex items-center gap-1 petit suau">
                        <input type="checkbox" name="actiu" defaultChecked={p.actiu} className="min-h-0" /> activa
                      </label>
                    </Formulari>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Formulari accio={creaPersonaExterna} boto="afegir persona" className="en-linia" buidaEnDesar>
          <input name="nom" placeholder="nom" aria-label="nom" required />
          <input name="area" placeholder="àrea (dades, camp…)" aria-label="àrea" />
        </Formulari>
      </section>
    </>
  );
}

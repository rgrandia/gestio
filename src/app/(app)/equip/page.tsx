import { UserPlus } from "lucide-react";
import Link from "next/link";
import { feinaOberta, obtePerfils } from "@/lib/dades";
import { actualitzaPersonaExterna, canviaElMeuColor, creaPersonaExterna } from "@/lib/accions";
import { requereixMembre } from "@/lib/auth/session";
import { SelectorColor } from "@/components/SelectorColor";
import { Formulari } from "@/components/Formulari";
import { Persona } from "@/components/Persona";

export const dynamic = "force-dynamic";

export default async function Equip() {
  const jo = await requereixMembre();
  const [perfils, oberta] = await Promise.all([obtePerfils(), feinaOberta()]);
  const membres = perfils.filter((p) => !p.extern);
  const externs = perfils.filter((p) => p.extern);
  // colors que ja fan servir altres membres actius
  const ocupats = new Map(
    membres.filter((p) => p.actiu && p.id !== jo.id && p.color).map((p) => [p.color as string, p.nom]),
  );

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
          <span className="meta">tenen accés · cada membre té un color propi, que no es pot repetir</span>
        </header>
        <table className="taula">
          <tbody>
            {membres.map((p) => (
              <tr key={p.id} data-estat={p.actiu ? undefined : "cancellat"}>
                <td className="ample">
                  {p.id === jo.id ? (
                    <Formulari accio={canviaElMeuColor} boto="desar color" className="flex flex-wrap items-center gap-3">
                      <Persona p={p} />
                      <span className="petit suau">el teu color:</span>
                      <SelectorColor actual={p.color} ocupats={ocupats} />
                    </Formulari>
                  ) : (
                    <Persona p={p} />
                  )}
                </td>
                <td className="suau nowrap">{p.email}</td>
                <td className="nowrap"><FeinaOberta n={oberta.get(p.id) ?? 0} actiu={p.actiu} /></td>
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
                      <Persona p={p} nomesAvatar />
                      <input type="hidden" name="id" value={p.id} />
                      <input name="nom" defaultValue={p.nom} aria-label="nom" required />
                      <input name="area" defaultValue={p.area ?? ""} placeholder="àrea (dades, camp…)" aria-label="àrea" />
                      <SelectorColor actual={p.color} ocupats={new Map()} />
                      <label className="flex items-center gap-1 petit suau">
                        <input type="checkbox" name="actiu" defaultChecked={p.actiu} className="min-h-0" /> activa
                      </label>
                      {p.actiu && (oberta.get(p.id) ?? 0) > 0 && (
                        <label className="flex items-center gap-1 petit suau" title="si la desactives amb feina oberta, ningú no la veurà a la seva llista">
                          <input type="checkbox" name="igualment" className="min-h-0" /> desactivar-la igualment
                        </label>
                      )}
                      <FeinaOberta n={oberta.get(p.id) ?? 0} actiu={p.actiu} />
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

// Feina oberta d'una persona; si és inactiva i en té, és feina que no veu ningú.
function FeinaOberta({ n, actiu }: { n: number; actiu: boolean }) {
  if (n === 0) return <span className="petit fluix">res obert</span>;
  if (!actiu)
    return (
      <Link href="/feina?tot=1" className="etiqueta tag-vencut" title="està inactiva: passa aquesta feina a algú altre">
        inactiva amb {n} {n === 1 ? "cosa oberta" : "coses obertes"}
      </Link>
    );
  return (
    <Link href="/feina?tot=1" className="petit suau">
      {n} {n === 1 ? "cosa oberta" : "coses obertes"}
    </Link>
  );
}

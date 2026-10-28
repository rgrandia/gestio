import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";
import { dataCurta } from "@/lib/dates";
import { comptes } from "@/lib/dades-xarxes";
import { LLISTA_PLATAFORMES, PLATAFORMES } from "@/lib/xarxes";
import { actualitzaCompte, creaCompte, creaEfemeride } from "@/lib/accions-xarxes";
import { Formulari } from "@/components/Formulari";
import { PestanyesXarxes } from "@/components/PestanyesXarxes";
import { BotoEfemeride } from "@/components/BotoEfemeride";

export const dynamic = "force-dynamic";

type Efemeride = { id: string; data: string; titol: string; recurrent: boolean; actiu: boolean };

export default async function ComptesXarxes() {
  const supabase = await createClient();
  const [cs, efR] = await Promise.all([
    comptes(),
    supabase.from("efemerides").select("id, data, titol, recurrent, actiu").order("actiu", { ascending: false }).order("data"),
  ]);
  const efemerides = (comprova(efR) as Efemeride[]).sort((a, b) =>
    a.actiu !== b.actiu ? (a.actiu ? -1 : 1) : (a.recurrent ? a.data.slice(5) : a.data).localeCompare(b.recurrent ? b.data.slice(5) : b.data),
  );

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>xarxes socials</h1>
          <div className="sub">comptes corporatius i dates clau del calendari</div>
        </div>
      </div>
      <PestanyesXarxes />

      <section className="seccio">
        <header>
          <span className="titol">
            comptes <span className="comptador">{cs.filter((c) => c.actiu).length}</span>
          </span>
          <span className="meta">
            l&apos;objectiu setmanal és opcional: si no s&apos;hi arriba, surt a «cal atenció». La signatura s&apos;afegeix al
            final en copiar el text.
          </span>
        </header>
        {cs.length > 0 && (
          <table className="taula">
            <tbody>
              {cs.map((c) => (
                <tr key={c.id} data-estat={c.actiu ? undefined : "cancellat"}>
                  <td className="ample">
                    <Formulari accio={actualitzaCompte} boto="desar" className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }} title={PLATAFORMES[c.plataforma].nom}>
                        {PLATAFORMES[c.plataforma].curt}
                      </span>
                      <input name="nom" defaultValue={c.nom} aria-label="nom del compte" required />
                      <input name="url" defaultValue={c.url ?? ""} placeholder="https://…" aria-label="enllaç al perfil" />
                      <input
                        name="cadencia_setmanal"
                        type="number"
                        min={1}
                        max={50}
                        defaultValue={c.cadencia_setmanal ?? ""}
                        placeholder="per setm."
                        aria-label="objectiu de publicacions per setmana"
                        style={{ width: "7rem" }}
                      />
                      <input name="signatura" defaultValue={c.signatura ?? ""} placeholder="signatura o etiquetes fixes" aria-label="signatura" className="flex-1" />
                      <label className="flex items-center gap-1 petit suau">
                        <input type="checkbox" name="actiu" defaultChecked={c.actiu} className="min-h-0" /> actiu
                      </label>
                    </Formulari>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Formulari accio={creaCompte} boto="afegir compte" className="en-linia" buidaEnDesar>
          <select name="plataforma" aria-label="xarxa" required defaultValue="">
            <option value="" disabled>xarxa</option>
            {LLISTA_PLATAFORMES.map((p) => (
              <option key={p} value={p}>{PLATAFORMES[p].nom}</option>
            ))}
          </select>
          <input name="nom" placeholder="nom (@gesop)" aria-label="nom del compte" required />
          <input name="url" placeholder="https://…" aria-label="enllaç al perfil" />
          <input name="cadencia_setmanal" type="number" min={1} max={50} placeholder="per setm." aria-label="objectiu setmanal" style={{ width: "7rem" }} />
          <input name="signatura" placeholder="signatura o etiquetes fixes" aria-label="signatura" className="flex-1" />
        </Formulari>
      </section>

      <section className="seccio">
        <header>
          <span className="titol">dates clau</span>
          <span className="meta">surten al calendari; les que es repeteixen, cada any</span>
        </header>
        <table className="taula">
          <tbody>
            {efemerides.map((e) => (
              <tr key={e.id} className={e.actiu ? "" : "inactiu"} data-estat={e.actiu ? undefined : "cancellat"}>
                <td className="nowrap">{e.recurrent ? `${e.data.slice(8)}/${e.data.slice(5, 7)} · cada any` : dataCurta(e.data)}</td>
                <td className="ample">{e.titol}</td>
                <td className="accions"><BotoEfemeride id={e.id} actiu={e.actiu} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Formulari accio={creaEfemeride} boto="afegir data" className="en-linia" buidaEnDesar>
          <input name="data" type="date" aria-label="data" required />
          <input name="titol" placeholder="p. ex. eleccions municipals, presentació del baròmetre…" aria-label="nom" required className="flex-1" />
          <label className="flex items-center gap-1 petit suau">
            <input type="checkbox" name="recurrent" className="min-h-0" /> cada any
          </label>
        </Formulari>
      </section>
    </>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { avui, sumaDies } from "@/lib/dates";
import { obtePersones } from "@/lib/dades";
import { comptes, publicacionsObertes, publicadesDesDe } from "@/lib/dades-xarxes";
import { NOM_ESTAT, type EstatPublicacio } from "@/lib/xarxes";
import { creaPublicacio } from "@/lib/accions-xarxes";
import { Formulari } from "@/components/Formulari";
import { PestanyesXarxes } from "@/components/PestanyesXarxes";
import { Persona } from "@/components/Persona";
import { XipPublicacio } from "@/components/XipPublicacio";

export const dynamic = "force-dynamic";

const COLUMNES: EstatPublicacio[] = ["idea", "esborrany", "revisio", "aprovada", "programada", "publicada"];

// Tauler per estat: d'una ullada, què és només una idea, què s'està
// redactant, què espera revisió i què ja està llest.
export default async function TaulerXarxes() {
  const hui = avui();
  const [cs, obertes, publicades, persones] = await Promise.all([
    comptes(),
    publicacionsObertes(),
    publicadesDesDe(sumaDies(hui, -14)),
    obtePersones(),
  ]);
  const mapaComptes = new Map(cs.map((c) => [c.id, c]));
  const totes = [...obertes, ...publicades];

  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>xarxes socials</h1>
          <div className="sub">totes les obertes, i les publicades els darrers 14 dies</div>
        </div>
        <Link href="/xarxes/nova" className="boto boto-primari">
          <Plus className="icona-petita" aria-hidden /> nova publicació
        </Link>
      </div>
      <PestanyesXarxes />

      <Formulari accio={creaPublicacio} boto="afegir idea" className="en-linia alta-rapida mb-4" buidaEnDesar>
        <input type="hidden" name="rapida" value="1" />
        <input
          name="titol"
          className="flex-1"
          placeholder="idea ràpida per a xarxes (pot acabar amb una data: «dijous», «12/11»)"
          aria-label="idea ràpida per a xarxes"
          required
        />
      </Formulari>

      <div className="tauler-xarxes">
        {COLUMNES.map((e) => {
          const items = totes.filter((p) => p.estat === e);
          return (
            <section key={e} className="columna-tauler" data-estat={e}>
              <header>
                <span>{NOM_ESTAT[e]}</span>
                <span className="comptador">{items.length}</span>
              </header>
              {items.length === 0 ? (
                <p className="buit-petit">—</p>
              ) : (
                items.map((p) => (
                  <div key={p.id} className="targeta-tauler">
                    <XipPublicacio p={p} comptes={mapaComptes} ambData />
                    <div className="peu-targeta">
                      <Persona p={persones.get(p.responsable_id ?? "")} nomesAvatar />
                      {p.projectes && <span className="suau petit">{p.projectes.titol}</span>}
                      {p.estat === "revisio" && p.revisor_id && (
                        <span className="petit suau">revisa: {persones.get(p.revisor_id)?.nom ?? "—"}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

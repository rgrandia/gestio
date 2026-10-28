import Link from "next/link";
import { esDataValida } from "@/lib/dates";
import { comptes } from "@/lib/dades-xarxes";
import { projectesPerLligar } from "@/lib/projectes-actius";
import { PLATAFORMES } from "@/lib/xarxes";
import { creaPublicacio } from "@/lib/accions-xarxes";
import { Formulari } from "@/components/Formulari";

export const dynamic = "force-dynamic";

export default async function NovaPublicacio({
  searchParams,
}: {
  searchParams: Promise<{ projecte?: string; data?: string }>;
}) {
  const { projecte, data } = await searchParams;
  const [cs, projectes] = await Promise.all([comptes(), projectesPerLligar()]);
  const actius = cs.filter((c) => c.actiu);
  const delProjecte = projectes.find((p) => p.id === projecte);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <div className="molla"><Link href="/xarxes">xarxes socials</Link> /</div>
          <h1>nova publicació</h1>
          <div className="sub">després podràs adaptar el text a cada xarxa i enviar-la a revisar</div>
        </div>
      </div>
      <section className="seccio">
        <div className="cos">
        <Formulari accio={creaPublicacio} boto="crear i redactar">
          <label>
            nom intern
            <input name="titol" required placeholder="p. ex. Resultats del baròmetre de tardor" defaultValue={delProjecte ? `Difusió · ${delProjecte.titol.split(" — ")[0]}` : ""} />
          </label>
          <div className="fila-camps">
            <label>
              data prevista
              <input name="data_prevista" type="date" defaultValue={data && esDataValida(data) ? data : ""} />
            </label>
            <label>
              hora
              <input name="hora" type="time" />
            </label>
            <label>
              projecte (opcional)
              <select name="projecte_id" defaultValue={delProjecte?.id ?? ""}>
                <option value="">cap: és del dia a dia</option>
                {projectes.map((p) => (
                  <option key={p.id} value={p.id}>{p.titol}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="tria-comptes">
            <legend>a quins comptes</legend>
            {actius.length === 0 ? (
              <span className="petit suau">
                Encara no n&apos;hi ha cap. <Link href="/xarxes/comptes">Afegeix-ne</Link> (es pot fer després).
              </span>
            ) : (
              actius.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" name="compte" value={c.id} className="min-h-0" />
                  <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>{PLATAFORMES[c.plataforma].curt}</span>
                  {c.nom}
                </label>
              ))
            )}
          </fieldset>
          <label>
            text (es pot deixar per després)
            <textarea name="text" rows={5} />
          </label>
        </Formulari>
        </div>
      </section>
    </>
  );
}

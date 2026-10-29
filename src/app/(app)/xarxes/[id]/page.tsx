import Link from "next/link";
import { notFound } from "next/navigation";
import { requereixMembre } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { comprova, obtePersones } from "@/lib/dades";
import { avui, dataCurta, diesEntre } from "@/lib/dates";
import { comptes } from "@/lib/dades-xarxes";
import { projectesPerLligar } from "@/lib/projectes-actius";
import { NOM_ESTAT, type Publicacio } from "@/lib/xarxes";
import { EditorPublicacio } from "@/components/EditorPublicacio";
import { AccionsPublicacio } from "@/components/AccionsPublicacio";
import { Persona } from "@/components/Persona";
import { CanalsPublicats } from "@/components/CanalsPublicats";

export const dynamic = "force-dynamic";

type Canal = { compte_id: string; text_adaptat: string | null; enllac_publicat: string | null; publicat_el: string | null; actiu: boolean };

export default async function DetallPublicacio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const jo = await requereixMembre();
  const supabase = await createClient();
  const hui = avui();

  const [pubR, cs, projectes, persones, ambXarxesR, historialR] = await Promise.all([
    supabase
      .from("publicacions")
      .select("id, titol, text, projecte_id, responsable_id, revisor_id, estat, data_prevista, hora, data_real, enllac_recursos, nota_revisio, aprovada_per, sense_revisio, notes, publicacio_canals(compte_id, text_adaptat, enllac_publicat, publicat_el, actiu)")
      .eq("id", id)
      .maybeSingle(),
    comptes(),
    projectesPerLligar(),
    obtePersones(),
    supabase.from("perfils").select("id, nom").eq("actiu", true).eq("extern", false).contains("funcions", ["xarxes"]).order("nom"),
    supabase
      .from("historial_dates")
      .select("id, data_antiga, data_nova, motiu, usuari_id, creat_el")
      .eq("taula", "publicacions")
      .eq("registre_id", id)
      .order("creat_el", { ascending: false }),
  ]);
  const pub = comprova(pubR) as (Publicacio & { publicacio_canals: Canal[] }) | null;
  if (!pub) notFound();
  const historial = comprova(historialR) as { id: number; data_antiga: string | null; data_nova: string | null; motiu: string; usuari_id: string | null; creat_el: string }[];
  const mapaComptes = new Map(cs.map((c) => [c.id, c]));
  const canalsActius = pub.publicacio_canals.filter((c) => c.actiu && mapaComptes.has(c.compte_id));
  const canals = canalsActius.map((c) => ({
    compte_id: c.compte_id,
    nom: mapaComptes.get(c.compte_id)!.nom,
    plataforma: mapaComptes.get(c.compte_id)!.plataforma,
    enllac_publicat: c.enllac_publicat,
    publicat_el: c.publicat_el,
  }));
  const fetes = canals.filter((c) => c.publicat_el).length;
  const projecte = projectes.find((p) => p.id === pub.projecte_id);
  const vencuda = pub.data_prevista && pub.data_prevista < hui && !["publicada", "cancellada"].includes(pub.estat);

  return (
    <>
      <div className="cap-pagina">
        <div>
          <div className="molla"><Link href="/xarxes">xarxes socials</Link> /</div>
          <h1>{pub.titol}</h1>
          <div className="sub flex flex-wrap items-center gap-2">
            <span className="etiqueta" data-estat-pub={pub.estat}>{NOM_ESTAT[pub.estat]}</span>
            <Persona p={persones.get(pub.responsable_id ?? "")} />
            {pub.data_real ? (
              <span>publicada el {dataCurta(pub.data_real)}</span>
            ) : pub.data_prevista ? (
              <span className={vencuda ? "tag-vencut" : ""}>
                {fetes > 0 ? `publicada a ${fetes} de ${canals.length} xarxes · ` : ""}
                prevista el {dataCurta(pub.data_prevista)}{pub.hora ? ` a les ${pub.hora.slice(0, 5)}` : ""}
                {vencuda ? ` · fa ${diesEntre(pub.data_prevista, hui)} dies i no consta publicada${fetes > 0 ? " a totes" : ""}` : ""}
              </span>
            ) : (
              <span className="suau">sense data</span>
            )}
            {projecte && (
              <span>
                · <Link href={`/projectes/${pub.projecte_id}`}>{projecte.titol}</Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {pub.estat === "esborrany" && pub.nota_revisio && (
        <p className="avis-fases-noves petit">
          <strong>Retornada:</strong> {pub.nota_revisio}
        </p>
      )}
      {pub.estat === "revisio" && pub.revisor_id && (
        <p className="avis-fases-noves petit">
          Esperant la revisió de <Persona p={persones.get(pub.revisor_id)} />.
        </p>
      )}
      {pub.aprovada_per && ["aprovada", "programada"].includes(pub.estat) && (
        <p className="petit suau mb-2">
          {pub.sense_revisio
            ? `validada per ${persones.get(pub.aprovada_per)?.nom ?? "—"}, sense revisió`
            : `aprovada per ${persones.get(pub.aprovada_per)?.nom ?? "—"}`}
        </p>
      )}

      <div className="detall-pub">
        <section className="seccio">
          <header>
            <span className="titol">contingut</span>
            <span className="meta">es redacta aquí, es copia i es publica a cada xarxa</span>
          </header>
          <div className="cos">
            <EditorPublicacio
              id={pub.id}
              titol={pub.titol}
              text={pub.text}
              hora={pub.hora}
              projecteId={pub.projecte_id}
              enllacRecursos={pub.enllac_recursos}
              notes={pub.notes}
              canals={pub.publicacio_canals}
              comptes={cs}
              projectes={projectes}
              bloquejat={["publicada", "cancellada"].includes(pub.estat)}
              aprovada={["aprovada", "programada"].includes(pub.estat) && !!pub.aprovada_per}
            />
          </div>
        </section>

        <aside>
          <section className="seccio compacta">
            <header><span className="titol">què toca</span></header>
            <div className="cos">
              <AccionsPublicacio
                id={pub.id}
                estat={pub.estat}
                jo={jo.id}
                responsableId={pub.responsable_id}
                revisorId={pub.revisor_id}
                dataPrevista={pub.data_prevista}
                hui={hui}
                persones={(comprova(ambXarxesR) as { id: string; nom: string }[]) ?? []}
                canals={canals}
              />
            </div>
          </section>

          {canals.length > 0 && (
            <section className="seccio compacta" id="a-cada-xarxa">
              <header>
                <span className="titol">a cada xarxa</span>
                <span className="meta">{fetes} de {canals.length} publicades</span>
              </header>
              <CanalsPublicats id={pub.id} canals={canals} editable={pub.estat !== "cancellada"} />
            </section>
          )}

          <section className="seccio compacta">
            <header><span className="titol">historial de dates</span></header>
            {historial.length === 0 ? (
              <p className="buit-petit">cap canvi de data</p>
            ) : (
              <ul className="llista-compacta">
                {historial.map((h) => (
                  <li key={h.id}>
                    <span>
                      {dataCurta(h.data_antiga)} → {dataCurta(h.data_nova)}
                    </span>
                    <span className="on">
                      {h.motiu} · {persones.get(h.usuari_id ?? "")?.nom ?? "—"} · {dataCurta(h.creat_el.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

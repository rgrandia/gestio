import Link from "next/link";
import { Megaphone } from "lucide-react";
import { teXarxes } from "@/lib/funcions";
import { comptes, publicacionsObertes } from "@/lib/dades-xarxes";
import { dataCurta, diaRelatiu, sumaDies } from "@/lib/dates";
import { NOM_ESTAT, PLATAFORMES } from "@/lib/xarxes";

// A "la meva setmana", només per a qui té les xarxes activades: el que em
// toca (revisar, refer, publicar aviat o ja vençut). Sense botons: les accions
// es fan a la fitxa de la publicació.
export async function SeccioXarxesInici({ jo, hui }: { jo: string; hui: string }) {
  if (!(await teXarxes())) return null;
  const [obertes, cs] = await Promise.all([publicacionsObertes(), comptes()]);
  const mapa = new Map(cs.map((c) => [c.id, c]));
  const meves = obertes.filter(
    (p) =>
      (p.estat === "revisio" && p.revisor_id === jo) ||
      (p.responsable_id === jo &&
        ((p.estat === "esborrany" && p.nota_revisio) || (p.data_prevista && p.data_prevista <= sumaDies(hui, 2)))),
  );
  const motiu = (p: (typeof meves)[number]) => {
    if (p.estat === "revisio" && p.revisor_id === jo) return { text: "et toca revisar-la", estat: "risc" };
    if (p.data_prevista && p.data_prevista < hui) return { text: `prevista el ${dataCurta(p.data_prevista)}, no consta publicada`, estat: "vencut" };
    if (p.estat === "esborrany" && p.nota_revisio) return { text: `retornada: ${p.nota_revisio}`, estat: "risc" };
    return { text: `${diaRelatiu(p.data_prevista!, hui)}${p.hora ? " " + p.hora.slice(0, 5) : ""} · ${NOM_ESTAT[p.estat]}`, estat: undefined };
  };
  return (
    <section className="seccio compacta" id="xarxes">
      <header>
        <span className="titol">
          xarxes socials
          {meves.length > 0 && <span className="comptador c-risc">{meves.length}</span>}
        </span>
        <span className="meta"><Link href="/xarxes">calendari →</Link></span>
      </header>
      {meves.length === 0 ? (
        <p className="buit-petit">
          <Megaphone className="icona-petita inline mr-1" aria-hidden />
          res per revisar ni per publicar aquests dies
        </p>
      ) : (
        <ul className="llista-compacta atencio-xarxes">
          {meves.map((p) => {
            const m = motiu(p);
            return (
              <li key={p.id} data-estat={m.estat}>
                <span className="flex items-center gap-1">
                  {p.publicacio_canals
                    .filter((c) => c.actiu && mapa.has(c.compte_id))
                    .map((c) => {
                      const k = mapa.get(c.compte_id)!;
                      return (
                        <span key={c.compte_id} className="xarxa" style={{ background: PLATAFORMES[k.plataforma].color }} title={k.nom}>
                          {PLATAFORMES[k.plataforma].curt}
                        </span>
                      );
                    })}
                  <Link href={`/xarxes/${p.id}`}>{p.titol}</Link>
                </span>
                <span className="on">{m.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

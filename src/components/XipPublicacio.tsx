import Link from "next/link";
import { NOM_ESTAT, PLATAFORMES, type Compte } from "@/lib/xarxes";
import type { PublicacioLlista } from "@/lib/dades-xarxes";

// Una publicació en petit (calendari, tauler, inici): a quines xarxes va,
// l'hora i l'estat. El color és el de la primera xarxa.
export function XipPublicacio({
  p,
  comptes,
  ambData = false,
}: {
  p: PublicacioLlista;
  comptes: Map<string, Compte>;
  ambData?: boolean;
}) {
  const xarxes = p.publicacio_canals
    .filter((c) => c.actiu)
    .map((c) => comptes.get(c.compte_id))
    .filter((c): c is Compte => !!c);
  const color = xarxes[0] ? PLATAFORMES[xarxes[0].plataforma].color : "var(--linia-forta)";
  const data = p.data_real ?? p.data_prevista;
  return (
    <Link
      href={`/xarxes/${p.id}`}
      className="xip-pub"
      data-estat={p.estat}
      style={{ borderLeftColor: color }}
      title={`${p.titol} · ${NOM_ESTAT[p.estat]}${xarxes.length ? " · " + xarxes.map((c) => `${PLATAFORMES[c.plataforma].nom} ${c.nom}`).join(", ") : ""}`}
    >
      <span className="xip-cap">
        {xarxes.length === 0 ? (
          <span className="xarxa buida">sense compte</span>
        ) : (
          xarxes.map((c) => (
            <span key={c.id} className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>
              {PLATAFORMES[c.plataforma].curt}
            </span>
          ))
        )}
        {ambData && data && <span className="suau">{data.slice(8, 10)}/{data.slice(5, 7)}</span>}
        {p.hora && <span className="suau">{p.hora.slice(0, 5)}</span>}
        <span className="xip-estat">{NOM_ESTAT[p.estat]}</span>
      </span>
      <span className="xip-titol">{p.titol}</span>
    </Link>
  );
}

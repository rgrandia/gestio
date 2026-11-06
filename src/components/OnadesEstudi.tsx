import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { comprova } from "@/lib/dades";
import { dataCurta } from "@/lib/dates";
import { TiraFases } from "@/components/TiraFases";
import { EtiquetaEstat } from "@/components/EtiquetaEstat";
import { Retard } from "@/components/Retard";
import type { EstatProjecte, Fase } from "@/lib/tipus";

export type Onada = {
  id: string;
  titol: string;
  onada: number;
  estat: EstatProjecte;
  numero_estudi: string | null;
  data_inici: string | null;
  data_fi_prevista: string | null;
  data_fi_real: string | null;
  arxivat_el: string | null;
  fases: Pick<Fase, "id" | "nom" | "ordre" | "data_inici" | "data_prevista" | "data_real" | "estat">[];
};

export async function onadesDe(estudi: string): Promise<Onada[]> {
  const supabase = await createClient();
  return comprova(
    await supabase
      .from("projectes")
      .select("id, titol, onada, estat, numero_estudi, data_inici, data_fi_prevista, data_fi_real, arxivat_el, fases(id, nom, ordre, data_inici, data_prevista, data_real, estat)")
      .eq("estudi_id", estudi)
      .is("eliminat_el", null)
      .order("onada"),
  ) as Onada[];
}

// Les onades d'un estudi (0024), una per línia i desplegables: l'estat, les
// dates i la tira de fases de cadascuna. La que s'està mirant, marcada, es
// gestiona a sota; les altres, amb «gestionar».
export function OnadesEstudi({ onades, actual, hui }: { onades: Onada[]; actual: string; hui: string }) {
  return (
    <section className="seccio onades-estudi" id="onades">
      <header>
        <span className="titol">
          <Layers className="icona-petita" aria-hidden /> onades de l&apos;estudi
        </span>
        <span className="meta">{onades.length} onades · cada onada té les seves fases, tasques i dates</span>
      </header>
      {onades.map((o) => {
        const aqui = o.id === actual;
        return (
          <details key={o.id} className={`onada ${aqui ? "aqui" : ""}`} data-onada={o.onada}>
            <summary>
              <ChevronRight className="icona-petita fletxa" aria-hidden />
              <strong className="num-onada">onada {o.onada}</strong>
              {o.numero_estudi && <span className="suau petit">núm. {o.numero_estudi}</span>}
              <span className="dates-onada petit">
                {dataCurta(o.data_inici)} → {dataCurta(o.data_fi_real ?? o.data_fi_prevista)}
                {o.estat === "actiu" && !o.data_fi_real && o.data_fi_prevista && (
                  <> <Retard prevista={o.data_fi_prevista} real={null} hui={hui} /></>
                )}
              </span>
              <EtiquetaEstat estat={o.estat} />
              {o.arxivat_el && <span className="etiqueta tag-mut">arxivada</span>}
              <span className="tira-onada"><TiraFases fases={o.fases} hui={hui} compacte /></span>
              {aqui ? (
                <span className="etiqueta tag-accent ml-auto">l&apos;estàs gestionant a sota</span>
              ) : (
                <Link href={`/projectes/${o.id}#onades`} className="ml-auto boto boto-suau">gestionar →</Link>
              )}
            </summary>
            {aqui ? (
              <p className="cos-onada petit suau">Les fases, tasques i entregables d&apos;aquesta onada són a sota.</p>
            ) : (
              <div className="cos-onada">
                <p className="petit suau">{o.titol}</p>
                <TiraFases fases={o.fases} hui={hui} />
              </div>
            )}
          </details>
        );
      })}
    </section>
  );
}

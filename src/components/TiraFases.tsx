import { dataCurta, desplacament, diesEntre } from "@/lib/dates";
import type { Fase } from "@/lib/tipus";

type FaseTira = Pick<Fase, "id" | "nom" | "ordre" | "data_inici" | "data_prevista" | "data_real" | "estat">;
type EstatFase = "fet" | "vencut" | "risc" | "pendent";

function estatDe(f: FaseTira, hui: string): EstatFase {
  if (f.data_real) return "fet";
  if (!f.data_prevista) return "pendent";
  const d = diesEntre(hui, f.data_prevista);
  if (d < 0) return "vencut";
  if (d <= 5) return "risc";
  return "pendent";
}

const vives = (fases: FaseTira[]) =>
  fases.filter((f) => f.estat !== "cancellat").sort((a, b) => a.ordre - b.ordre);

// Fase actual: la primera (per ordre) que encara no consta acabada.
// No és automàtic: és el que diuen les dates reals que s'hi han entrat (§4.5).
export function faseActual(fases: FaseTira[]): FaseTira | undefined {
  return vives(fases).find((f) => !f.data_real);
}

const TEXT: Record<EstatFase, string> = { fet: "feta", vencut: "vençuda", risc: "en risc", pendent: "pendent" };

// Tira de fases: un bloc per fase, del color del seu estat. No és un Gantt
// ni un percentatge (§2): no hi ha eix de temps, només l'estat de cada fase.
export function TiraFases({ fases, hui, compacte = false }: { fases: FaseTira[]; hui: string; compacte?: boolean }) {
  const llista = vives(fases);
  if (llista.length === 0) return null;
  const actual = faseActual(llista);

  if (compacte) {
    return (
      <span className="tira-compacta" aria-label={`fase actual: ${actual?.nom ?? "totes fetes"}`}>
        <span className="blocs">
          {llista.map((f) => (
            <span
              key={f.id}
              className={`bloc e-${estatDe(f, hui)} ${f.id === actual?.id ? "actual" : ""}`}
              title={`${f.nom}: ${TEXT[estatDe(f, hui)]}`}
            />
          ))}
        </span>
        <span className="nom-fase">{actual ? actual.nom : "totes fetes"}</span>
      </span>
    );
  }

  return (
    <ol className="tira-fases" aria-label="fases de l'estudi">
      {llista.map((f) => {
        const e = estatDe(f, hui);
        return (
          <li key={f.id} className={`e-${e} ${f.id === actual?.id ? "actual" : ""}`}>
            <span className="barra" />
            <span className="nom">{f.nom}</span>
            <span className="quan">
              {f.data_real ? (
                <>feta {dataCurta(f.data_real)}</>
              ) : f.data_prevista ? (
                <>
                  fi {dataCurta(f.data_prevista)}{" "}
                  {e !== "pendent" && <b>{desplacament(diesEntre(hui, f.data_prevista))}</b>}
                </>
              ) : (
                <span className="fluix">sense data</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

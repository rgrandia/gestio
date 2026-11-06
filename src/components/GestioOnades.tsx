"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Unlink } from "lucide-react";
import { agrupaOnades, treuDeLEstudi } from "@/lib/accions";
import { dataCurta } from "@/lib/dates";

type Candidat = { id: string; titol: string; numero_estudi: string | null; data_inici: string | null };

// Ajuntar estudis que ja existien com a onades d'aquest (0024) i treure'n
// aquesta onada. No s'esborra res: només es fa o es desfà l'enllaç.
export function GestioOnades({
  id,
  candidats,
  esOnada,
}: {
  id: string;
  candidats: Candidat[];
  esOnada: boolean;
}) {
  const router = useRouter();
  const [triats, setTriats] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();
  const fes = (f: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await f();
      if (r.error) return setError(r.error);
      setTriats(new Set());
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <section className="seccio compacta">
        <header>
          <span className="titol"><Layers className="icona-petita" aria-hidden /> ajuntar estudis que ja existeixen</span>
          <span className="meta">del mateix client, que encara no són onades d&apos;un altre estudi</span>
        </header>
        <div className="cos">
          {candidats.length === 0 ? (
            <p className="petit suau">No hi ha cap altre estudi solt d&apos;aquest client.</p>
          ) : (
            <>
              <ul className="llista-agrupar">
                {candidats.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={triats.has(c.id)}
                        onChange={(e) =>
                          setTriats((t) => {
                            const n = new Set(t);
                            if (e.target.checked) n.add(c.id);
                            else n.delete(c.id);
                            return n;
                          })
                        }
                      />
                      {c.numero_estudi && <span className="suau">{c.numero_estudi}</span>}
                      {c.titol}
                      <span className="suau petit">{c.data_inici ? `inici ${dataCurta(c.data_inici)}` : "sense inici"}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="petit suau">
                Es numeren per data d&apos;inici. Cada un conserva les seves fases, tasques, dates i historial.
              </p>
              <button className="boto boto-primari" disabled={pendent || triats.size === 0} onClick={() => fes(() => agrupaOnades(id, [...triats]))}>
                ajuntar com a onades d&apos;aquest estudi
              </button>
            </>
          )}
        </div>
      </section>
      {esOnada && (
        <section className="seccio compacta">
          <header><span className="titol"><Unlink className="icona-petita" aria-hidden /> treure aquesta onada de l&apos;estudi</span></header>
          <div className="cos">
            <p className="petit suau">Torna a ser un estudi solt, amb tot el que té. Si era la primera, l&apos;estudi continua amb les altres.</p>
            <button className="boto boto-suau" disabled={pendent} onClick={() => fes(() => treuDeLEstudi(id))}>
              treure de l&apos;estudi
            </button>
          </div>
        </section>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

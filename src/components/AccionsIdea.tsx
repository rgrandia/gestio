"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { canviaEstatIdea, creaEntregable } from "@/lib/accions";
import type { EstatIdea } from "@/lib/tipus";

const SEGUENT: Partial<Record<EstatIdea, EstatIdea>> = {
  proposada: "valorada",
  valorada: "assignada",
};

type Props = {
  id: string;
  titol: string;
  estat: EstatIdea;
  convertida: boolean;
  projectes: { id: string; titol: string }[];
};

export function AccionsIdea({ id, titol, estat, convertida, projectes }: Props) {
  const router = useRouter();
  const [pendent, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aEntregable, setAEntregable] = useState(false);
  const [projecte, setProjecte] = useState("");

  const canvia = (nou: EstatIdea) =>
    startTransition(async () => {
      setError(null);
      const r = await canviaEstatIdea(id, nou);
      if (r.error) return setError(r.error);
      router.refresh();
    });

  if (estat === "descartada") {
    return (
      <button className="boto" disabled={pendent} onClick={() => canvia("proposada")}>recuperar</button>
    );
  }

  if (aEntregable) {
    return (
      <form
        className="inline-flex gap-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("projecte_id", projecte);
          fd.set("titol", titol);
          fd.set("idea_id", id);
          startTransition(async () => {
            setError(null);
            const r = await creaEntregable({}, fd);
            if (r.error) return setError(r.error);
            setAEntregable(false);
            router.refresh();
          });
        }}
      >
        <select required aria-label="projecte" value={projecte} onChange={(e) => setProjecte(e.target.value)}>
          <option value="" disabled>projecte…</option>
          {projectes.map((p) => <option key={p.id} value={p.id}>{p.titol}</option>)}
        </select>
        <button className="boto boto-primari" disabled={pendent}>crear entregable</button>
        <button type="button" className="boto" onClick={() => setAEntregable(false)}>×</button>
        {error && <span className="error" role="alert">{error}</span>}
      </form>
    );
  }

  const seguent = SEGUENT[estat];
  return (
    <>
      {seguent && (
        <button className="boto" disabled={pendent} onClick={() => canvia(seguent)}>{seguent}</button>
      )}
      {estat === "assignada" && !convertida && (
        <>
          <Link className="boto" href={`/projectes/nou?idea=${id}`}>a projecte</Link>
          <button className="boto" disabled={pendent} onClick={() => setAEntregable(true)}>a entregable</button>
        </>
      )}
      <button className="boto" disabled={pendent} onClick={() => canvia("descartada")}>descartar</button>
      {error && <div className="error" role="alert">{error}</div>}
    </>
  );
}

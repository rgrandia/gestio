"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Repeat } from "lucide-react";
import { marcaDies } from "@/lib/accions-calendari";
import { LLISTA_TIPUS_DIA, TIPUS_DIA, type DiaMarcat, type TipusDia } from "@/lib/calendari";
import { sumaDies } from "@/lib/dates";
import { IconaDia } from "@/components/IconaDia";

type Persona = { id: string; nom: string; color: string | null };

// El meu calendari: tries dies (clic; Maj+clic per a un interval) i els
// marques. Es pot repetir cada setmana fins a una data (p. ex. teletreball
// tots els divendres) i marcar festius de tot l'equip. Hi surten també els
// dels companys, per saber qui hi ha.
export function CalendariPersonal({
  mes,
  dies,
  hui,
  jo,
  marques,
  persones,
}: {
  mes: string;
  dies: string[];
  hui: string;
  jo: string;
  marques: DiaMarcat[];
  persones: Persona[];
}) {
  const router = useRouter();
  const [triats, setTriats] = useState<Set<string>>(new Set());
  const [darrer, setDarrer] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [equip, setEquip] = useState(false);
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();

  const meu = new Map(marques.filter((m) => m.perfil_id === jo).map((m) => [m.data, m]));
  const festiusEquip = new Map(marques.filter((m) => m.perfil_id === null).map((m) => [m.data, m]));
  const altres = marques.filter((m) => m.perfil_id && m.perfil_id !== jo);
  const nomDe = new Map(persones.map((p) => [p.id, p]));

  const tria = (d: string, interval: boolean) => {
    setError(null);
    setTriats((s) => {
      const n = new Set(s);
      if (interval && darrer) {
        const [a, b] = darrer < d ? [darrer, d] : [d, darrer];
        for (let x = a; x <= b; x = sumaDies(x, 1)) n.add(x);
      } else if (n.has(d)) n.delete(d);
      else n.add(d);
      return n;
    });
    setDarrer(d);
  };

  // Amb «repetir», cada dia triat es repeteix setmana rere setmana fins a la data.
  const datesFinals = () => {
    const totes = new Set(triats);
    if (repetir) for (const d of triats) for (let x = sumaDies(d, 7); x <= repetir; x = sumaDies(x, 7)) totes.add(x);
    return [...totes].sort();
  };

  const aplica = (tipus: TipusDia | null) =>
    startTransition(async () => {
      const dates = datesFinals();
      const r = await marcaDies(dates, tipus, nota, equip);
      if (r.error) return setError(r.error);
      setTriats(new Set());
      setNota("");
      setRepetir("");
      router.refresh();
    });

  return (
    <div className="calendari-personal">
      <div className={`barra-dies ${triats.size === 0 ? "inactiva" : ""}`} role="toolbar" aria-label="marcar els dies triats">
        <span className="petit">
          {triats.size === 0 ? "Tria dies al calendari (clic; Maj+clic per a un interval)" : `${triats.size} ${triats.size === 1 ? "dia triat" : "dies triats"}`}
        </span>
        {LLISTA_TIPUS_DIA.filter((t) => !equip || t === "festiu").map((t) => (
          <button
            key={t}
            type="button"
            className="boto boto-dia"
            style={{ borderLeftColor: TIPUS_DIA[t].color }}
            disabled={pendent || triats.size === 0}
            onClick={() => aplica(t)}
          >
            <IconaDia tipus={t} /> {TIPUS_DIA[t].nom}
          </button>
        ))}
        <button type="button" className="boto boto-suau" disabled={pendent || triats.size === 0} onClick={() => aplica(null)}>
          <Eraser className="icona-petita" aria-hidden /> treure
        </button>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={80}
          placeholder="nota (opcional, sense motius de salut)"
          aria-label="nota"
          className="flex-1"
        />
        <label className="petit flex items-center gap-1" title="cada dia triat es repeteix cada setmana fins a aquesta data">
          <Repeat className="icona-petita" aria-hidden /> cada setmana fins al
          <input type="date" value={repetir} min={hui} onChange={(e) => setRepetir(e.target.value)} aria-label="repetir cada setmana fins al" />
        </label>
        <label className="petit flex items-center gap-1">
          <input type="checkbox" checked={equip} onChange={(e) => setEquip(e.target.checked)} className="min-h-0" /> festiu de tot l&apos;equip
        </label>
        {triats.size > 0 && (
          <button type="button" className="enllac petit" onClick={() => setTriats(new Set())}>
            desfer la tria
          </button>
        )}
        {error && <span className="error" role="alert">{error}</span>}
      </div>

      <div className="graella-mes graella-calendari">
        {["dl", "dt", "dc", "dj", "dv", "ds", "dg"].map((d) => (
          <div key={d} className="cap-dia">{d}</div>
        ))}
        {dies.map((d) => {
          const fora = d.slice(0, 7) !== mes;
          const m = meu.get(d);
          const f = festiusEquip.get(d);
          const ells = altres.filter((a) => a.data === d);
          return (
            <button
              key={d}
              type="button"
              className={["dia", "dia-cal", fora ? "fora" : "", d === hui ? "avui" : "", triats.has(d) ? "triat" : ""].join(" ")}
              aria-pressed={triats.has(d)}
              data-data={d}
              onClick={(e) => tria(d, e.shiftKey)}
            >
              <span className="num-dia"><span>{Number(d.slice(8))}</span></span>
              {f && (
                <span className="marca-dia" style={{ borderLeftColor: TIPUS_DIA.festiu.color }} title={f.nota ?? "festiu de tot l'equip"}>
                  <IconaDia tipus="festiu" /> {f.nota || "festiu"} · equip
                </span>
              )}
              {m && (
                <span className="marca-dia meva" style={{ borderLeftColor: TIPUS_DIA[m.tipus].color }} title={m.nota ?? undefined}>
                  <IconaDia tipus={m.tipus} /> {TIPUS_DIA[m.tipus].nom}
                  {m.nota && <span className="suau"> · {m.nota}</span>}
                </span>
              )}
              {ells.length > 0 && (
                <span className="altres-dia">
                  {ells.map((a) => {
                    const p = nomDe.get(a.perfil_id!);
                    return (
                      <span
                        key={a.perfil_id}
                        className="avatar-dia"
                        style={{ borderColor: TIPUS_DIA[a.tipus].color, background: p?.color ?? "var(--text-suau)" }}
                        title={`${p?.nom ?? "?"}: ${TIPUS_DIA[a.tipus].nom}${a.nota ? ` (${a.nota})` : ""}`}
                      >
                        {(p?.nom ?? "?").slice(0, 1)}
                      </span>
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="petit suau mt-2 llegenda-dies">
        {LLISTA_TIPUS_DIA.map((t) => (
          <span key={t} style={{ borderLeftColor: TIPUS_DIA[t].color }}>
            <IconaDia tipus={t} /> {TIPUS_DIA[t].nom}
          </span>
        ))}
        <span className="sense-vora">· les inicials són els companys (vora del color del tipus de dia)</span>
      </p>
    </div>
  );
}

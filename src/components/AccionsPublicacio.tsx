"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Check, CheckCheck, Copy, RotateCcw, Send, Undo2, UserRoundCog, CalendarCheck2 } from "lucide-react";
import {
  canviaEstatPublicacio,
  duplicaPublicacio,
  passaPublicacio,
  replanificaPublicacio,
  type CanviEstat,
} from "@/lib/accions-xarxes";
import { NOM_ESTAT, PLATAFORMES, type EstatPublicacio, type Plataforma } from "@/lib/xarxes";
import { sumaDies } from "@/lib/dates";

type Props = {
  id: string;
  estat: EstatPublicacio;
  jo: string;
  responsableId: string | null;
  revisorId: string | null;
  dataPrevista: string | null;
  hui: string;
  persones: { id: string; nom: string }[]; // membres amb xarxes
  canals: { compte_id: string; nom: string; plataforma: Plataforma; enllac_publicat: string | null }[];
};

type Obert = null | "revisar" | "retornar" | "publicada" | "data" | "passar";

// Els passos del circuit, segons l'estat i qui ets. Les regles de debò són al
// trigger (0019): aquí només es mostra el que té sentit.
export function AccionsPublicacio(p: Props) {
  const router = useRouter();
  const [obert, setObert] = useState<Obert>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendent, startTransition] = useTransition();
  const [revisor, setRevisor] = useState("");
  const [nota, setNota] = useState("");
  const [dataReal, setDataReal] = useState(p.hui);
  const [enllacos, setEnllacos] = useState<Record<string, string>>(
    Object.fromEntries(p.canals.map((c) => [c.compte_id, c.enllac_publicat ?? ""])),
  );
  const [novaData, setNovaData] = useState(p.dataPrevista ?? "");
  const [motiu, setMotiu] = useState("");
  const [persona, setPersona] = useState("");

  const fes = (f: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await f();
      if (r?.error) return setError(r.error);
      setObert(null);
      router.refresh();
    });
  const estat = (c: CanviEstat) => fes(() => canviaEstatPublicacio(p.id, c));

  const socRevisor = p.estat === "revisio" && p.revisorId === p.jo;
  const soc = p.responsableId === p.jo;
  const oberta = !["publicada", "cancellada"].includes(p.estat);
  const revisors = p.persones.filter((x) => x.id !== (p.responsableId ?? p.jo));

  return (
    <div className="accions-pub">
      <div className="flex flex-wrap gap-2">
        {p.estat === "idea" && (
          <button className="boto" disabled={pendent} onClick={() => estat({ estat: "esborrany" })}>
            <Check className="icona-petita" aria-hidden /> passar a esborrany
          </button>
        )}
        {["idea", "esborrany"].includes(p.estat) && (
          <button className="boto" disabled={pendent} onClick={() => setObert(obert === "revisar" ? null : "revisar")}>
            <Send className="icona-petita" aria-hidden /> enviar a revisar
          </button>
        )}
        {socRevisor && (
          <>
            <button className="boto boto-primari" disabled={pendent} onClick={() => estat({ estat: "aprovada" })}>
              <CheckCheck className="icona-petita" aria-hidden /> aprovar
            </button>
            <button className="boto" disabled={pendent} onClick={() => setObert(obert === "retornar" ? null : "retornar")}>
              <Undo2 className="icona-petita" aria-hidden /> retornar amb comentari
            </button>
          </>
        )}
        {p.estat === "revisio" && soc && !socRevisor && (
          <button className="boto boto-suau" disabled={pendent} onClick={() => estat({ estat: "esborrany" })}>
            <Undo2 className="icona-petita" aria-hidden /> retirar de revisió
          </button>
        )}
        {["esborrany", "aprovada"].includes(p.estat) && (
          <button className="boto" disabled={pendent} onClick={() => estat({ estat: "programada" })} title="programada a l'eina de la xarxa">
            <CalendarCheck2 className="icona-petita" aria-hidden /> programada
          </button>
        )}
        {["esborrany", "aprovada", "programada"].includes(p.estat) && (
          <button className="boto boto-primari" disabled={pendent} onClick={() => setObert(obert === "publicada" ? null : "publicada")}>
            <Check className="icona-petita" aria-hidden /> marcar publicada
          </button>
        )}
        {["aprovada", "programada"].includes(p.estat) && (
          <button className="boto boto-suau" disabled={pendent} onClick={() => estat({ estat: "esborrany" })}>
            <Undo2 className="icona-petita" aria-hidden /> tornar a esborrany
          </button>
        )}
        {["publicada", "cancellada"].includes(p.estat) && (
          <button className="boto boto-suau" disabled={pendent} onClick={() => estat({ estat: "esborrany" })}>
            <RotateCcw className="icona-petita" aria-hidden /> reobrir
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {oberta && (
          <button className="boto boto-suau" disabled={pendent} onClick={() => setObert(obert === "data" ? null : "data")}>
            <CalendarClock className="icona-petita" aria-hidden /> {p.dataPrevista ? "replanificar" : "posar data"}
          </button>
        )}
        {oberta && (
          <button className="boto boto-suau" disabled={pendent} onClick={() => setObert(obert === "passar" ? null : "passar")}>
            <UserRoundCog className="icona-petita" aria-hidden /> passar a…
          </button>
        )}
        <button className="boto boto-suau" disabled={pendent} onClick={() => fes(() => duplicaPublicacio(p.id))} title="còpia en esborrany, sense data">
          <Copy className="icona-petita" aria-hidden /> reaprofitar
        </button>
        {oberta && (
          <button className="boto boto-suau boto-perill" disabled={pendent} onClick={() => estat({ estat: "cancellada" })}>
            <Ban className="icona-petita" aria-hidden /> cancel·lar
          </button>
        )}
      </div>

      {obert === "revisar" && (
        <div className="panell-accio">
          {revisors.length === 0 ? (
            <span className="petit suau">Ningú més té les xarxes activades. Activa-les a algú des de la pantalla d&apos;equip.</span>
          ) : (
            <>
              <select value={revisor} onChange={(e) => setRevisor(e.target.value)} aria-label="qui la revisa">
                <option value="">qui la revisa?</option>
                {revisors.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
              </select>
              <button className="boto boto-primari" disabled={pendent || !revisor} onClick={() => estat({ estat: "revisio", revisor })}>
                enviar
              </button>
            </>
          )}
        </div>
      )}
      {obert === "retornar" && (
        <div className="panell-accio">
          <input className="flex-1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="què cal canviar?" aria-label="què cal canviar" />
          <button className="boto boto-primari" disabled={pendent || !nota.trim()} onClick={() => estat({ estat: "retornar", nota })}>
            retornar
          </button>
        </div>
      )}
      {obert === "publicada" && (
        <div className="panell-accio columna">
          <label className="petit">
            publicada el
            <input type="date" value={dataReal} max={p.hui} onChange={(e) => setDataReal(e.target.value)} />
          </label>
          {p.canals.map((c) => (
            <label key={c.compte_id} className="petit flex items-center gap-2">
              <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>{PLATAFORMES[c.plataforma].curt}</span>
              <input
                className="flex-1"
                value={enllacos[c.compte_id] ?? ""}
                onChange={(e) => setEnllacos((x) => ({ ...x, [c.compte_id]: e.target.value }))}
                placeholder={`enllaç a la publicació a ${c.nom} (opcional)`}
                aria-label={`enllaç publicat a ${c.nom}`}
              />
            </label>
          ))}
          <div>
            <button className="boto boto-primari" disabled={pendent || !dataReal} onClick={() => estat({ estat: "publicada", data: dataReal, enllacos })}>
              desar com a publicada
            </button>
          </div>
        </div>
      )}
      {obert === "data" && (
        <div className="panell-accio">
          <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} aria-label="nova data prevista" />
          {p.dataPrevista && (
            <>
              <button type="button" className="boto boto-suau" onClick={() => setNovaData(sumaDies(p.dataPrevista!, 1))}>+1 dia</button>
              <button type="button" className="boto boto-suau" onClick={() => setNovaData(sumaDies(p.dataPrevista!, 7))}>+1 setm.</button>
              <input className="flex-1" value={motiu} onChange={(e) => setMotiu(e.target.value)} placeholder="motiu (opcional)" aria-label="motiu" />
            </>
          )}
          <button className="boto boto-primari" disabled={pendent || !novaData} onClick={() => fes(() => replanificaPublicacio(p.id, novaData, motiu))}>
            desar data
          </button>
        </div>
      )}
      {obert === "passar" && (
        <div className="panell-accio">
          <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="a qui la passes">
            <option value="">a qui?</option>
            {p.persones.filter((x) => x.id !== p.responsableId).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </select>
          <button className="boto boto-primari" disabled={pendent || !persona} onClick={() => fes(() => passaPublicacio(p.id, persona))}>
            passar
          </button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <p className="petit suau mt-2">estat: <strong>{NOM_ESTAT[p.estat]}</strong></p>
    </div>
  );
}

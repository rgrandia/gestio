"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, PenLine, Undo2 } from "lucide-react";
import { desaPublicacio } from "@/lib/accions-xarxes";
import { avisosCanal, comptaCaracters, comptaHashtags, PLATAFORMES, textFinal, type Compte } from "@/lib/xarxes";
import { BotoCopiar } from "@/components/BotoCopiar";

type Props = {
  id: string;
  titol: string;
  text: string | null;
  hora: string | null;
  projecteId: string | null;
  enllacRecursos: string | null;
  notes: string | null;
  canals: { compte_id: string; text_adaptat: string | null; actiu: boolean; enllac_publicat: string | null }[];
  comptes: Compte[];
  projectes: { id: string; titol: string }[];
  bloquejat: boolean;
  aprovada: boolean;
};

// Redactar una vegada i veure-ho com quedarà a cada xarxa: comptador de
// caràcters com el de la xarxa, avisos objectius i el text final per copiar.
// L'app no publica: es copia i s'enganxa a la xarxa (§2).
export function EditorPublicacio(p: Props) {
  const [estat, envia, pendent] = useActionState(desaPublicacio, {});
  const [base, setBase] = useState(p.text ?? "");
  const [recursos, setRecursos] = useState(p.enllacRecursos ?? "");
  const actiusAra = p.canals.filter((c) => c.actiu).map((c) => c.compte_id);
  const [triats, setTriats] = useState<Set<string>>(new Set(actiusAra));
  const [adaptats, setAdaptats] = useState<Record<string, string | null>>(
    Object.fromEntries(p.canals.map((c) => [c.compte_id, c.text_adaptat])),
  );
  const [canviat, setCanviat] = useState(false);
  const toca = () => setCanviat(true);

  // Els actius i els que ja hi eren encara que ara estiguin desactivats.
  const disponibles = useMemo(
    () => p.comptes.filter((c) => c.actiu || p.canals.some((k) => k.compte_id === c.id)),
    [p.comptes, p.canals],
  );

  const commuta = (id: string) => {
    toca();
    setTriats((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <form action={envia} className="formulari editor-pub" onChange={toca} onSubmit={() => setCanviat(false)}>
      <input type="hidden" name="id" value={p.id} />
      <div className="fila-camps">
        <label>
          nom intern
          <input name="titol" defaultValue={p.titol} required disabled={p.bloquejat} />
        </label>
        <label>
          projecte
          <select name="projecte_id" defaultValue={p.projecteId ?? ""} disabled={p.bloquejat}>
            <option value="">cap: és del dia a dia</option>
            {p.projectes.map((x) => (
              <option key={x.id} value={x.id}>{x.titol}</option>
            ))}
          </select>
        </label>
        <label>
          hora
          <input name="hora" type="time" defaultValue={p.hora?.slice(0, 5) ?? ""} disabled={p.bloquejat} />
        </label>
      </div>

      <fieldset className="tria-comptes">
        <legend>comptes</legend>
        {disponibles.length === 0 && <span className="petit suau">cap compte encara: afegeix-ne a «comptes i dates clau»</span>}
        {disponibles.map((c) => (
          <label key={c.id} className="check">
            <input
              type="checkbox"
              name="compte"
              value={c.id}
              checked={triats.has(c.id)}
              onChange={() => commuta(c.id)}
              className="min-h-0"
              disabled={p.bloquejat}
            />
            <span className="xarxa" style={{ background: PLATAFORMES[c.plataforma].color }}>{PLATAFORMES[c.plataforma].curt}</span>
            {c.nom}
            {!c.actiu && <span className="suau petit"> (inactiu)</span>}
          </label>
        ))}
      </fieldset>

      <label>
        text base
        <textarea
          name="text"
          rows={6}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          disabled={p.bloquejat}
          placeholder="El que es diu a totes les xarxes. Si alguna necessita una versió pròpia (més curta per a X, per exemple), adapta-la a sota."
        />
        <span className="petit suau">
          {[...base].length} caràcters · {comptaHashtags(base)} etiquetes
        </span>
      </label>

      <div className="fila-camps">
        <label>
          imatges o vídeo (enllaç a SharePoint o Drive)
          <input name="enllac_recursos" value={recursos} onChange={(e) => setRecursos(e.target.value)} placeholder="https://…" disabled={p.bloquejat} />
        </label>
        <label>
          notes internes
          <input name="notes" defaultValue={p.notes ?? ""} disabled={p.bloquejat} />
        </label>
      </div>

      {triats.size > 0 && (
        <div className="canals">
          {disponibles
            .filter((c) => triats.has(c.id))
            .map((c) => {
              const pl = PLATAFORMES[c.plataforma];
              const adaptat = adaptats[c.id];
              const final = textFinal(base, adaptat, c.signatura);
              const n = comptaCaracters(final, c.plataforma);
              const avisos = avisosCanal(final, c.plataforma, !!recursos.trim());
              return (
                <div key={c.id} className="canal" style={{ borderTopColor: pl.color }} data-xarxa={c.plataforma}>
                  <div className="canal-cap">
                    <span className="xarxa" style={{ background: pl.color }}>{pl.curt}</span>
                    <strong>{pl.nom}</strong>
                    <span className="suau">{c.nom}</span>
                    <span className={`comptador-car ${pl.limit && n > pl.limit ? "passat" : ""}`} aria-label="caràcters">
                      {n}
                      {pl.limit ? ` / ${pl.limit}` : ""}
                    </span>
                  </div>
                  {adaptat !== null && adaptat !== undefined ? (
                    <>
                      <textarea
                        name={`adaptat_${c.id}`}
                        rows={4}
                        value={adaptat}
                        aria-label={`text adaptat per a ${pl.nom}`}
                        onChange={(e) => setAdaptats((a) => ({ ...a, [c.id]: e.target.value }))}
                        disabled={p.bloquejat}
                      />
                      {!p.bloquejat && (
                        <button
                          type="button"
                          className="enllac petit"
                          onClick={() => {
                            toca();
                            setAdaptats((a) => ({ ...a, [c.id]: null }));
                          }}
                        >
                          <Undo2 className="icona-petita inline" aria-hidden /> fer servir el text base
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="previsualitzacio">{final || <span className="suau">sense text</span>}</p>
                      {!p.bloquejat && (
                        <button
                          type="button"
                          className="enllac petit"
                          onClick={() => {
                            toca();
                            setAdaptats((a) => ({ ...a, [c.id]: base }));
                          }}
                        >
                          <PenLine className="icona-petita inline" aria-hidden /> adaptar per a {pl.nom}
                        </button>
                      )}
                    </>
                  )}
                  {avisos.length > 0 && (
                    <ul className="avisos-canal">
                      {avisos.map((a) => (
                        <li key={a}><AlertTriangle className="icona-petita inline" aria-hidden /> {a}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2">
                    <BotoCopiar text={final} etiqueta={`copiar per a ${pl.nom}`} />
                    {c.signatura && !adaptat && <span className="petit suau">inclou la signatura del compte</span>}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {!p.bloquejat && (
        <div className="flex items-center gap-2">
          <button className="boto boto-primari" disabled={pendent}>desar</button>
          {estat.error && <span className="error" role="alert">{estat.error}</span>}
          {estat.ok && !canviat && <span className="petit suau">desat</span>}
          {canviat && !pendent && <span className="petit suau">canvis sense desar</span>}
          {p.aprovada && <span className="petit tag-risc">si canvies el text, l&apos;aprovació caduca i torna a esborrany</span>}
        </div>
      )}
    </form>
  );
}

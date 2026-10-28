"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarCog, FolderKanban, Lightbulb, ListTodo, Megaphone, Search } from "lucide-react";
import { cercaGlobal, type ResultatCerca } from "@/lib/accions";

const ICONA = {
  projecte: FolderKanban,
  client: Building2,
  tasca: ListTodo,
  idea: Lightbulb,
  publicacio: Megaphone,
  dia: CalendarCog,
};

// Cerca a tot arreu. "/" o Ctrl+K hi posen el focus; fletxes i Enter per triar.
export function CercaGlobal() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatCerca[]>([]);
  const [obert, setObert] = useState(false);
  const [sel, setSel] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escrivint = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !escrivint)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        setResultats(await cercaGlobal(q));
        setSel(0);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const visibles = q.trim().length < 2 ? [] : resultats;

  function ves(r: ResultatCerca | undefined) {
    if (!r) return;
    setObert(false);
    setQ("");
    setResultats([]);
    input.current?.blur();
    router.push(r.href);
  }

  return (
    <div className="cerca-global" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setObert(false)}>
      <label className="camp">
        <Search className="icona-petita" aria-hidden />
        <input
          ref={input}
          type="search"
          placeholder="cerca…"
          aria-label="cerca a tota l'app"
          value={q}
          onFocus={() => setObert(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setObert(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, visibles.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              ves(visibles[sel]);
            } else if (e.key === "Escape") {
              setObert(false);
              input.current?.blur();
            }
          }}
        />
        <kbd>/</kbd>
      </label>
      {obert && q.trim().length >= 2 && (
        <ul className="resultats" role="listbox">
          {visibles.length === 0 ? (
            <li className="cap">cap resultat per «{q.trim()}»</li>
          ) : (
            visibles.map((r, i) => {
              const Icona = ICONA[r.tipus];
              return (
                <li key={r.tipus + r.href + r.titol} role="option" aria-selected={i === sel}>
                  <button type="button" onMouseEnter={() => setSel(i)} onClick={() => ves(r)}>
                    <Icona className="icona-petita" aria-hidden />
                    <span className="t">{r.titol}</span>
                    <span className="d">{r.detall}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

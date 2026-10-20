import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requereixMembre } from "@/lib/auth/session";
import { obteClientsActius, obtePerfils } from "@/lib/dades";
import { creaProjecte } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";

export default async function NouProjecte({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; idea?: string }>;
}) {
  const perfil = await requereixMembre();
  const { client, idea: ideaId } = await searchParams;
  const [clients, perfils] = await Promise.all([obteClientsActius(), obtePerfils()]);

  let idea: { id: string; titol: string; descripcio: string | null; client_id: string | null } | null = null;
  if (ideaId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("idees")
      .select("id, titol, descripcio, client_id")
      .eq("id", ideaId)
      .maybeSingle();
    idea = data;
  }

  if (clients.length === 0) {
    return (
      <>
        <h1>nou projecte</h1>
        <div className="buit">
          cap client actiu. <Link href="/clients/nou">crea primer un client</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>nou projecte</h1>
      {idea && <p className="petit suau mb-3">a partir de la idea «{idea.titol}»</p>}
      <Formulari accio={creaProjecte} boto="crear projecte">
        {idea && <input type="hidden" name="idea_id" value={idea.id} />}
        <label>
          títol
          <input name="titol" required defaultValue={idea?.titol} />
        </label>
        <div className="fila-camps">
          <label>
            tipus
            <select name="tipus" required defaultValue="">
              <option value="" disabled>tria…</option>
              <option value="estudi">estudi (genera 6 fases)</option>
              <option value="consultoria">consultoria (sense fases)</option>
            </select>
          </label>
          <label>
            subtipus
            <input name="subtipus" list="subtipus" placeholder="barometre, electoral…" />
            <datalist id="subtipus">
              {["barometre", "electoral", "qualitatiu", "pla_comunicacio", "acompanyament"].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="fila-camps">
          <label>
            client
            <select name="client_id" required defaultValue={client ?? idea?.client_id ?? ""}>
              <option value="" disabled>tria…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
          <label>
            responsable
            <select name="responsable_id" required defaultValue={perfil.id}>
              {perfils.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </label>
        </div>
        <div className="fila-camps">
          <label>
            data d&apos;inici
            <input name="data_inici" type="date" />
          </label>
          <label>
            fi prevista
            <input name="data_fi_prevista" type="date" />
          </label>
          <label>
            dies de silenci màx.
            <input name="dies_silenci_max" type="number" min={1} defaultValue={45} />
          </label>
        </div>
        <label>
          notes
          <textarea name="notes" rows={3} defaultValue={idea?.descripcio ?? ""} />
        </label>
      </Formulari>
    </>
  );
}

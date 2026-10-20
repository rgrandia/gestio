import type { Client, Perfil } from "@/lib/tipus";

export function CampsClient({ client, perfils }: { client?: Client; perfils: Perfil[] }) {
  return (
    <>
      <label>
        nom
        <input name="nom" required defaultValue={client?.nom} />
      </label>
      <div className="fila-camps">
        <label>
          tipus
          <select name="tipus" required defaultValue={client?.tipus ?? ""}>
            <option value="" disabled>tria…</option>
            <option value="municipi">municipi</option>
            <option value="partit">partit</option>
            <option value="institucio">institució</option>
            <option value="altre">altre</option>
          </select>
        </label>
        <label>
          territori
          <input name="territori" placeholder="comarca o àmbit" defaultValue={client?.territori ?? ""} />
        </label>
        <label>
          responsable
          <select name="responsable_id" defaultValue={client?.responsable_id ?? ""}>
            <option value="">—</option>
            {perfils.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </label>
      </div>
      <label>
        notes
        <textarea name="notes" rows={3} defaultValue={client?.notes ?? ""} />
      </label>
      <p className="petit suau">
        Cap dada personal de ciutadans. Com a molt, el càrrec de contacte del client.
      </p>
    </>
  );
}

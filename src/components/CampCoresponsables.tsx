import type { Perfil } from "@/lib/tipus";
import { Persona } from "@/components/Persona";

// Caselles de co-responsables. Només membres; si es marca el principal,
// el servidor l'ignora.
export function CampCoresponsables({ membres, marcats = [] }: { membres: Perfil[]; marcats?: string[] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="petit suau mb-2" style={{ fontWeight: 500 }}>
        co-responsables <span className="fluix">(opcional · també veuen a la seva safata el que és del projecte)</span>
      </legend>
      <div className="flex flex-wrap gap-4">
        {membres.map((m) => (
          <label key={m.id} className="check">
            <input type="checkbox" name="coresponsables" value={m.id} defaultChecked={marcats.includes(m.id)} />
            <Persona nom={m.nom} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

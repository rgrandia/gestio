import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { teXarxes } from "@/lib/funcions";
import { Persona } from "@/components/Persona";

// Només per a qui té les xarxes activades (migració 0019). Si no, s'explica
// a qui demanar-ho; les dades, igualment, no les retornaria l'RLS.
export default async function XarxesLayout({ children }: { children: React.ReactNode }) {
  if (await teXarxes()) return children;

  const supabase = await createClient();
  const { data } = await supabase
    .from("perfils")
    .select("id, nom, color, extern, funcions")
    .eq("actiu", true)
    .eq("extern", false)
    .contains("funcions", ["xarxes"]);
  const qui = data ?? [];
  return (
    <>
      <div className="cap-pagina">
        <div>
          <h1>xarxes socials</h1>
          <div className="sub">funció activada només per a algunes persones</div>
        </div>
      </div>
      <div className="buit">
        <Megaphone className="icona" aria-hidden />
        {qui.length > 0 ? (
          <span>
            No la tens activada. La pot activar des de la pantalla d&apos;equip:{" "}
            {qui.map((p, i) => (
              <span key={p.id}>{i > 0 ? ", " : ""}<Persona p={p} /></span>
            ))}
            .
          </span>
        ) : (
          <span>Encara no la té ningú. Qualsevol membre se la pot activar des de la pantalla d&apos;equip.</span>
        )}
      </div>
    </>
  );
}

import { LogOut } from "lucide-react";
import { requereixMembre } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/NavRail";
import { Persona } from "@/components/Persona";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requereixMembre();
  const supabase = await createClient();
  const { count } = await supabase
    .from("v_safata")
    .select("id", { count: "exact", head: true })
    .contains("responsables", [perfil.id]);

  return (
    <div className="app">
      <aside className="rail">
        <div className="marca">
          <span className="logo" aria-hidden>g</span>
          <div>
            <strong>gestió</strong>
            <span>estudis polítics i estratègia</span>
          </div>
        </div>
        <div className="seccio-nav">menú</div>
        <NavRail pendents={count ?? 0} />
        <div className="peu">
          <Persona p={perfil} nomesAvatar gran />
          <span className="nom">
            {perfil.nom}
            <small>{perfil.email}</small>
          </span>
          <form action={tancaSessio}>
            <button title="sortir" aria-label="sortir">
              <LogOut className="icona" aria-hidden />
            </button>
          </form>
        </div>
      </aside>
      <main className="contingut">{children}</main>
    </div>
  );
}

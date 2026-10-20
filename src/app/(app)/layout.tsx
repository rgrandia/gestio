import { requereixMembre } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/NavRail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requereixMembre();
  const supabase = await createClient();
  const { count } = await supabase
    .from("v_safata")
    .select("id", { count: "exact", head: true })
    .eq("responsable_id", perfil.id);

  return (
    <div className="app">
      <aside className="rail">
        <div className="marca">
          <strong>gestió</strong>
          <span>estudis polítics i estratègia</span>
        </div>
        <NavRail pendents={count ?? 0} />
        <div className="peu">
          <span className="avatar" aria-hidden>{perfil.nom.slice(0, 1).toUpperCase()}</span>
          <span className="nom">{perfil.nom}</span>
          <form action={tancaSessio}>
            <button className="enllac">sortir</button>
          </form>
        </div>
      </aside>
      <main className="contingut">{children}</main>
    </div>
  );
}

import { requereixMembre } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";
import { NavRail } from "@/components/NavRail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requereixMembre();
  return (
    <div className="app">
      <aside className="rail">
        <div className="marca">gesop · estudis i estratègia</div>
        <NavRail />
        <div className="peu">
          <div className="nom">{perfil.nom}</div>
          <form action={tancaSessio}>
            <button className="enllac">sortir</button>
          </form>
        </div>
      </aside>
      <main className="contingut">{children}</main>
    </div>
  );
}

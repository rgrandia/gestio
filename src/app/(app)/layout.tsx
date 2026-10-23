import { LogOut } from "lucide-react";
import { requereixMembre } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/NavRail";
import { CercaGlobal } from "@/components/CercaGlobal";
import { Persona } from "@/components/Persona";
import { ESQUEMA_ESPERAT } from "@/lib/versio";
import requerit from "@/lib/esquema-requerit.json";
import { cookies } from "next/headers";
import { Preferencies } from "@/components/Preferencies";
import { GALETA_MENU, GALETA_TEMA, llegeixMenu, llegeixTema, type Menu, type Tema } from "@/lib/preferencies";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requereixMembre();
  const supabase = await createClient();
  const galetes = await cookies();
  const [{ count }, { count: avisos }, { count: perRevisar }, versio, prefsR, faltenR] = await Promise.all([
    supabase
      .from("v_safata")
      .select("id", { count: "exact", head: true })
      .contains("responsables", [perfil.id])
      .eq("intern", false),
    supabase
      .from("notificacions")
      .select("id", { count: "exact", head: true })
      .is("llegida_el", null),
    supabase
      .from("revisions")
      .select("id", { count: "exact", head: true })
      .eq("estat", "pendent")
      .eq("revisor_id", perfil.id),
    supabase.rpc("versio_esquema"),
    // Consulta a part: si la base de dades encara no té la migració 0016,
    // falla sola i l'app continua amb les galetes.
    supabase.from("perfils").select("tema, menu").eq("id", perfil.id).maybeSingle(),
    // Què falta de debò (0018): no ens refiem només del registre de migracions.
    supabase.rpc("falten_objectes", { p_funcions: requerit.funcions, p_columnes: requerit.columnes }),
  ]);
  const falten: string[] = faltenR.error ? [] : ((faltenR.data as string[] | null) ?? []);
  const prefs = (prefsR.error ? null : prefsR.data) as { tema: Tema | null; menu: Menu | null } | null;
  // Si falla la crida, la base de dades és anterior a la migració 0014.
  const esquema: string | null = versio.error ? null : versio.data;
  const faltenMigracions = !esquema || esquema < ESQUEMA_ESPERAT;

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
        <CercaGlobal />
        <div className="seccio-nav">menú</div>
        <NavRail pendents={(count ?? 0) + (perRevisar ?? 0)} avisos={avisos ?? 0} />
        <div className="peu">
          <Persona p={perfil} nomesAvatar gran />
          <span className="nom">
            {perfil.nom}
            <small>{perfil.email}</small>
          </span>
          <Preferencies
            tema={llegeixTema(galetes.get(GALETA_TEMA)?.value)}
            menu={llegeixMenu(galetes.get(GALETA_MENU)?.value)}
            temaDesat={prefs?.tema ?? null}
            menuDesat={prefs?.menu ?? null}
          />
          <form action={tancaSessio}>
            <button title="sortir" aria-label="sortir">
              <LogOut className="icona" aria-hidden />
            </button>
          </form>
        </div>
      </aside>
      <main className="contingut">
        {(faltenMigracions || falten.length > 0) && (
          <p className="avis-esquema" role="alert">
            <strong>Falten migracions a la base de dades.</strong>{" "}
            {faltenMigracions && (
              <>
                Aquesta versió de l&apos;app necessita fins a la <code>{ESQUEMA_ESPERAT.slice(0, 14)}</code>
                {esquema ? <> i la base de dades és a la <code>{esquema.slice(0, 14)}</code></> : " i la base de dades és anterior a la 0014"}.{" "}
              </>
            )}
            {falten.length > 0 && (
              <>
                Hi falta: {falten.map((f, i) => <code key={f}>{i > 0 ? ", " : ""}{f}</code>)}.{" "}
              </>
            )}
            Algunes pantalles poden fallar fins que s&apos;apliquin (vegeu el README, «Actualitzar una instal·lació existent»).
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

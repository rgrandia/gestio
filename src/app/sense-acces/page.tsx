import { redirect } from "next/navigation";
import { obteSessio } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";

export default async function SenseAcces() {
  const sessio = await obteSessio();
  if (!sessio) redirect("/login");
  if (sessio.perfil) redirect("/");

  return (
    <main className="max-w-lg mx-auto px-4 pt-24">
      <h1>perfil inactiu</h1>
      <p className="prosa">
        Has iniciat la sessió com a <span className="font-mono">{sessio.email ?? sessio.usuariId}</span>,
        però el teu perfil no està actiu. Demana a un membre del departament que l&apos;activi des
        del panell de Supabase.
      </p>
      <form action={tancaSessio} className="mt-4">
        <button className="boto">sortir</button>
      </form>
    </main>
  );
}

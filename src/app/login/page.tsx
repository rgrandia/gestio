import { PROVEIDOR_AUTH } from "@/lib/auth/config";
import { iniciaSessioEntra } from "@/lib/auth/actions";
import { FormulariContrasenya } from "./FormulariContrasenya";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="entrada">
      <div className="caixa">
        <div className="marca">
          <span className="logo" aria-hidden>g</span>
          <div>
            <h1>gestió</h1>
            <div className="sub">estudis polítics i estratègia</div>
          </div>
        </div>
        {PROVEIDOR_AUTH === "azure" ? (
          <form action={iniciaSessioEntra} className="formulari">
            <button className="boto boto-primari">entrar amb el compte de GESOP</button>
            {error && (
              <p className="error">No s&apos;ha pogut iniciar la sessió amb Entra ID. Torna-ho a provar.</p>
            )}
          </form>
        ) : (
          <FormulariContrasenya />
        )}
      </div>
    </main>
  );
}

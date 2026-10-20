"use client";

import { useActionState } from "react";
import { iniciaSessioContrasenya } from "@/lib/auth/actions";

export function FormulariContrasenya() {
  const [estat, envia, pendent] = useActionState(iniciaSessioContrasenya, {});
  return (
    <form action={envia} className="formulari">
      <label>
        correu
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        contrasenya
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <div className="flex items-center gap-2">
        <button className="boto boto-primari" disabled={pendent}>entrar</button>
        {estat.error && <span className="error" role="alert">{estat.error}</span>}
      </div>
      <p className="petit suau">
        Sense registre obert: els usuaris es creen des del panell. No reutilitzis la contrasenya
        corporativa.
      </p>
    </form>
  );
}

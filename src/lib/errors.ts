// Els errors diuen què ha fallat i com arreglar-ho; no demanen perdó (§11.7).
type ErrorPg = { code?: string; message?: string } | null | undefined;

export function missatgeError(error: ErrorPg): string {
  if (!error) return "Error desconegut. Torna-ho a provar.";
  switch (error.code) {
    case "23514":
      if (error.message?.includes("fet_te_data_real"))
        return "Per marcar-ho fet cal una data real.";
      if (error.message?.includes("tasca_una_sola_ancora"))
        return "Una tasca pot penjar d'una fase o d'un entregable, no de tots dos.";
      return "Algun valor no és vàlid. Revisa el formulari.";
    case "23502":
      return "Falta un camp obligatori.";
    case "23503":
      return "L'element relacionat no existeix o està inactiu.";
    case "42501":
      return "No tens permís. Si hauries de tenir-ne, demana que activin el teu perfil.";
    case "P0001":
      return error.message ?? "Operació rebutjada per la base de dades.";
  }
  return error.message ?? "Error desconegut. Torna-ho a provar.";
}

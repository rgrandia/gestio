// Els errors diuen què ha fallat i com arreglar-ho; no demanen perdó.
type ErrorPg = { code?: string; message?: string } | null | undefined;

export function missatgeError(error: ErrorPg): string {
  if (!error) return "Error desconegut. Torna-ho a provar.";
  switch (error.code) {
    case "23514":
      if (error.message?.includes("fet_te_data_real"))
        return "Per marcar-ho fet cal una data real.";
      if (error.message?.includes("fases_inici_abans_final"))
        return "L'inici de la fase ha de ser anterior o igual al final previst.";
      if (error.message?.includes("projectes_numero_estudi_format"))
        return "El número d'estudi ha de tenir exactament 4 xifres.";
      if (error.message?.includes("revisio_a_un_altre"))
        return "No pots enviar-te una revisió a tu mateix.";
      if (error.message?.includes("revisio_retornada_amb_comentari"))
        return "Explica què cal canviar abans de retornar-la.";
      if (error.message?.includes("tasca_una_sola_ancora"))
        return "Una tasca pot penjar d'una fase o d'un entregable, no de tots dos.";
      return "Algun valor no és vàlid. Revisa el formulari.";
    case "23505":
      if (error.message?.includes("numero_estudi"))
        return "Aquest número d'estudi ja el fa servir un altre projecte.";
      return "Ja existeix un registre amb aquestes dades.";
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

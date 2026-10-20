const CLASSE: Record<string, string> = {
  actiu: "tag-accent",
  pausat: "tag-risc",
  tancat: "tag-fet",
  cancellat: "",
  fet: "tag-fet",
  en_curs: "tag-accent",
  pendent: "",
  cancellada: "",
};

const TEXT: Record<string, string> = { cancellat: "cancel·lat", en_curs: "en curs" };

export function EtiquetaEstat({ estat }: { estat: string }) {
  return <span className={`etiqueta ${CLASSE[estat] ?? ""}`}>{TEXT[estat] ?? estat}</span>;
}

// Únic lloc on es decideix el proveïdor d'autenticació (CLAUDE.md §3).
// Canviar de pla B (email + contrasenya) a Entra ID és canviar aquesta
// variable i configurar el proveïdor a Supabase; la resta de l'app no ho sap.
export type ProveidorAuth = "password" | "azure";

export const PROVEIDOR_AUTH: ProveidorAuth =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER === "azure" ? "azure" : "password";

export const RUTES_PUBLIQUES = ["/login", "/auth/callback"];

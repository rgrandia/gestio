// Connexió a Supabase. Noms propis (GESTIO_*) i només al servidor, a propòsit:
//
// * La integració de Supabase del Marketplace de Vercel injecta les seves
//   pròpies NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, que poden apuntar a un altre
//   projecte i trepitjar les nostres sense que es vegi a la llista de variables.
//   Va passar en el primer desplegament.
// * Les NEXT_PUBLIC_* queden fixades en compilar; aquestes es llegeixen en
//   temps d'execució, així que canviar-les no exigeix recompilar sense memòria cau.
//
// L'app només parla amb Supabase des del servidor, així que el navegador no
// necessita cap d'aquestes dues variables.

export function supabaseUrl(): string {
  const v = process.env.GESTIO_SUPABASE_URL;
  if (!v) throw new Error("Falta la variable GESTIO_SUPABASE_URL (vegeu .env.example).");
  return v;
}

export function supabaseClau(): string {
  const v = process.env.GESTIO_SUPABASE_ANON_KEY;
  if (!v) throw new Error("Falta la variable GESTIO_SUPABASE_ANON_KEY (vegeu .env.example).");
  return v;
}

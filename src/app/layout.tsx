import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { cookies } from "next/headers";
import { GALETA_MENU, GALETA_TEMA, llegeixMenu, llegeixTema } from "@/lib/preferencies";
import "./globals.css";

// next/font descarrega la font en compilar i la serveix des de l'app:
// el navegador no fa cap petició a Google.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "gestió · estudis polítics i estratègia",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const galetes = await cookies();
  return (
    <html
      lang="ca"
      className={montserrat.variable}
      data-tema={llegeixTema(galetes.get(GALETA_TEMA)?.value)}
      data-menu={llegeixMenu(galetes.get(GALETA_MENU)?.value)}
    >
      <body>{children}</body>
    </html>
  );
}

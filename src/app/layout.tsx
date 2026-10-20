import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}

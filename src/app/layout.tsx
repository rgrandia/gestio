import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// next/font descarrega les fonts en compilar i les serveix des de l'app:
// el navegador no fa cap petició a Google.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-sans",
});

export const metadata: Metadata = {
  title: "gestió · estudis polítics i estratègia",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={`${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

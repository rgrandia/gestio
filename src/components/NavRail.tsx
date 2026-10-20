"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLLACOS = [
  { href: "/", text: "la meva setmana" },
  { href: "/projectes", text: "projectes" },
  { href: "/idees", text: "idees" },
  { href: "/clients", text: "clients" },
];

// `pendents`: elements meus a la safata, perquè es vegi des de qualsevol pantalla.
export function NavRail({ pendents }: { pendents: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="principal">
      {ENLLACOS.map((e) => {
        const actiu = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link key={e.href} href={e.href} aria-current={actiu ? "page" : undefined}>
            <span>{e.text}</span>
            {e.href === "/" && pendents > 0 && (
              <span className="comptador c-vencut" title={`${pendents} elements a revisar`}>{pendents}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

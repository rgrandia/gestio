"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarCheck, FolderKanban, Lightbulb } from "lucide-react";

const ENLLACOS = [
  { href: "/", text: "la meva setmana", Icona: CalendarCheck },
  { href: "/projectes", text: "projectes", Icona: FolderKanban },
  { href: "/idees", text: "idees", Icona: Lightbulb },
  { href: "/clients", text: "clients", Icona: Building2 },
];

// `pendents`: elements meus a la safata, perquè es vegi des de qualsevol pantalla.
export function NavRail({ pendents }: { pendents: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="principal">
      {ENLLACOS.map(({ href, text, Icona }) => {
        const actiu = href === "/" ? ruta === "/" : ruta.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={actiu ? "page" : undefined} title={text}>
            <Icona className="icona" aria-hidden />
            <span className="text">{text}</span>
            {href === "/" && pendents > 0 && (
              <span className="comptador" title={`${pendents} elements a revisar`}>{pendents}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

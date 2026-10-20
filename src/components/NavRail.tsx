"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLLACOS = [
  { href: "/", text: "la meva setmana" },
  { href: "/projectes", text: "projectes" },
  { href: "/idees", text: "idees" },
  { href: "/clients", text: "clients" },
];

export function NavRail() {
  const ruta = usePathname();
  return (
    <nav aria-label="principal">
      {ENLLACOS.map((e) => {
        const actiu = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        return (
          <Link key={e.href} href={e.href} aria-current={actiu ? "page" : undefined}>
            {e.text}
          </Link>
        );
      })}
    </nav>
  );
}

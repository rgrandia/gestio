"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANYES = [
  { href: "/xarxes", text: "mes" },
  { href: "/xarxes/setmana", text: "setmana" },
  { href: "/xarxes/tauler", text: "tauler" },
  { href: "/xarxes/comptes", text: "comptes i dates clau" },
];

export function PestanyesXarxes() {
  const ruta = usePathname();
  return (
    <nav className="pestanyes" aria-label="xarxes socials">
      {PESTANYES.map((p) => (
        <Link key={p.href} href={p.href} aria-current={ruta === p.href ? "page" : undefined}>
          {p.text}
        </Link>
      ))}
    </nav>
  );
}

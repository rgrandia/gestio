"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FolderKanban,
  Lightbulb,
  Users,
  UsersRound,
} from "lucide-react";

const ENLLACOS = [
  { href: "/", text: "la meva setmana", Icona: CalendarCheck, compte: "pendents" as const },
  { href: "/avisos", text: "avisos", Icona: Bell, compte: "avisos" as const },
  { href: "/projectes", text: "projectes", Icona: FolderKanban },
  { href: "/cronograma", text: "cronograma", Icona: CalendarRange },
  { href: "/feina", text: "feina de l'equip", Icona: UsersRound },
  { href: "/resum", text: "resum setmanal", Icona: ClipboardList },
  { href: "/idees", text: "idees", Icona: Lightbulb },
  { href: "/clients", text: "clients", Icona: Building2 },
  { href: "/equip", text: "equip", Icona: Users },
];

// `pendents`: elements meus a la safata. `avisos`: notificacions sense llegir.
export function NavRail({ pendents, avisos }: { pendents: number; avisos: number }) {
  const ruta = usePathname();
  const comptes = { pendents, avisos };
  return (
    <nav aria-label="principal">
      {ENLLACOS.map(({ href, text, Icona, compte }) => {
        const actiu = href === "/" ? ruta === "/" : ruta.startsWith(href);
        const n = compte ? comptes[compte] : 0;
        return (
          <Link key={href} href={href} aria-current={actiu ? "page" : undefined}>
            <Icona className="icona" aria-hidden />
            <span className="text">{text}</span>
            {n > 0 && (
              <span className={`comptador ${compte === "avisos" ? "c-avis" : ""}`} title={`${n} ${compte === "avisos" ? "avisos sense llegir" : "elements a revisar"}`}>
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
